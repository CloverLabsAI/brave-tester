"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawCertificate } from "@/lib/certificate-utils";
import { computeStats, computeSectionResults, collectFailedTests, computeResultsHash } from "@/lib/analysis";
import type { FullTestResult, CertificateData } from "@/lib/types";

interface CertificateProps {
  results: FullTestResult;
}

export function Certificate({ results }: CertificateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      // Aggregate all profile results
      const allSectionResults: { name: string; passed: number; total: number }[] = [];
      const allFailedTests: string[] = [];

      for (const pr of results.profiles) {
        if (!pr.results) {
          allFailedTests.push(`${pr.profile.name}: Error - ${pr.error}`);
          continue;
        }
        const sections = computeSectionResults(pr.results);
        for (const s of sections) {
          const existing = allSectionResults.find(e => e.name === s.name);
          if (existing) {
            existing.passed += s.passed;
            existing.total += s.total;
          } else {
            allSectionResults.push({ ...s });
          }
        }
        const failed = collectFailedTests(pr.results);
        for (const f of failed) {
          allFailedTests.push(`${pr.profile.name}: ${f}`);
        }
        // Match failures
        for (const m of pr.matchResults) {
          if (!m.passed) {
            allFailedTests.push(`${pr.profile.name}: ${m.name} expected ${m.expected}, got ${m.actual}`);
          }
        }
      }

      // Cross-profile uniqueness section
      const cp = results.crossProfile;
      const macUnique = cp.macPerContext.total > 0
        ? (cp.macPerContext.uniqueAudio === cp.macPerContext.total ? 1 : 0)
        + (cp.macPerContext.uniqueCanvas === cp.macPerContext.total ? 1 : 0)
        + (cp.macPerContext.uniqueTimezones === cp.macPerContext.total ? 1 : 0)
        + (cp.macPerContext.uniqueScreens === cp.macPerContext.total ? 1 : 0)
        : 0;
      const linuxUnique = cp.linuxPerContext.total > 0
        ? (cp.linuxPerContext.uniqueAudio === cp.linuxPerContext.total ? 1 : 0)
        + (cp.linuxPerContext.uniqueCanvas === cp.linuxPerContext.total ? 1 : 0)
        + (cp.linuxPerContext.uniqueTimezones === cp.linuxPerContext.total ? 1 : 0)
        + (cp.linuxPerContext.uniqueScreens === cp.linuxPerContext.total ? 1 : 0)
        : 0;

      if (cp.macPerContext.total > 0) {
        allSectionResults.push({ name: "Mac Uniqueness", passed: macUnique, total: 4 });
      }
      if (cp.linuxPerContext.total > 0) {
        allSectionResults.push({ name: "Linux Uniqueness", passed: linuxUnique, total: 4 });
      }

      // Compute hash
      const resultsHash = await computeResultsHash({
        profiles: results.profiles.map(p => ({
          name: p.profile.name,
          grade: p.grade,
          passCount: p.passCount,
          totalChecks: p.totalChecks,
        })),
        crossProfile: results.crossProfile,
        timestamp: results.timestamp,
      });

      // Get signature from API
      const ua = results.profiles.find(p => p.results)?.results?.fingerprints?.navigator?.userAgent || "unknown";
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultsHash,
          payload: {
            timestamp: results.timestamp,
            platform: "Multi-OS",
            braveVersion: ua.substring(0, 60),
            passCount: results.totalPassed,
            totalTests: results.totalChecks,
            overallPass: results.totalPassed === results.totalChecks,
            sectionResults: allSectionResults,
            failedTests: allFailedTests.slice(0, 20),
            profileCount: results.profiles.length,
          },
        }),
      });

      const certData = await res.json();
      setCertificate(certData);
    } catch (err: any) {
      console.error("Certificate generation failed:", err);
    }
    setGenerating(false);
  }, [results]);

  useEffect(() => {
    if (!certificate || !canvasRef.current) return;

    drawCertificate(canvasRef.current, {
      certificate,
      crossProfile: results.crossProfile,
    }).catch(() => {});
  }, [certificate, results.crossProfile]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brave-certificate-${certificate?.id?.slice(0, 8) || "test"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [certificate]);

  const handleCopyId = useCallback(() => {
    if (!certificate?.id) return;
    navigator.clipboard.writeText(certificate.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [certificate]);

  return (
    <div className="space-y-4">
      {!certificate && (
        <div className="text-center">
          <button
            onClick={generate}
            disabled={generating}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#0d0919] font-bold rounded-lg transition-all disabled:opacity-50 text-sm"
          >
            {generating ? "Generating Certificate..." : "Generate Certificate"}
          </button>
        </div>
      )}

      {certificate && (
        <div className="bg-[#1a1034] border border-[rgba(139,127,166,0.15)] rounded-xl overflow-hidden">
          {/* Canvas */}
          <div className="bg-[#0d0919] p-4 flex justify-center">
            <canvas ref={canvasRef} className="max-w-full rounded-lg" />
          </div>

          {/* Actions */}
          <div className="p-4 flex items-center justify-between border-t border-[rgba(139,127,166,0.1)]">
            <div className="text-xs text-[#8b7fa6] space-y-1">
              <p>ID: <span className="font-mono text-[#e0daf0]">{certificate.id}</span></p>
              <p>Hash: <span className="font-mono text-[#e0daf0]">{certificate.resultsHash?.substring(0, 24)}...</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyId}
                className="px-4 py-2 bg-[#241b3d] hover:bg-[#2d2249] border border-[rgba(139,127,166,0.2)] rounded-lg text-xs text-[#e0daf0] transition-colors"
              >
                {copied ? "Copied!" : "Copy ID"}
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#0d0919] font-bold rounded-lg text-xs transition-all"
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
