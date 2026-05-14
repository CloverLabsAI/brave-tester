"use client";

import { CheckCategory } from "./CheckCategory";
import type { ProfileResult } from "@/lib/types";

interface ResultCardProps {
  profileResult: ProfileResult;
}

const gradeColors: Record<string, string> = {
  A: "from-emerald-500 to-green-600",
  B: "from-cyan-500 to-teal-600",
  C: "from-yellow-500 to-amber-600",
  D: "from-orange-500 to-orange-600",
  F: "from-red-500 to-red-600",
};

export function ResultCard({ profileResult }: ResultCardProps) {
  const { profile, results, matchResults, grade, passCount, totalChecks, error } = profileResult;

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-6">
        <h3 className="font-bold text-red-400">{profile.name}</h3>
        <p className="text-sm text-red-400/70 mt-2">{error}</p>
      </div>
    );
  }

  if (!results) return null;

  const fp = results.fingerprints;
  const allCategories = { ...results.core, ...results.extended, ...results.workers };

  return (
    <div className="bg-[#1a1034] border border-[rgba(139,127,166,0.15)] rounded-xl overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-4 border-b border-[rgba(139,127,166,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradeColors[grade] || gradeColors.F} flex items-center justify-center`}>
            <span className="text-2xl font-bold text-white">{grade}</span>
          </div>
          <div>
            <h3 className="font-bold text-[#e0daf0]">{profile.name}</h3>
            <p className="text-xs text-[#8b7fa6]">
              {passCount}/{totalChecks} passed
              <span className={`ml-2 px-1.5 py-0.5 rounded ${
                profile.mode === "per-context"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "bg-purple-500/10 text-purple-400"
              }`}>
                {profile.mode === "per-context" ? "per-context" : "global"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span
            className={`px-2 py-1 rounded ${results.webrtc.passed ? "bg-emerald-950/30 text-emerald-400" : "bg-red-950/30 text-red-400"}`}
            title={results.webrtc.detail}
          >
            WebRTC: {results.webrtc.passed ? "Clean" : "Leak"}
          </span>
          <span
            className={`px-2 py-1 rounded ${results.stability.stable ? "bg-emerald-950/30 text-emerald-400" : "bg-red-950/30 text-red-400"}`}
            title={results.stability.detail}
          >
            Stable: {results.stability.stable ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* WebRTC / Stability failure details */}
      {(!results.webrtc.passed || !results.stability.stable) && (
        <div className="px-4 py-3 border-b border-[rgba(139,127,166,0.1)] space-y-1">
          {!results.webrtc.passed && (
            <p className="text-xs text-red-400">
              <span className="font-bold">WebRTC:</span> {results.webrtc.detail}
            </p>
          )}
          {!results.stability.stable && (
            <p className="text-xs text-red-400">
              <span className="font-bold">Stability:</span> {results.stability.detail}
            </p>
          )}
        </div>
      )}

      {/* Match Results (expected vs actual) */}
      {matchResults.length > 0 && (
        <div className="p-4 border-b border-[rgba(139,127,166,0.1)]">
          <h4 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider mb-2">
            Config Match Verification
          </h4>
          <div className="space-y-1">
            {matchResults.map(m => (
              <div key={m.name} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#0d0919]/30">
                <span className="font-mono text-[#e0daf0]">{m.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#8b7fa6] truncate max-w-[200px]" title={m.actual}>
                    {m.actual}
                  </span>
                  <span className={`font-bold ${m.passed ? "text-emerald-400" : "text-red-400"}`}>
                    {m.passed ? "MATCH" : "MISMATCH"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fingerprint Summary */}
      <div className="p-4 border-b border-[rgba(139,127,166,0.1)]">
        <h4 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider mb-2">
          Collected Fingerprints
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-[#8b7fa6]">Platform</span>
            <p className="text-[#e0daf0] font-mono truncate">{fp.navigator.platform}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Screen</span>
            <p className="text-[#e0daf0] font-mono">{fp.screen.width}x{fp.screen.height}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Timezone</span>
            <p className="text-[#e0daf0] font-mono truncate">{fp.timezone.timezone}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">WebGL</span>
            <p className="text-[#e0daf0] font-mono truncate">{fp.webgl?.unmaskedRenderer?.substring(0, 30) || fp.webgl?.renderer?.substring(0, 30) || "N/A"}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Audio</span>
            <p className="text-[#e0daf0] font-mono">{fp.audio.hash}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Canvas</span>
            <p className="text-[#e0daf0] font-mono truncate">{fp.canvas.hash.substring(0, 20)}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Fonts</span>
            <p className="text-[#e0daf0] font-mono">{fp.fontAvailability.count} detected</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">HWC</span>
            <p className="text-[#e0daf0] font-mono">{fp.navigator.hardwareConcurrency}</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Voices</span>
            <p className="text-[#e0daf0] font-mono">{fp.speechVoices?.count ?? 0} voices</p>
          </div>
          <div>
            <span className="text-[#8b7fa6]">Device Memory</span>
            <p className="text-[#e0daf0] font-mono truncate">{fp.navigator.deviceMemory ?? "N/A"} GB</p>
          </div>
        </div>
      </div>

      {/* Detailed Check Results */}
      <div className="p-4 space-y-2">
        <h4 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider mb-2">
          Detailed Results
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
