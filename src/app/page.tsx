import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white">
      <div className="max-w-md w-full p-8 border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Premium Telegram Channel</h1>
          <p className="text-zinc-400">Access premium content.</p>
        </div>
        
        <div className="text-4xl font-extrabold">
          $10 <span className="text-lg text-zinc-400 font-normal">/ month</span>
        </div>

        <Link href="/subscribe" className={buttonVariants({ variant: "default", className: "w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors" })}>
          Subscribe — $10
        </Link>
      </div>
    </main>
  );
}
