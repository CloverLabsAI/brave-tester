import type { TestResults, CheckResult, CertificateData } from "./types";

const CATEGORY_LABELS: Record<string, string> = {
  automation: "Automation Detection",
  chromiumAPIs: "Chromium APIs",
  lieDetection: "Lie Detection",
  crossSignal: "Cross-Signal",
  cssFingerprint: "CSS Fingerprint",
  mathEngine: "Math Engine",
  permissionsAPI: "Permissions",
  speechVoices: "Speech Voices",
  performanceAPI: "Performance",
  intlConsistency: "Intl Consistency",
  emojiFingerprint: "Emoji",
  canvasNoiseDetection: "Canvas Noise",
  webglRenderHash: "WebGL Render",
  fontPlatformConsistency: "Font Platform",
  audioIntegrity: "Audio Integrity",
  iframeTesting: "Iframe Testing",
  workerConsistency: "Workers",
  headlessDetection: "Headless Detection",
  trashDetection: "Trash Detection",
  fontEnvironment: "Font Environment",
};

function countChecksInCategories(
  categories: Record<string, Record<string, CheckResult>>
): { passed: number; total: number } {
  let passed = 0;
  let total = 0;
  for (const cat of Object.values(categories)) {
    for (const check of Object.values(cat)) {
      if (check && typeof check.passed === "boolean") {
        total++;
        if (check.passed) passed++;
      }
    }
  }
  return { passed, total };
}

export function computeStats(results: TestResults) {
  const core = countChecksInCategories(results.core);
  const extended = countChecksInCategories(results.extended);
  const workers = countChecksInCategories(results.workers);

  let totalPassed = core.passed + extended.passed + workers.passed;
  let totalChecks = core.total + extended.total + workers.total;

  totalChecks++;
  if (results.webrtc.passed) totalPassed++;

  totalChecks++;
  if (results.stability.stable) totalPassed++;

  return { totalPassed, totalChecks };
}

export function computeSectionResults(
  results: TestResults
): { name: string; passed: number; total: number }[] {
  const sections: { name: string; passed: number; total: number }[] = [];

  const allCategories = { ...results.core, ...results.extended, ...results.workers };

  for (const [key, checks] of Object.entries(allCategories)) {
    if (key === "webglExtended") continue;
    let passed = 0;
    let total = 0;
    for (const check of Object.values(checks)) {
      if (check && typeof (check as CheckResult).passed === "boolean") {
        total++;
        if ((check as CheckResult).passed) passed++;
      }
    }
    if (total > 0) {
      sections.push({ name: CATEGORY_LABELS[key] || key, passed, total });
    }
  }

  sections.push({ name: "WebRTC", passed: results.webrtc.passed ? 1 : 0, total: 1 });
  sections.push({ name: "Stability", passed: results.stability.stable ? 1 : 0, total: 1 });

  return sections;
}

export function collectFailedTests(results: TestResults): string[] {
  const failed: string[] = [];

  const allCategories = { ...results.core, ...results.extended, ...results.workers };
  for (const [cat, checks] of Object.entries(allCategories)) {
    for (const [name, check] of Object.entries(checks)) {
      if (check && typeof (check as CheckResult).passed === "boolean" && !(check as CheckResult).passed) {
        failed.push(`${CATEGORY_LABELS[cat] || cat}: ${name} — ${(check as CheckResult).detail}`);
      }
    }
  }

  if (!results.webrtc.passed) {
    failed.push(`WebRTC: ${results.webrtc.detail}`);
  }
  if (!results.stability.stable) {
    failed.push("Stability: Fingerprints changed between runs (unstable)");
  }

  return failed;
}

export async function computeResultsHash(results: unknown): Promise<string> {
  const sorted = JSON.stringify(results);
  const encoder = new TextEncoder();
  const data = encoder.encode(sorted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildCertificatePayload(
  results: TestResults,
  resultsHash: string
): Omit<CertificateData, "id" | "signature"> {
  const { totalPassed, totalChecks } = computeStats(results);
  const sectionResults = computeSectionResults(results);
  const failedTests = collectFailedTests(results);

  return {
    timestamp: new Date().toISOString(),
    platform: results.fingerprints?.navigator?.platform || "unknown",
    braveVersion: extractBraveVersion(results.fingerprints?.navigator?.userAgent || ""),
    passCount: totalPassed,
    totalTests: totalChecks,
    overallPass: totalPassed === totalChecks,
    resultsHash,
    sectionResults,
    failedTests,
    profileCount: 1,
  };
}

function extractBraveVersion(ua: string): string {
  const match = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  return match ? `Chrome ${match[1]}` : ua.substring(0, 60);
}
