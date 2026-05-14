// Brave stealth tester - server-side test orchestrator
// Launches Brave profiles with unique seeds, runs fingerprint checks, collects results.
// Unlike the Camoufox tester, Brave only needs a single setFingerprintingSeed() call
// per context - the browser engine derives all surfaces from the seed internally.

import type { ProfileConfig, ProfileResult, MatchCheckResult, TestResults, FullTestResult, CrossProfileAnalysis } from "@/lib/types";
import { openSync, readSync, closeSync } from "node:fs";

export const maxDuration = 300;

const TEST_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "America/Denver",
  "Australia/Sydney",
];

// RFC 5737 TEST-NET-3 - reserved for documentation/testing
const WEBRTC_TEST_IP = "203.0.113.1";

const NUM_PROFILES = 4;

function sendSSE(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function computeGrade(passCount: number, totalChecks: number): string {
  const failCount = totalChecks - passCount;
  if (failCount === 0) return "A";
  if (failCount <= 2) return "B";
  if (failCount <= 5) return "C";
  if (failCount <= 10) return "D";
  return "F";
}

function countChecks(categories: Record<string, Record<string, { passed: boolean }>>): { passed: number; total: number } {
  let passed = 0, total = 0;
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

// Generate a Brave profile config from a seed
function generateBraveProfile(
  index: number,
  name: string,
): ProfileConfig {
  const seed = Math.floor(Math.random() * 0xFFFFFFFF) + 1;
  const timezone = TEST_TIMEZONES[index % TEST_TIMEZONES.length]!;

  return {
    name,
    os: process.platform === "darwin" ? "macos" : "linux",
    mode: "per-context",
    fingerprintingSeed: seed,
    timezone,
    webrtcIP: WEBRTC_TEST_IP,
  };
}

// Build the init script that Brave runs before any page scripts
function buildBraveInitScript(profile: ProfileConfig): string {
  return `
    try {
      if (typeof window.setFingerprintingSeed === 'function') {
        window.setFingerprintingSeed(${profile.fingerprintingSeed});
      }
      if (typeof window.setWebRTCIPv4 === 'function') {
        window.setWebRTCIPv4(${JSON.stringify(profile.webrtcIP || '')});
      }
      if (typeof window.setTimezone === 'function') {
        window.setTimezone(${JSON.stringify(profile.timezone)});
      }
    } catch(e) {}
  `;
}

function computeMatchResults(profile: ProfileConfig, results: TestResults): MatchCheckResult[] {
  const matches: MatchCheckResult[] = [];
  const fp = results.fingerprints;

  // Brave's seed determines screen/WebGL/etc internally - we can only verify
  // timezone (which we set) and that fingerprints are consistent.
  matches.push({
    name: "timezone",
    passed: fp.timezone.timezone === profile.timezone,
    expected: profile.timezone,
    actual: fp.timezone.timezone,
  });

  // Self-destruct: setFingerprintingSeed should no longer exist
  matches.push({
    name: "self-destruct:setFingerprintingSeed",
    passed: !fp.selfDestruct?.setFingerprintingSeed,
    expected: "undefined",
    actual: fp.selfDestruct?.setFingerprintingSeed ? "function" : "undefined",
  });

  matches.push({
    name: "self-destruct:setWebRTCIPv4",
    passed: !fp.selfDestruct?.setWebRTCIPv4,
    expected: "undefined",
    actual: fp.selfDestruct?.setWebRTCIPv4 ? "function" : "undefined",
  });

  matches.push({
    name: "self-destruct:setTimezone",
    passed: !fp.selfDestruct?.setTimezone,
    expected: "undefined",
    actual: fp.selfDestruct?.setTimezone ? "function" : "undefined",
  });

  return matches;
}

function computeCrossProfile(profiles: ProfileResult[]): CrossProfileAnalysis {
  const ctx = profiles.filter(p => !p.error);

  function analyze(group: ProfileResult[]) {
    const audio = new Set(group.map(p => p.results?.fingerprints?.audio?.hash).filter(Boolean));
    const canvas = new Set(group.map(p => p.results?.fingerprints?.canvas?.hash).filter(Boolean));
    const fonts = new Set(group.map(p => p.results?.fingerprints?.fonts?.hash).filter(Boolean));
    const timezones = new Set(group.map(p => p.results?.fingerprints?.timezone?.timezone).filter(Boolean));
    const screens = new Set(group.map(p => {
      const s = p.results?.fingerprints?.screen;
      return s ? `${s.width}x${s.height}` : null;
    }).filter(Boolean));
    const voices = new Set(group.map(p => p.results?.fingerprints?.speechVoices?.hash).filter(Boolean));
    const webgl = new Set(group.map(p => {
      const w = p.results?.fingerprints?.webgl;
      return w ? `${w.unmaskedVendor}|${w.unmaskedRenderer}` : null;
    }).filter(Boolean));
    const platforms = new Set(group.map(p => p.results?.fingerprints?.navigator?.platform).filter(Boolean));
    return { uniqueAudio: audio.size, uniqueCanvas: canvas.size, uniqueFonts: fonts.size, uniqueTimezones: timezones.size, uniqueScreens: screens.size, uniqueVoices: voices.size, uniqueWebGL: webgl.size, uniquePlatforms: platforms.size, total: group.length };
  }

  return { macPerContext: analyze(ctx), linuxPerContext: analyze([]) };
}

// Detect Mach-O binary (macOS .app)
function isMachO(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(4);
    const fd = openSync(filePath, "r");
    readSync(fd, buf, 0, 4, 0);
    // Mach-O magic: 0xFEEDFACE (32), 0xFEEDFACF (64), 0xCAFEBABE (universal)
    const magic = buf.readUInt32BE(0);
    return magic === 0xFEEDFACE || magic === 0xFEEDFACF || magic === 0xCAFEBABE ||
      magic === 0xCEFAEDFE || magic === 0xCFFAEDFE; // little-endian variants
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const { binaryPath } = await request.json();

  if (!binaryPath) {
    return new Response(JSON.stringify({ error: "binaryPath required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const testPageUrl = `${url.protocol}//${host}/test`;

  const stream = new ReadableStream({
    async start(controller) {
      const { chromium } = await import("playwright-core");

      const profileResults: ProfileResult[] = [];

      try {
        // Generate profiles with unique seeds
        const profiles: ProfileConfig[] = [];
        for (let i = 0; i < NUM_PROFILES; i++) {
          profiles.push(generateBraveProfile(i, `Profile ${String.fromCharCode(65 + i)}`));
        }

        sendSSE(controller, "progress", {
          type: "progress",
          profileIndex: 0,
          profileName: "Launching Brave browser...",
          phase: "launch",
          total: NUM_PROFILES,
        });

        // Launch Brave
        let browser;
        try {
          browser = await chromium.launch({
            executablePath: binaryPath,
            headless: false,
          });
        } catch (launchErr: any) {
          sendSSE(controller, "error", {
            type: "error",
            message: `Failed to launch Brave: ${launchErr.message}`,
          });
          controller.close();
          return;
        }

        // Create all contexts simultaneously to catch cross-contamination
        const openContexts: { context: any; page: any; profile: ProfileConfig }[] = [];

        sendSSE(controller, "progress", {
          type: "progress",
          profileIndex: 0,
          profileName: "Creating all profiles simultaneously...",
          phase: "testing",
          total: NUM_PROFILES,
        });

        for (let i = 0; i < profiles.length; i++) {
          const profile = profiles[i]!;
          try {
            // Brave contexts get no UA/viewport/screen overrides - seed handles it
            const context = await browser.newContext({
              timezoneId: profile.timezone,
            });
            await context.addInitScript(buildBraveInitScript(profile));
            const page = await context.newPage();
            openContexts.push({ context, page, profile });
          } catch (err: any) {
            profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: err.message });
            sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: i, result: profileResults[profileResults.length - 1] });
          }
        }

        // Navigate and run tests concurrently
        await Promise.all(openContexts.map(({ page }) =>
          page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
        ));
        await Promise.all(openContexts.map(({ page }) =>
          page.waitForFunction("!!window.__testComplete__", { timeout: 120000 }).catch(() => {})
        ));

        // Collect results from all contexts
        for (let i = 0; i < openContexts.length; i++) {
          const { page, profile } = openContexts[i]!;

          sendSSE(controller, "progress", {
            type: "progress",
            profileIndex: i,
            profileName: profile.name,
            phase: "testing",
            total: NUM_PROFILES,
          });

          try {
            const testError = await page.evaluate(() => (window as any).__testError__);
            if (testError) {
              profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: testError });
            } else {
              const results: TestResults = await page.evaluate(() => (window as any).__testResults__);
              const matchResults = computeMatchResults(profile, results);
              const checks = countChecks(results.core);
              const extChecks = countChecks(results.extended);
              const workerChecks = countChecks(results.workers);
              let passCount = checks.passed + extChecks.passed + workerChecks.passed;
              let totalChecks = checks.total + extChecks.total + workerChecks.total;
              totalChecks++; if (results.webrtc.passed) passCount++;
              totalChecks++; if (results.stability.stable) passCount++;
              for (const m of matchResults) { totalChecks++; if (m.passed) passCount++; }
              profileResults.push({ profile, results, matchResults, grade: computeGrade(passCount, totalChecks), passCount, totalChecks });
            }
          } catch (err: any) {
            profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: err.message });
          }

          sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: i, result: profileResults[profileResults.length - 1] });
        }

        // Cross-context re-verification after 5s delay
        if (openContexts.length > 1) {
          sendSSE(controller, "progress", {
            type: "progress",
            profileIndex: 0,
            profileName: "Re-verifying all contexts after 5 seconds...",
            phase: "testing",
            total: NUM_PROFILES,
          });

          await new Promise(resolve => setTimeout(resolve, 5000));

          const reVerifyScript = `(() => ({
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
          }))()`;

          for (let i = 0; i < openContexts.length; i++) {
            const { page, profile } = openContexts[i]!;
            const profileResult = profileResults.find(r => r.profile === profile);
            if (!profileResult || !profileResult.results) continue;

            try {
              const recheck = await page.evaluate(reVerifyScript) as {
                platform: string; hardwareConcurrency: number;
                timezone: string; screenWidth: number; screenHeight: number; colorDepth: number;
              };

              const original = profileResult.results.fingerprints;
              const drifted: string[] = [];

              if (recheck.platform !== original.navigator.platform) drifted.push(`platform: ${original.navigator.platform} -> ${recheck.platform}`);
              if (recheck.hardwareConcurrency !== original.navigator.hardwareConcurrency) drifted.push(`hwc: ${original.navigator.hardwareConcurrency} -> ${recheck.hardwareConcurrency}`);
              if (recheck.timezone !== original.timezone.timezone) drifted.push(`timezone: ${original.timezone.timezone} -> ${recheck.timezone}`);
              if (recheck.screenWidth !== original.screen.width) drifted.push(`screenWidth: ${original.screen.width} -> ${recheck.screenWidth}`);
              if (recheck.screenHeight !== original.screen.height) drifted.push(`screenHeight: ${original.screen.height} -> ${recheck.screenHeight}`);

              if (drifted.length > 0) {
                profileResult.results.stability.stable = false;
                profileResult.results.stability.detail = `Cross-context drift after 5s: ${drifted.join(", ")}`;
                profileResult.passCount--;
                profileResult.grade = computeGrade(profileResult.passCount, profileResult.totalChecks);
                sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: i, result: profileResult });
              }
            } catch {}
          }
        }

        // Close all contexts
        for (const { context } of openContexts) {
          await context.close().catch(() => {});
        }
        await browser.close();

        // Cross-profile analysis and final results
        const crossProfile = computeCrossProfile(profileResults);
        const totalPassed = profileResults.reduce((sum, p) => sum + p.passCount, 0);
        const totalChecks = profileResults.reduce((sum, p) => sum + p.totalChecks, 0);

        const fullResult: FullTestResult = {
          profiles: profileResults,
          crossProfile,
          overallGrade: computeGrade(totalPassed, totalChecks),
          totalPassed,
          totalChecks,
          timestamp: new Date().toISOString(),
          binaryPath,
        };

        sendSSE(controller, "complete", { type: "complete", result: fullResult });
      } catch (err: any) {
        sendSSE(controller, "error", { type: "error", message: err.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
