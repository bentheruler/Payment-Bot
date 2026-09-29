"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

function SubscribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPaymentId = searchParams.get("paymentId");

  const [paymentId, setPaymentId] = useState<string | null>(initialPaymentId);
  const [status, setStatus] = useState<string>(initialPaymentId ? "PENDING" : "IDLE");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "PAID") {
      fetch("/api/subscriptions/me")
        .then(res => res.json())
        .then(data => {
          if (data.inviteLink) {
            setInviteLink(data.inviteLink);
          }
        })
        .catch(err => console.error("Failed to fetch invite link", err));
    }
  }, [status]);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/subscriptions/me");
        if (res.status === 401) {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!paymentId || status === "PAID") return;

    // Start polling status
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`);
        if (!res.ok) {
           // Maybe payment not found or unauth
           return;
        }

        const data = await res.json();
        if (data.status === "PAID") {
          setStatus("PAID");
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === "FAILED" || data.status === "EXPIRED") {
          setStatus("FAILED");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setError(`Payment ${data.status.toLowerCase()}`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(pollStatus, 2500);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        if (status !== "PAID") {
          setError("Timed out waiting for payment confirmation. If you paid, it will be processed shortly.");
        }
      }
    }, 5 * 60 * 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeout);
    };
  }, [paymentId, status]);

  const handlePay = async () => {
    setStatus("CREATING");
    setError(null);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create payment");
      }
      
      const data = await res.json();
      setPaymentId(data.paymentId);
      
      // Update URL with paymentId so returning from Crypto Pay retains it
      router.replace(`/subscribe?paymentId=${data.paymentId}`);
      
      // Redirect to Crypto Pay
      window.location.href = data.payUrl;
    } catch (error: unknown) {
      const err = error as Error;
      setError(err.message);
      setStatus("IDLE");
    }
  };

  return (
    <div className="max-w-md w-full p-8 border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl flex flex-col items-center text-center space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Premium Monthly</h1>
      
      {error && (
         <div className="text-red-400 p-4 bg-red-900/20 rounded-md w-full">
           {error}
         </div>
      )}

      {status === "PAID" ? (
         <div className="flex flex-col items-center space-y-4 w-full">
           <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
           </div>
           <h2 className="text-xl font-semibold text-green-400">Payment Successful!</h2>
           <p className="text-zinc-400 mb-4">Your Premium Monthly subscription is active.</p>
           {inviteLink ? (
             <a href={inviteLink} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default", className: "w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors" })}>
               Join Private Channel
             </a>
           ) : (
             <p className="text-sm text-yellow-500">Generating invite link... Please wait.</p>
           )}
         </div>
      ) : (
         <div className="flex flex-col items-center space-y-6 w-full">
           <div className="text-4xl font-bold">$10<span className="text-lg text-zinc-500 font-normal"> / 30 days</span></div>
           <p className="text-zinc-400 text-sm">
             Unlock exclusive channel access and premium features.
           </p>
           
           <button 
             onClick={handlePay}
             disabled={status !== "IDLE"}
             className={buttonVariants({ variant: "default", className: "w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors" })}
           >
             {status === "CREATING" || status === "PENDING" ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{status === "CREATING" ? "Generating Invoice..." : "Waiting for Payment..."}</span>
                </div>
             ) : "Pay $10"}
           </button>
         </div>
      )}
    </div>
  );
}

export default function SubscribePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white">
      <Suspense fallback={<div className="flex items-center space-x-2"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /><span>Loading...</span></div>}>
        <SubscribeContent />
      </Suspense>
    </main>
  );
}
