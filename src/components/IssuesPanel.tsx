"use client";

import { useMemo, useState } from "react";
import type { FullTestResult } from "@/lib/types";

interface Issue {
  check: string;
  category: string;
  detail: string;
  severity: "critical" | "high" | "medium";
  affectedProfiles: string[];
}

const SEVERITY_MAP: Record<string, "critical" | "high" | "medium"> = {
  automation: "critical",
  chromiumAPIs: "high",
  lieDetection: "critical",
  crossSignal: "high",
  headlessDetection: "critical",
  trashDetection: "medium",
  webrtc: "critical",
  audioIntegrity: "high",
  canvasNoiseDetection: "high",
  cssFingerprint: "high",
  fontEnvironment: "medium",
  fontPlatformConsistency: "medium",
  speechVoices: "medium",
  permissionsAPI: "medium",
  performanceAPI: "medium",
  mathEngine: "medium",
  intlConsistency: "medium",
  emojiFingerprint: "medium",
  webglRenderHash: "high",
  iframeTesting: "high",
  workerConsistency: "high",
};

const SEVERITY_STYLES = {
  critical: { label: "Critical", text: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
  high: { label: "High", text: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-500" },
  medium: { label: "Medium", text: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
};

export function IssuesPanel({ results }: { results: FullTestResult }) {
  const [copied, setCopied] = useState(false);

  const issues = useMemo(() => {
    const issueMap = new Map<string, Issue>();

    for (const pr of results.profiles) {
      if (!pr.results) continue;

      const allCategories = { ...pr.results.core, ...pr.results.extended, ...pr.results.workers };
      for (const [cat, checks] of Object.entries(allCategories)) {
        for (const [name, check] of Object.entries(checks)) {
          if (!check || typeof check.passed !== "boolean" || check.passed) continue;
          const key = `${cat}::${name}`;
          const existing = issueMap.get(key);
          if (existing) {
            if (!existing.affectedProfiles.includes(pr.profile.name)) existing.affectedProfiles.push(pr.profile.name);
          } else {
            issueMap.set(key, { check: name, category: cat, detail: check.detail, severity: SEVERITY_MAP[cat] || "medium", affectedProfiles: [pr.profile.name] });
          }
        }
      }

      if (!pr.results.webrtc.passed) {
        const key = "webrtc::leak";
        const existing = issueMap.get(key);
        if (existing) { if (!existing.affectedProfiles.includes(pr.profile.name)) existing.affectedProfiles.push(pr.profile.name); }
        else { issueMap.set(key, { check: "WebRTC IP Leak", category: "webrtc", detail: pr.results.webrtc.detail, severity: "critical", affectedProfiles: [pr.profile.name] }); }
      }

      if (!pr.results.stability.stable) {
        const key = "stability::drift";
        const existing = issueMap.get(key);
        if (existing) { if (!existing.affectedProfiles.includes(pr.profile.name)) existing.affectedProfiles.push(pr.profile.name); }
        else { issueMap.set(key, { check: "Fingerprint Stability", category: "stability", detail: pr.results.stability.detail, severity: "critical", affectedProfiles: [pr.profile.name] }); }
      }

      for (const m of pr.matchResults) {
        if (m.passed) continue;
        const key = `match::${m.name}`;
        const existing = issueMap.get(key);
        if (existing) { if (!existing.affectedProfiles.includes(pr.profile.name)) existing.affectedProfiles.push(pr.profile.name); }
        else { issueMap.set(key, { check: m.name, category: "configMatch", detail: `expected ${m.expected}, got ${m.actual}`, severity: "high", affectedProfiles: [pr.profile.name] }); }
      }
    }

    const all = Array.from(issueMap.values());
    all.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity]) - ({ critical: 0, high: 1, medium: 2 }[b.severity]));
    return all;
  }, [results]);

  if (issues.length === 0) return null;

  const braveVersion = results.profiles.find(p => p.results)?.results?.fingerprints?.navigator?.userAgent || "unknown";
  const totalProfiles = results.profiles.length;

  const generatePrompt = () => {
    const grouped = { critical: issues.filter(i => i.severity === "critical"), high: issues.filter(i => i.severity === "high"), medium: issues.filter(i => i.severity === "medium") };
    let prompt = `## Brave Stealth Build Issues\n\nThe following issues were detected by brave-tester running against the CloverLabs Brave fork.\n**User Agent:** ${braveVersion}\n**Profiles tested:** ${totalProfiles}\n**Total issues:** ${issues.length}\n\n`;
    for (const [severity, list] of Object.entries(grouped)) {
      if (list.length === 0) continue;
      prompt += `### ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${list.length})\n\n`;
      for (const issue of list) {
        prompt += `**${issue.category} > ${issue.check}**\nDetection: ${issue.detail}\nAffected: ${issue.affectedProfiles.length}/${totalProfiles} profiles\n\n`;
      }
    }
    prompt += `---\n\n### Instructions\n\nFix these issues in the CloverLabsAI/brave-core C++ source. The stealth docs are in \`stealth_docs/\`.\n\nEach fix should modify the browser engine at the C++ level (not JavaScript injection) to ensure native-level stealth. Brave's fingerprinting is controlled by \`BraveSessionCache\` in \`third_party/blink/renderer/core/farbling/brave_session_cache.cc\`. The JavaScript API (setFingerprintingSeed, setWebRTCIPv4, setTimezone) is installed via \`fingerprinting_overrides_installer.cc\`.\n\nAfter fixing, test your changes by running brave-tester (\`npm run dev\` in CloverLabsAI/brave-tester) and verifying all checks pass.\n`;
    return prompt;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const counts = { critical: issues.filter(i => i.severity === "critical").length, high: issues.filter(i => i.severity === "high").length, medium: issues.filter(i => i.severity === "medium").length };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-muted-foreground">
          Issues ({issues.length})
        </h3>
        <button
          onClick={handleCopy}
          className="h-8 px-3 rounded-md bg-[#FB542B] text-white text-xs font-medium hover:bg-[#e04a25] transition-colors"
        >
          {copied ? "Copied!" : "Copy agent prompt"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex gap-4 text-xs">
          {counts.critical > 0 && <span className="text-red-400">{counts.critical} critical</span>}
          {counts.high > 0 && <span className="text-orange-400">{counts.high} high</span>}
          {counts.medium > 0 && <span className="text-amber-400">{counts.medium} medium</span>}
        </div>

        <div className="divide-y divide-border">
          {issues.map((issue, i) => {
            const sev = SEVERITY_STYLES[issue.severity];
            return (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${sev.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-foreground">
                      <span className="text-muted-foreground">{issue.category}</span>
                      {" · "}
                      {issue.check}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{issue.detail}</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {issue.affectedProfiles.length}/{totalProfiles} profiles
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
