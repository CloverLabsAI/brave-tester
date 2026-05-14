"use client";

import { CheckCategory } from "./CheckCategory";
import type { ProfileResult } from "@/lib/types";

export function ResultCard({ profileResult }: { profileResult: ProfileResult }) {
  const { profile, results, matchResults, grade, passCount, totalChecks, error } = profileResult;

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">{profile.name}</p>
        <p className="text-sm text-destructive/70 mt-1">{error}</p>
      </div>
    );
  }

  if (!results) return null;

  const fp = results.fingerprints;
  const allCategories = { ...results.core, ...results.extended, ...results.workers };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{profile.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {passCount}/{totalChecks} passed
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-1 rounded-md border ${
            results.webrtc.passed
              ? "border-emerald-500/20 text-emerald-400"
              : "border-destructive/20 text-destructive"
          }`}>
            WebRTC {results.webrtc.passed ? "clean" : "leak"}
          </span>
          <span className={`text-xs px-2 py-1 rounded-md border ${
            results.stability.stable
              ? "border-emerald-500/20 text-emerald-400"
              : "border-destructive/20 text-destructive"
          }`}>
            {results.stability.stable ? "Stable" : "Unstable"}
          </span>
        </div>
      </div>

      {/* Failure details */}
      {(!results.webrtc.passed || !results.stability.stable) && (
        <div className="px-5 py-3 border-b border-border space-y-1">
          {!results.webrtc.passed && (
            <p className="text-xs text-destructive">WebRTC: {results.webrtc.detail}</p>
          )}
          {!results.stability.stable && (
            <p className="text-xs text-destructive">Stability: {results.stability.detail}</p>
          )}
        </div>
      )}

      {/* Match verification */}
      {matchResults.length > 0 && (
        <div className="px-5 py-4 border-b border-border">
          <h4 className="text-sm text-muted-foreground mb-2">
            Verification
          </h4>
          <div className="space-y-1">
            {matchResults.map(m => (
              <div key={m.name} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-md bg-secondary/50">
                <span className="font-mono">{m.name}</span>
                <span className={`font-medium ${m.passed ? "text-emerald-400" : "text-destructive"}`}>
                  {m.passed ? "match" : "mismatch"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fingerprints */}
      <div className="px-5 py-4 border-b border-border">
        <h4 className="text-sm text-muted-foreground mb-3">
          Fingerprints
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-xs">
          {[
            ["Platform", fp.navigator.platform],
            ["Screen", `${fp.screen.width}×${fp.screen.height}`],
            ["Timezone", fp.timezone.timezone],
            ["HWC", String(fp.navigator.hardwareConcurrency)],
            ["Audio", fp.audio.hash],
            ["Canvas", fp.canvas.hash.substring(0, 16)],
            ["Fonts", `${fp.fontAvailability.count} detected`],
            ["Memory", fp.navigator.deviceMemory ? `${fp.navigator.deviceMemory} GB` : "N/A"],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-muted-foreground">{label}</span>
              <p className="font-mono text-foreground truncate mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed checks */}
      <div className="px-5 py-4 space-y-2">
        <h4 className="text-sm text-muted-foreground mb-2">
          Checks
        </h4>
        {Object.entries(allCategories).map(([category, checks]) => {
          if (category === "webglExtended") return null;
          const validChecks: Record<string, { passed: boolean; detail: string }> = {};
          for (const [k, v] of Object.entries(checks)) {
            if (v && typeof v === "object" && "passed" in v) {
              validChecks[k] = v as { passed: boolean; detail: string };
            }
          }
          if (Object.keys(validChecks).length === 0) return null;
          const hasFailure = Object.values(validChecks).some(c => !c.passed);
          return (
            <CheckCategory
              key={category}
              category={category}
              checks={validChecks}
              defaultOpen={hasFailure}
            />
          );
        })}
      </div>
    </div>
  );
}
