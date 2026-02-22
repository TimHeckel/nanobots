"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [polling, setPolling] = useState(true);
  const [dots, setDots] = useState("");

  // Animate the loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll for org creation
  useEffect(() => {
    if (!polling) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.hasOrg) {
          setPolling(false);
          router.push("/chat");
        }
      } catch {
        // Silently retry on next interval
      }
    };

    // Poll immediately on mount
    poll();

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [polling, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12">
        <span className="font-mono font-bold text-3xl tracking-tight">
          <span className="text-brand">nano</span>
          <span className="text-foreground">bots</span>
          <span className="text-purple-accent">.sh</span>
        </span>
      </div>

      {/* Main card */}
      <div className="w-full max-w-lg rounded-2xl border border-purple-accent/20 bg-indigo-deep/60 backdrop-blur-sm p-10 text-center">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-4">
          Install the nanobots GitHub App
        </h1>

        <p className="text-foreground/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto font-mono">
          Connect your GitHub organization or account to activate your nanobots.
          Select which repositories you want to protect.
        </p>

        <a
          href="https://github.com/apps/nanobots-sh/installations/new"
          className="inline-block bg-brand text-background font-mono font-bold px-8 py-3 rounded-lg text-base hover:bg-brand/90 transition-all hover:shadow-[0_0_30px_rgba(232,123,53,0.2)]"
        >
          Install GitHub App
        </a>

        {/* Polling status */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-accent" />
            </span>
            <span className="font-mono text-sm text-foreground/40">
              Waiting for installation{dots}
            </span>
          </div>
          <p className="font-mono text-xs text-foreground/25">
            This page will redirect automatically once the app is installed
          </p>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-8 font-mono text-xs text-foreground/20">
        Already installed?{" "}
        <button
          onClick={() => router.push("/chat")}
          className="text-purple-accent/50 hover:text-purple-accent transition-colors underline underline-offset-2"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
