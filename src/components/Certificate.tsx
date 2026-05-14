"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawCertificate } from "@/lib/certificate-utils";
import { computeSectionResults, collectFailedTests, computeResultsHash } from "@/lib/analysis";
import type { FullTestResult, CertificateData } from "@/lib/types";

export function Certificate({ results }: { results: FullTestResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const allSectionResults: { name: string; passed: number; total: number }[] = [];
      const allFailedTests: string[] = [];

      for (const pr of results.profiles) {
        if (!pr.results) { allFailedTests.push(`${pr.profile.name}: Error - ${pr.error}`); continue; }
        const sections = computeSectionResults(pr.results);
        for (const s of sections) {
          const existing = allSectionResults.find(e => e.name === s.name);
          if (existing) { existing.passed += s.passed; existing.total += s.total; }
          else { allSectionResults.push({ ...s }); }
        }
        const failed = collectFailedTests(pr.results);
        for (const f of failed) allFailedTests.push(`${pr.profile.name}: ${f}`);
        for (const m of pr.matchResults) {
          if (!m.passed) allFailedTests.push(`${pr.profile.name}: ${m.name} expected ${m.expected}, got ${m.actual}`);
        }
      }

      const cp = results.crossProfile;
      const macUnique = cp.macPerContext.total > 0
        ? [cp.macPerContext.uniqueAudio, cp.macPerContext.uniqueCanvas, cp.macPerContext.uniqueTimezones, cp.macPerContext.uniqueScreens]
            .filter(v => v === cp.macPerContext.total).length : 0;
      if (cp.macPerContext.total > 0) allSectionResults.push({ name: "Mac Uniqueness", passed: macUnique, total: 4 });

      const resultsHash = await computeResultsHash({
        profiles: results.profiles.map(p => ({ name: p.profile.name, grade: p.grade, passCount: p.passCount, totalChecks: p.totalChecks })),
        crossProfile: results.crossProfile, timestamp: results.timestamp,
      });

      const ua = results.profiles.find(p => p.results)?.results?.fingerprints?.navigator?.userAgent || "unknown";
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultsHash,
          payload: {
            timestamp: results.timestamp, platform: "Multi-OS",
            braveVersion: ua.substring(0, 60),
            passCount: results.totalPassed, totalTests: results.totalChecks,
            overallPass: results.totalPassed === results.totalChecks,
            sectionResults: allSectionResults, failedTests: allFailedTests.slice(0, 20),
            profileCount: results.profiles.length,
          },
        }),
      });
      setCertificate(await res.json());
    } catch (err: any) { console.error("Certificate generation failed:", err); }
    setGenerating(false);
  }, [results]);

  useEffect(() => {
    if (!certificate || !canvasRef.current) return;
    drawCertificate(canvasRef.current, { certificate, crossProfile: results.crossProfile }).catch(() => {});
  }, [certificate, results.crossProfile]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground">
        Certificate
      </h3>

      {!certificate && (
        <button
          onClick={generate}
          disabled={generating}
          className="h-9 px-4 rounded-md border border-border text-sm hover:bg-accent transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate certificate"}
        </button>
      )}

      {certificate && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <canvas ref={canvasRef} className="w-full block" />

          <div className="px-5 py-3 flex items-center justify-between border-t border-border">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>ID: <span className="font-mono text-foreground">{certificate.id}</span></p>
              <p>Hash: <span className="font-mono text-foreground">{certificate.resultsHash?.substring(0, 24)}...</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(certificate.id); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="h-8 px-3 rounded-md border border-border text-xs hover:bg-accent transition-colors"
              >
                {copied ? "Copied" : "Copy ID"}
              </button>
              <button
                onClick={() => {
                  canvasRef.current?.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `brave-cert-${certificate.id.slice(0, 8)}.png`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, "image/png");
                }}
                className="h-8 px-3 rounded-md bg-[#FB542B] text-white text-xs font-medium hover:bg-[#e04a25] transition-colors"
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
