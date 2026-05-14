"use client";

import { useState, useCallback } from "react";
import { TestRunner } from "@/components/TestRunner";
import type { FullTestResult } from "@/lib/types";

export default function Home() {
  const [binaryPath, setBinaryPath] = useState("");
  const [numProfiles, setNumProfiles] = useState(4);
  const [testState, setTestState] = useState<"idle" | "running" | "complete">("idle");
  const [results, setResults] = useState<FullTestResult | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      const res = await fetch("/api/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildPlatform: typeof navigator !== "undefined" && navigator.userAgent.includes("Mac") ? "macos" : "linux" }),
      });
      const data = await res.json();
      if (data.path) setBinaryPath(data.path);
    } catch {}
    setBrowsing(false);
  };

  const handleComplete = useCallback((result: FullTestResult) => {
    setResults(result);
    setTestState("complete");
  }, []);

  return (
    <div className="space-y-8">
      {testState === "idle" && (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Stealth Test Runner</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Verify your Brave stealth build passes anti-detection checks. Runs seed-based
              profiles simultaneously and checks for fingerprint isolation, self-destruct,
              and cross-profile uniqueness.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Binary path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={binaryPath}
                  onChange={(e) => setBinaryPath(e.target.value)}
                  placeholder="/path/to/Brave.app/Contents/MacOS/Brave Browser Development"
                  className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-colors"
                />
                <button
                  onClick={handleBrowse}
                  disabled={browsing}
                  className="h-9 px-3 rounded-md border border-border text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {browsing ? "..." : "Browse"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Profiles</label>
              <div className="flex gap-1.5">
                {[4, 6, 8, 12].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumProfiles(n)}
                    className={`h-9 w-12 rounded-md text-sm transition-colors ${
                      numProfiles === n
                        ? "bg-[#FB542B] text-white"
                        : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {numProfiles} profiles &middot; simultaneous contexts &middot; cross-contamination check
              </p>
              <button
                onClick={() => { if (binaryPath.trim()) { setTestState("running"); setResults(null); } }}
                disabled={!binaryPath.trim()}
                className="h-9 px-4 rounded-md bg-[#FB542B] text-white text-sm font-medium hover:bg-[#e04a25] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Run tests
              </button>
            </div>
          </div>
        </>
      )}

      {testState !== "idle" && (
        <TestRunner
          binaryPath={binaryPath}
          numProfiles={numProfiles}
          running={testState === "running"}
          results={results}
          onComplete={handleComplete}
          onReset={() => { setTestState("idle"); setResults(null); }}
        />
      )}
    </div>
  );
}
