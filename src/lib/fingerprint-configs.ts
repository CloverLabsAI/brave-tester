// Brave profile configurations for testing.
// Each profile only needs a seed - the browser derives all surfaces internally.
// This file is kept for reference/UI but the actual profiles are generated
// dynamically in the run route with random seeds.

import type { ProfileConfig } from "./types";

const TEST_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
];

export function generateTestProfiles(count: number = 4): ProfileConfig[] {
  const os = typeof process !== "undefined" && process.platform === "darwin" ? "macos" : "linux";
  return Array.from({ length: count }, (_, i) => ({
    name: `Profile ${String.fromCharCode(65 + i)}`,
    os: os as "macos" | "linux",
    mode: "per-context" as const,
    fingerprintingSeed: Math.floor(Math.random() * 0xFFFFFFFF) + 1,
    timezone: TEST_TIMEZONES[i % TEST_TIMEZONES.length]!,
    webrtcIP: "203.0.113.1",
  }));
}
