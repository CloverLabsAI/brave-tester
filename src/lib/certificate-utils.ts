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
  const H = Math.round(W * 0.62);
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  // Remove any inline style so CSS w-full controls sizing
  canvas.style.width = "";
  canvas.style.height = "";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const P = 40; // content padding from canvas edge
  const passed = certificate.overallPass;

  // BG — no inner border, the card component provides the border
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

  // ── Sections (3 cols) + Hash/Uniqueness ──
  const secY = buildY + 44;
  const secArea = W - P * 2 - 180; // leave 180px for hash column
  const secColW = secArea / 3;

  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${SANS}`;
  ctx.fillText("Sections", P, secY);

  const sr = certificate.sectionResults;
  const secRows = Math.ceil(sr.length / 3);
  for (let i = 0; i < sr.length; i++) {
    const s = sr[i]!;
    const col = i % 3;
    const row = Math.floor(i / 3);
    const sx = P + col * secColW;
    const sy = secY + 16 + row * 20;
    const ok = s.passed === s.total;

    ctx.fillStyle = ok ? "#059669" : s.passed === 0 ? "#dc2626" : "#d97706";
    ctx.beginPath();
    ctx.arc(sx + 4, sy + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ccc";
    ctx.font = `400 11px ${SANS}`;
    ctx.fillText(s.name, sx + 12, sy + 7);

    ctx.fillStyle = "#555";
    ctx.font = `400 10px ${MONO}`;
    const countStr = `${s.passed}/${s.total}`;
    ctx.fillText(countStr, sx + secColW - 40, sy + 7);
  }

  // Hash grid — right column
  const hashX = W - P - 150;
  ctx.fillStyle = "#666";
  ctx.font = `400 10px ${SANS}`;
  ctx.fillText("Hash", hashX, secY);

  const pattern = generateVisualHashPattern(certificate.resultsHash);
  const cell = 16, g = 2;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = pattern.grid[r]![c] ? pattern.colors[(r + c) % pattern.colors.length]! : "#151515";
      roundRect(ctx, hashX + c * (cell + g), secY + 14 + r * (cell + g), cell, cell, 2);
      ctx.fill();
    }
  }

  // Uniqueness — below hash
  if (crossProfile && crossProfile.macPerContext.total > 0) {
    const uY = secY + 14 + 5 * (cell + g) + 10;
    ctx.fillStyle = "#666";
    ctx.font = `400 10px ${SANS}`;
    ctx.fillText("Uniqueness", hashX, uY);
    const d = crossProfile.macPerContext;
    const items = [["Au", d.uniqueAudio], ["Cv", d.uniqueCanvas], ["Tz", d.uniqueTimezones], ["Sc", d.uniqueScreens]] as const;
    let ix = hashX;
    for (const [name, val] of items) {
      ctx.fillStyle = val === d.total ? "#059669" : "#d97706";
      ctx.font = `500 11px ${MONO}`;
      ctx.fillText(`${val}/${d.total}`, ix, uY + 15);
      ctx.fillStyle = "#555";
      ctx.font = `400 9px ${SANS}`;
      ctx.fillText(name, ix, uY + 26);
      ix += 38;
    }
  }

  // ── Row 4: Failures ──
  const failY = secY + 16 + secRows * 20 + 16;
  if (certificate.failedTests.length > 0) {
    ctx.strokeStyle = "#1e1e1e";
    ctx.beginPath();
    ctx.moveTo(P, failY);
    ctx.lineTo(W - P, failY);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.font = `500 11px ${SANS}`;
    ctx.fillText(`Failures (${certificate.failedTests.length})`, P, failY + 18);

    ctx.fillStyle = "#777";
    ctx.font = `400 10px ${MONO}`;
    const maxShow = 5;
    for (let i = 0; i < Math.min(certificate.failedTests.length, maxShow); i++) {
      ctx.fillText(truncate(ctx, certificate.failedTests[i]!, W - P * 2 - 16), P + 4, failY + 34 + i * 15);
    }
    if (certificate.failedTests.length > maxShow) {
      ctx.fillStyle = "#444";
      ctx.fillText(`...and ${certificate.failedTests.length - maxShow} more`, P + 4, failY + 34 + maxShow * 15);
    }
  }

  // ── Bottom: Hashes ──
  const bY = H - P - 42;
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
