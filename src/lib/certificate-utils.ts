import type { CertificateData, CrossProfileAnalysis } from "./types";

export function generateVisualHashPattern(hash: string): { colors: string[]; grid: boolean[][] } {
  const bytes: number[] = [];
  for (let i = 0; i < Math.min(hash.length, 32); i += 2) {
    bytes.push(parseInt(hash.substring(i, i + 2), 16) || 0);
  }
  const colors = [
    `hsl(${14 + (bytes[0] || 0) % 12}, ${70 + (bytes[1] || 0) % 20}%, ${50 + (bytes[2] || 0) % 15}%)`,
    `hsl(${8 + (bytes[3] || 0) % 16}, ${65 + (bytes[4] || 0) % 25}%, ${45 + (bytes[5] || 0) % 18}%)`,
    `hsl(${20 + (bytes[6] || 0) % 10}, ${60 + (bytes[7] || 0) % 20}%, ${40 + (bytes[8] || 0) % 20}%)`,
  ];
  const grid: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < 5; col++) {
      const mirrorCol = col < 3 ? col : 4 - col;
      line.push((bytes[(row * 3 + mirrorCol) % bytes.length] || 0) > 128);
    }
    grid.push(line);
  }
  return { colors, grid };
}

interface DrawCertificateOptions {
  certificate: CertificateData;
  crossProfile?: CrossProfileAnalysis;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Load Geist fonts from Next.js font CSS — they're already loaded by the page
async function ensureFonts(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {}
}

// Font helpers — use CSS variable font family names that Next.js sets up
const SANS = "'__Geist_e531da', 'Geist', system-ui, sans-serif";
const MONO = "'__Geist_Mono_c3bc58', 'Geist Mono', ui-monospace, monospace";

export async function drawCertificate(canvas: HTMLCanvasElement, opts: DrawCertificateOptions) {
  await ensureFonts();

  const { certificate, crossProfile } = opts;
  // Fill parent width. canvas.clientWidth gives us the CSS-rendered width
  // after w-full is applied. Falls back to offsetWidth or parent measurement.
  const containerW = canvas.clientWidth || canvas.offsetWidth || canvas.parentElement?.clientWidth || 960;
  const W = containerW;
  const P = 40;
  const dpr = 2;

  // Calculate height dynamically based on content
  const sr = certificate.sectionResults;
  const secRows = Math.ceil(sr.length / 2);
  const issues = certificate.issues || [];
  const issueRows = Math.min(issues.length, 6) + (issues.length > 6 ? 1 : 0);

  const headerH = 44;
  const metaH = 80;
  const secH = 30 + secRows * 20;
  const hashRowH = 14 + 5 * 16 + 24; // hash grid + uniqueness
  const issueH = issues.length > 0 ? 30 + issueRows * 18 + 16 : 0;
  const bottomH = 70;
  const H = P + headerH + metaH + secH + hashRowH + issueH + bottomH + P;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = "";
  canvas.style.height = "";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const passed = certificate.overallPass;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  // ── Row 1: Logo + title + badge ──
  try {
    const logo = await loadImage("/brave-logo.svg");
    ctx.drawImage(logo, P + 1, P + 8, 22, 25);
  } catch {}

  ctx.font = `500 14px ${SANS}`;
  ctx.fillStyle = "#ededed";
  ctx.textAlign = "left";
  ctx.fillText("Brave Build Certificate", P + 30, P + 26);

  const badgeW = 72, badgeH = 24;
  const badgeX = W - P - badgeW;
  roundRect(ctx, badgeX, P + 8, badgeW, badgeH, 4);
  ctx.fillStyle = passed ? "#059669" : "#dc2626";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `600 11px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(passed ? "PASSED" : "FAILED", badgeX + badgeW / 2, P + 24);

  ctx.strokeStyle = "#1e1e1e";
  ctx.beginPath();
  ctx.moveTo(P, P + 44);
  ctx.lineTo(W - P, P + 44);
  ctx.stroke();

  // ── Row 2: Metadata ──
  ctx.textAlign = "left";
  const metaY = P + 60;
  const contentW = W - P * 2;

  // Row 1: ID, Issued, Profiles, Tests
  const row1Cols: [string, string, number][] = [
    ["ID", certificate.id, 0.42],
    ["Issued", new Date(certificate.timestamp).toLocaleDateString(), 0.22],
    ["Profiles", String(certificate.profileCount), 0.14],
    ["Tests", `${certificate.passCount}/${certificate.totalTests}`, 0.22],
  ];
  let rx = P;
  for (const [label, value, pct] of row1Cols) {
    const colW = contentW * pct;
    ctx.fillStyle = "#666";
    ctx.font = `400 10px ${SANS}`;
    ctx.fillText(label, rx, metaY);
    ctx.fillStyle = "#ccc";
    ctx.font = `400 11px ${MONO}`;
    ctx.fillText(truncate(ctx, value, colW - 12), rx, metaY + 15);
    rx += colW;
  }

  // Row 2: Build (full width)
  const buildY = metaY + 36;
  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${SANS}`;
  ctx.fillText("Build", P, buildY);
  ctx.fillStyle = "#ccc";
  ctx.font = `400 11px ${MONO}`;
  ctx.fillText(truncate(ctx, certificate.braveVersion, contentW - 12), P, buildY + 15);

  ctx.strokeStyle = "#1e1e1e";
  ctx.beginPath();
  ctx.moveTo(P, buildY + 28);
  ctx.lineTo(W - P, buildY + 28);
  ctx.stroke();

  // ── Sections (2 cols, full width) ──
  // Hash + uniqueness goes BELOW sections, not beside them
  const secY = buildY + 44;
  const secColW = (W - P * 2) / 2;

  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${SANS}`;
  ctx.fillText("Sections", P, secY);

  for (let i = 0; i < sr.length; i++) {
    const s = sr[i]!;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = P + col * secColW;
    const sy = secY + 16 + row * 20;
    const ok = s.passed === s.total;

    ctx.fillStyle = ok ? "#059669" : s.passed === 0 ? "#dc2626" : "#d97706";
    ctx.beginPath();
    ctx.arc(sx + 4, sy + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ccc";
    ctx.font = `400 11px ${SANS}`;
    ctx.fillText(s.name, sx + 14, sy + 7);

    ctx.fillStyle = "#555";
    ctx.font = `400 10px ${MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(`${s.passed}/${s.total}`, sx + secColW - 20, sy + 7);
    ctx.textAlign = "left";
  }

  // Hash + Uniqueness — inline row below sections
  const hashY = secY + 16 + secRows * 20 + 14;

  const hashX = P;
  // Hash grid
  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${SANS}`;
  ctx.fillText("Hash", hashX, hashY);

  const pattern = generateVisualHashPattern(certificate.resultsHash);
  const cell = 14, g = 2;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = pattern.grid[r]![c] ? pattern.colors[(r + c) % pattern.colors.length]! : "#151515";
      roundRect(ctx, hashX + c * (cell + g), hashY + 14 + r * (cell + g), cell, cell, 2);
      ctx.fill();
    }
  }

  // Uniqueness — to the right of hash
  const uX = hashX + 5 * (cell + g) + 30;
  if (crossProfile && crossProfile.macPerContext.total > 0) {
    ctx.fillStyle = "#666";
    ctx.font = `400 10px ${SANS}`;
    ctx.fillText("Uniqueness", uX, hashY);
    const d = crossProfile.macPerContext;
    const items = [["Audio", d.uniqueAudio], ["Canvas", d.uniqueCanvas], ["TZ", d.uniqueTimezones], ["Screen", d.uniqueScreens]] as const;
    let ix = uX;
    for (const [name, val] of items) {
      ctx.fillStyle = val === d.total ? "#059669" : "#d97706";
      ctx.font = `500 11px ${MONO}`;
      ctx.fillText(`${val}/${d.total}`, ix, hashY + 18);
      ctx.fillStyle = "#555";
      ctx.font = `400 9px ${SANS}`;
      ctx.fillText(name, ix, hashY + 30);
      ix += 56;
    }
  }

  // ── Issues (deduplicated) ──
  const hashEndY = hashY + 14 + 5 * (cell + g) + 8;
  const failY = hashEndY;
  if (issues.length > 0) {
    ctx.strokeStyle = "#1e1e1e";
    ctx.beginPath();
    ctx.moveTo(P, failY);
    ctx.lineTo(W - P, failY);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.font = `500 11px ${SANS}`;
    ctx.fillText(`Issues (${issues.length})`, P, failY + 18);

    const sevColors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308" };
    const maxShow = 6;
    for (let i = 0; i < Math.min(issues.length, maxShow); i++) {
      const issue = issues[i]!;
      const iy = failY + 36 + i * 18;

      // Severity dot
      ctx.fillStyle = sevColors[issue.severity] || "#eab308";
      ctx.beginPath();
      ctx.arc(P + 4, iy + 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Category + check name
      ctx.fillStyle = "#888";
      ctx.font = `400 10px ${SANS}`;
      const label = `${issue.category} · ${issue.check}`;
      ctx.fillText(truncate(ctx, label, 300), P + 14, iy + 6);

      // Severity label
      ctx.fillStyle = sevColors[issue.severity] || "#eab308";
      ctx.font = `400 9px ${SANS}`;
      ctx.fillText(issue.severity, P + 320, iy + 6);

      // Affected count
      ctx.fillStyle = "#555";
      ctx.font = `400 9px ${MONO}`;
      ctx.fillText(`${issue.affected}/${issue.total}`, P + 380, iy + 6);

      // Detail
      ctx.fillStyle = "#555";
      ctx.font = `400 9px ${MONO}`;
      ctx.fillText(truncate(ctx, issue.detail, W - P * 2 - 430), P + 420, iy + 6);
    }
    if (issues.length > maxShow) {
      ctx.fillStyle = "#444";
      ctx.font = `400 10px ${SANS}`;
      ctx.fillText(`...and ${issues.length - maxShow} more`, P + 14, failY + 36 + maxShow * 18);
    }
  }

  // ── Bottom: Hashes — positioned after issues ──
  const issueEndY = issues.length > 0
    ? failY + 36 + Math.min(issues.length, 6) * 18 + (issues.length > 6 ? 18 : 0)
    : failY;
  const bY = issueEndY + 16;
  ctx.strokeStyle = "#1e1e1e";
  ctx.beginPath();
  ctx.moveTo(P, bY);
  ctx.lineTo(W - P, bY);
  ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = `400 9px ${SANS}`;
  ctx.fillText("Results Hash", P, bY + 14);
  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${MONO}`;
  ctx.fillText(certificate.resultsHash, P, bY + 27);

  ctx.fillStyle = "#444";
  ctx.font = `400 9px ${SANS}`;
  ctx.fillText("Signature", W / 2, bY + 14);
  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${MONO}`;
  ctx.fillText(certificate.signature, W / 2, bY + 27);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
