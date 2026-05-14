"use client";

import { useState, useCallback } from "react";
import { TestRunner } from "@/components/TestRunner";
import type { FullTestResult } from "@/lib/types";

type BuildPlatform = "windows" | "linux" | "macos";

function detectPlatform(): BuildPlatform {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  return "linux";
}

export default function Home() {
  const [binaryPath, setBinaryPath] = useState("");
  const [buildPlatform, setBuildPlatform] = useState<BuildPlatform>(detectPlatform);
  const [testState, setTestState] = useState<"idle" | "running" | "complete">("idle");
  const [results, setResults] = useState<FullTestResult | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      const res = await fetch("/api/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildPlatform }),
      });
      const data = await res.json();
      if (data.path) {
        setBinaryPath(data.path);
      }
    } catch {
      // Dialog failed or unavailable - user can type manually
    }
    setBrowsing(false);
  };

  const handleRunTests = () => {
    if (!binaryPath.trim()) return;
    setTestState("running");
    setResults(null);
  };

  const handleComplete = useCallback((result: FullTestResult) => {
    setResults(result);
    setTestState("complete");
  }, []);

  const handleReset = () => {
    setTestState("idle");
    setResults(null);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
          Brave Build Tester
        </h1>
        <p className="text-[#8b7fa6] max-w-2xl mx-auto text-sm">
          Verify your Brave stealth build passes all anti-detection checks across
          multiple seed-based profiles. Tests per-context fingerprint isolation,
          self-destruct, and cross-profile uniqueness.
        </p>
      </div>

      {/* Binary Picker */}
      {testState === "idle" && (
        <div className="bg-[#1a1034] border border-[rgba(139,127,166,0.15)] rounded-xl p-6 space-y-4">
          {/* Build Platform Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#e0daf0]">
              Build Platform
            </label>
            <p className="text-xs text-[#8b7fa6]">
              Which platform was this Brave binary built for?
            </p>
            <div className="flex gap-2">
              {([
                { value: "linux" as const, label: "Linux" },
                { value: "macos" as const, label: "macOS" },
                { value: "windows" as const, label: "Windows" },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setBuildPlatform(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    buildPlatform === value
                      ? "bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-400/50 text-cyan-400"
                      : "bg-[#241b3d]/50 border border-[rgba(139,127,166,0.15)] text-[#8b7fa6] hover:text-[#e0daf0] hover:border-[rgba(139,127,166,0.3)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Binary Path */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#e0daf0]">
              Brave Binary Path
            </label>
            <p className="text-xs text-[#8b7fa6]">
              {buildPlatform === "macos"
                ? "Select the Brave.app bundle or the binary inside it"
                : "Select your built Brave browser executable"}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={binaryPath}
                onChange={(e) => setBinaryPath(e.target.value)}
                placeholder={
                  buildPlatform === "macos"
                    ? "~/Downloads/Brave.app"
                    : buildPlatform === "linux"
                      ? "/home/user/brave/brave"
                      : "C:\\path\\to\\brave.exe"
                }
                className="flex-1 bg-[#0d0919] border border-[rgba(139,127,166,0.2)] rounded-lg px-4 py-2.5 text-sm text-[#e0daf0] placeholder:text-[#8b7fa6]/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono"
              />
              <button
                onClick={handleBrowse}
                disabled={browsing}
                className="px-4 py-2.5 bg-[#241b3d] hover:bg-[#2d2249] border border-[rgba(139,127,166,0.2)] rounded-lg text-sm text-[#e0daf0] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {browsing ? "Opening..." : "Browse"}
              </button>
            </div>
          </div>

          {/* Test Plan */}
          <div className="bg-[#0d0919]/50 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider">Test Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#241b3d]/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-medium text-[#e0daf0]">4 Seed-Based Profiles</span>
                </div>
                <p className="text-[#8b7fa6]">Each profile gets a unique seed. The browser derives all fingerprint surfaces (canvas, audio, WebGL, screen) from that seed internally.</p>
              </div>
              <div className="bg-[#241b3d]/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  <span className="font-medium text-[#e0daf0]">Cross-Profile Verification</span>
                </div>
                <p className="text-[#8b7fa6]">Profiles run simultaneously to detect cross-context contamination. Different seeds should produce different fingerprints.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleRunTests}
              disabled={!binaryPath.trim()}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#0d0919] font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              Run All Tests (4 Profiles)
            </button>
          </div>
        </div>
      )}

      {/* Test Runner (handles running + results) */}
      {testState !== "idle" && (
        <TestRunner
          binaryPath={binaryPath}
          running={testState === "running"}
          results={results}
          onComplete={handleComplete}
          onReset={handleReset}
        />
      )}

      {/* How to use */}
      {testState === "idle" && (
        <div className="text-center space-y-2 pt-8 border-t border-[rgba(139,127,166,0.1)]">
          <h2 className="text-sm font-bold text-[#8b7fa6]">How to use</h2>
          <ol className="text-xs text-[#8b7fa6]/80 space-y-1 max-w-lg mx-auto text-left list-decimal list-inside">
            <li>Build the Brave stealth fork from source</li>
            <li>Enter or browse to your Brave binary path above</li>
            <li>Click &quot;Run All Tests&quot; to test 4 profiles with unique seeds</li>
            <li>Review results - all profiles should pass for a clean build</li>
            <li>Download the certificate to attach to your PR</li>
          </ol>
        </div>
      )}
    </div>
  );
}
