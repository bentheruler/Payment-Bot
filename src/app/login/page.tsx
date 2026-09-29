"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function SubscribePage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Generate the connection token on mount
    const fetchToken = async () => {
      try {
        const res = await fetch("/api/auth/session", { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate session");
        const data = await res.json();
        setToken(data.token);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    };

    fetchToken();
  }, []);

  useEffect(() => {
    if (!token) return;

    // Start polling status
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/auth/session/status?token=${token}`);
        if (!res.ok) {
           if (res.status === 401) {
             // Stop polling if expired or invalid
             if (pollingRef.current) clearInterval(pollingRef.current);
             setError("Session expired or invalid. Please refresh.");
           }
           return;
        }

        const data = await res.json();
        if (data.status === "AUTHENTICATED") {
          // Success! Redirect to subscribe
          if (pollingRef.current) clearInterval(pollingRef.current);
          // Token is now set securely as an HttpOnly cookie.
          router.push(`/subscribe`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(pollStatus, 2000);

    // Stop polling after 5 minutes (300,000 ms)
    const timeout = setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        setError("Session timed out. Please refresh.");
      }
    }, 5 * 60 * 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeout);
    };
  }, [token, router]);

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME;
  const telegramLink = token && botUsername ? `https://t.me/${botUsername}?start=${token}` : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white">
      <div className="max-w-md w-full p-8 border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl flex flex-col items-center text-center space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Connect Telegram</h1>
        
        {error ? (
           <div className="text-red-400 p-4 bg-red-900/20 rounded-md">
             {error}
           </div>
        ) : !token ? (
           <div className="flex flex-col items-center space-y-4">
             <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
             <p className="text-zinc-400">Generating secure connection...</p>
           </div>
        ) : (
           <div className="flex flex-col items-center space-y-6 w-full">
             <p className="text-zinc-400 text-sm">
               To continue your subscription, please link your Telegram account so we can grant you channel access.
             </p>
             
             {telegramLink ? (
                <Link 
                  href={telegramLink}
                  target="_blank"
                  className={buttonVariants({ variant: "default", className: "w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors" })}
                >
                  Open Telegram Bot
                </Link>
             ) : (
                <p className="text-red-400">Bot username is not configured.</p>
             )}

             <div className="flex items-center space-x-2 text-zinc-500 text-sm">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span>Waiting for authentication...</span>
             </div>
           </div>
        )}
      </div>
    </main>
  );
}
