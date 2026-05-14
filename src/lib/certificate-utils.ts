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
      const idx = row * 3 + mirrorCol;
      line.push((bytes[idx % bytes.length] || 0) > 128);
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

export async function drawCertificate(canvas: HTMLCanvasElement, opts: DrawCertificateOptions) {
  const { certificate, crossProfile } = opts;
  const W = 1200, H = 760;
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  // Subtle noise-like border
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Logo + Title
  const passed = certificate.overallPass;
  try {
    const logo = await loadImage("/brave-logo.svg");
    ctx.drawImage(logo, W / 2 - 16, 52, 32, 36);
  } catch {
    ctx.fillStyle = "#FB542B";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("◆", W / 2, 76);
  }

  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillStyle = "#888888";
  ctx.textAlign = "center";
  ctx.letterSpacing = "4px";
  ctx.fillText("BRAVE BUILD CERTIFICATE", W / 2, 112);
  ctx.letterSpacing = "0px";

  // Divider
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 160, 124);
  ctx.lineTo(W / 2 + 160, 124);
  ctx.stroke();

  // Status badge
  const badgeBg = passed ? "#059669" : "#dc2626";
  const badgeText = passed ? "PASSED" : "FAILED";
  ctx.textAlign = "center";
  roundRect(ctx, W / 2 - 44, 136, 88, 26, 4);
  ctx.fillStyle = badgeBg;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText(badgeText, W / 2, 153);

  // Metadata column
  ctx.textAlign = "left";
  const col1 = 64;
  let y = 192;

  const drawField = (label: string, value: string, yPos: number) => {
    ctx.fillStyle = "#555555";
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillText(label, col1, yPos);
    ctx.fillStyle = "#ededed";
    ctx.font = "400 12px ui-monospace, monospace";
    ctx.fillText(truncateText(ctx, value, 320), col1, yPos + 16);
  };

  drawField("CERTIFICATE", certificate.id.substring(0, 36), y);
  drawField("ISSUED", new Date(certificate.timestamp).toLocaleString(), y + 40);
  drawField("PROFILES", String(certificate.profileCount), y + 80);
  drawField("TESTS", `${certificate.passCount} / ${certificate.totalTests}`, y + 120);
  drawField("BUILD", certificate.braveVersion, y + 160);

  // Section results
  const secX = 440;
  ctx.fillStyle = "#555555";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.fillText("SECTIONS", secX, y);

  const secY = y + 18;
  const colW = 195;
  for (let i = 0; i < certificate.sectionResults.length; i++) {
    const s = certificate.sectionResults[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = secX + col * colW;
    const sy = secY + row * 21;
    const ok = s.passed === s.total;

    ctx.fillStyle = ok ? "#059669" : s.passed === 0 ? "#dc2626" : "#d97706";
    ctx.beginPath();
    ctx.arc(sx + 4, sy + 4, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ededed";
    ctx.font = "400 11px system-ui, sans-serif";
    ctx.fillText(s.name, sx + 14, sy + 8);

    ctx.fillStyle = "#555555";
    ctx.font = "400 10px ui-monospace, monospace";
    ctx.fillText(`${s.passed}/${s.total}`, sx + colW - 36, sy + 8);
  }

  // Visual hash
  const hashX = 870;
  ctx.fillStyle = "#555555";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.fillText("HASH", hashX, y);

  const pattern = generateVisualHashPattern(certificate.resultsHash);
  const cellSize = 18;
  const gap = 3;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = hashX + col * (cellSize + gap);
      const cy = y + 16 + row * (cellSize + gap);
      ctx.fillStyle = pattern.grid[row][col]
        ? pattern.colors[(row + col) % pattern.colors.length]
        : "#1a1a1a";
      roundRect(ctx, cx, cy, cellSize, cellSize, 3);
      ctx.fill();
    }
  }

  // Uniqueness
  if (crossProfile && crossProfile.macPerContext.total > 0) {
    const uY = y + 140;
    ctx.fillStyle = "#555555";
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillText("UNIQUENESS", hashX, uY);

    const data = crossProfile.macPerContext;
    const items = [["Audio", data.uniqueAudio], ["Canvas", data.uniqueCanvas], ["TZ", data.uniqueTimezones], ["Screen", data.uniqueScreens]] as const;
    let ix = hashX;
    for (const [name, val] of items) {
      ctx.fillStyle = val === data.total ? "#059669" : "#d97706";
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillText(`${val}/${data.total}`, ix, uY + 18);
      ctx.fillStyle = "#555555";
      ctx.font = "400 9px system-ui, sans-serif";
      ctx.fillText(name, ix, uY + 30);
      ix += 65;
    }
  }

  // Failures
  if (certificate.failedTests.length > 0) {
    const fY = 510;
    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, fY);
    ctx.lineTo(W - 64, fY);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillText(`FAILURES (${certificate.failedTests.length})`, col1, fY + 20);

    ctx.fillStyle = "#888888";
    ctx.font = "400 10px ui-monospace, monospace";
    const maxShow = 6;
    for (let i = 0; i < Math.min(certificate.failedTests.length, maxShow); i++) {
      ctx.fillText(truncateText(ctx, certificate.failedTests[i], W - 148), col1 + 8, fY + 38 + i * 16);
    }
    if (certificate.failedTests.length > maxShow) {
      ctx.fillStyle = "#555555";
      ctx.fillText(`...and ${certificate.failedTests.length - maxShow} more`, col1 + 8, fY + 38 + maxShow * 16);
    }
  }

  // Bottom hashes
  const bY = H - 80;
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, bY);
  ctx.lineTo(W - 64, bY);
  ctx.stroke();

  ctx.fillStyle = "#555555";
  ctx.font = "400 9px system-ui, sans-serif";
  ctx.fillText("RESULTS HASH", col1, bY + 16);
  ctx.fillStyle = "#888888";
  ctx.font = "400 10px ui-monospace, monospace";
  ctx.fillText(certificate.resultsHash, col1, bY + 30);

  ctx.fillStyle = "#555555";
  ctx.font = "400 9px system-ui, sans-serif";
  ctx.fillText("SIGNATURE", col1, bY + 46);
  ctx.fillStyle = "#888888";
  ctx.font = "400 10px ui-monospace, monospace";
  ctx.fillText(certificate.signature, col1, bY + 60);

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#333333";
  ctx.font = "400 9px system-ui, sans-serif";
  ctx.fillText("Brave Tester", W / 2, H - 14);
  ctx.textAlign = "left";
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

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) t = t.slice(0, -1);
  return t + "...";
}
