"use client";

import { useEffect, useState, useRef } from "react";
import { ProgressPanel } from "./ProgressPanel";
import { ResultCard } from "./ResultCard";
import { Certificate } from "./Certificate";
import { IssuesPanel } from "./IssuesPanel";
import type { FullTestResult, ProfileResult, SSEEvent } from "@/lib/types";

interface TestRunnerProps {
  binaryPath: string;
  running: boolean;
  results: FullTestResult | null;
  onComplete: (result: FullTestResult) => void;
  onReset: () => void;
}

export function TestRunner({ binaryPath, running, results, onComplete, onReset }: TestRunnerProps) {
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([]);
  const [currentProfile, setCurrentProfile] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running) return;

    setProfileResults([]);
    setCurrentProfile(null);
    setCurrentIndex(0);
    setError(null);
    setSelectedProfile(null);

    const abort = new AbortController();
    abortRef.current = abort;

    async function runTests() {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ binaryPath }),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          setError("Failed to start tests");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventType = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6)) as SSEEvent;
                if (data.type === "progress") {
                  setCurrentProfile(data.profileName);
                  setCurrentIndex(data.profileIndex);
                  setTotalProfiles(data.total);
                } else if (data.type === "profile-complete") {
                  setProfileResults(prev => [...prev, data.result]);
                } else if (data.type === "complete") {
                  onCompleteRef.current(data.result);
                } else if (data.type === "error") {
                  setError(data.message);
                }
              } catch {}
              eventType = "";
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Test run failed");
        }
      }
    }

    runTests();
    return () => { abort.abort(); };
  }, [running, binaryPath]);

  if (running && !error) {
    return (
      <ProgressPanel
        currentProfile={currentProfile}
        currentIndex={currentIndex}
        totalProfiles={totalProfiles}
        completedProfiles={profileResults}
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm font-medium text-destructive">Test failed</p>
          <p className="text-sm text-destructive/70 mt-1">{error}</p>
        </div>
        <button
          onClick={onReset}
          className="h-9 px-4 rounded-md border border-border text-sm hover:bg-accent transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (results) {
    const passRate = Math.round((results.totalPassed / results.totalChecks) * 100);
    const allPassed = results.totalPassed === results.totalChecks;

    return (
      <div className="space-y-8">
        {/* Summary */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {results.totalPassed}
              <span className="text-muted-foreground font-normal">/{results.totalChecks}</span>
            </h2>
            <span className={`text-sm font-medium ${allPassed ? "text-emerald-400" : "text-[#FB542B]"}`}>
              {passRate}% pass rate
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {results.profiles.length} profiles tested
            {allPassed ? " — all checks passed" : ""}
          </p>
        </div>

        {/* Profile cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Profiles
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {results.profiles.map((pr, i) => (
              <button
                key={i}
                onClick={() => setSelectedProfile(selectedProfile === i ? null : i)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedProfile === i
                    ? "border-[#FB542B]/50 bg-[#FB542B]/5"
                    : "border-border hover:border-border/80 bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-mono">
                    {pr.profile.name}
                  </span>
                  <span className={`text-xs font-medium ${
                    pr.error ? "text-destructive" : pr.grade === "A" ? "text-emerald-400" : "text-[#FB542B]"
                  }`}>
                    {pr.error ? "ERR" : pr.grade}
                  </span>
                </div>
                {!pr.error && (
                  <p className="text-xs text-muted-foreground">
                    {pr.passCount}/{pr.totalChecks}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected profile detail */}
        {selectedProfile !== null && results.profiles[selectedProfile] && (
          <ResultCard profileResult={results.profiles[selectedProfile]} />
        )}

        {/* Issues */}
        <IssuesPanel results={results} />

        {/* Certificate */}
        <Certificate results={results} />

        {/* Actions */}
        <div className="flex justify-start">
          <button
            onClick={onReset}
            className="h-9 px-4 rounded-md border border-border text-sm hover:bg-accent transition-colors"
          >
            Run again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
