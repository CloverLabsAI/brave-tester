import type { CertificateData, CrossProfileAnalysis } from "./types";

export function generateVisualHashPattern(hash: string): { colors: string[]; grid: boolean[][] } {
  const bytes: number[] = [];
  for (let i = 0; i < Math.min(hash.length, 32); i += 2) {
    bytes.push(parseInt(hash.substring(i, i + 2), 16) || 0);
  }

  // Cyan-tinted colors from hash
  const colors = [
    `hsl(${180 + (bytes[0] || 0) % 30}, 80%, ${50 + (bytes[1] || 0) % 20}%)`,
    `hsl(${190 + (bytes[2] || 0) % 20}, 75%, ${45 + (bytes[3] || 0) % 20}%)`,
    `hsl(${170 + (bytes[4] || 0) % 30}, 85%, ${40 + (bytes[5] || 0) % 25}%)`,
  ];

  // 5x5 symmetric grid
  const grid: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < 5; col++) {
      const mirrorCol = col < 3 ? col : 4 - col;
      const idx = row * 3 + mirrorCol;
      const byte = bytes[idx % bytes.length] || 0;
      line.push(byte > 128);
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
  const W = 1200, H = 820;
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // Background: deep purple gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0919");
  bg.addColorStop(0.5, "#1a1034");
  bg.addColorStop(1, "#0d0919");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow
  const glow = ctx.createRadialGradient(W / 2, H / 3, 0, W / 2, H / 3, 500);
  glow.addColorStop(0, "rgba(34, 211, 238, 0.06)");
  glow.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Mountain silhouettes
  ctx.fillStyle = "rgba(61, 44, 94, 0.3)";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 80);
  ctx.lineTo(200, H - 160);
  ctx.lineTo(400, H - 100);
  ctx.lineTo(600, H - 200);
  ctx.lineTo(800, H - 120);
  ctx.lineTo(1000, H - 180);
  ctx.lineTo(W, H - 90);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(45, 34, 73, 0.3)";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 50);
  ctx.lineTo(300, H - 120);
  ctx.lineTo(500, H - 70);
  ctx.lineTo(700, H - 150);
  ctx.lineTo(900, H - 80);
  ctx.lineTo(W, H - 60);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Header
  const passed = certificate.overallPass;

  // Logo
  try {
    const logo = await loadImage("/brave-logo.svg");
    const logoSize = 48;
    ctx.drawImage(logo, W / 2 - logoSize / 2, 15, logoSize, logoSize);
  } catch {
    // Fallback text if image fails
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.fillText("B", W / 2, 55);
  }

  // Title
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = "#e0daf0";
  ctx.textAlign = "center";
  ctx.fillText("BRAVE BUILD CERTIFICATE", W / 2, 95);

  // Decorative line
  const lineGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.3, "#22d3ee");
  lineGrad.addColorStop(0.7, "#06b6d4");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200, 108);
  ctx.lineTo(W / 2 + 200, 108);
  ctx.stroke();

  // Pass/Fail badge
  const badgeBg = passed ? "#059669" : "#dc2626";
  const badgeText = passed ? "PASSED" : "FAILED";
  ctx.textAlign = "center";
  const badgeW = 120, badgeH = 30;
  roundRect(ctx, W / 2 - badgeW / 2, 120, badgeW, badgeH, 6);
  ctx.fillStyle = badgeBg;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.fillText(badgeText, W / 2, 140);

  ctx.textAlign = "left";
  const leftX = 60;
  const rightX = 850;
  let y = 185;

  // Left column: metadata
  const drawLabel = (label: string, value: string, yPos: number) => {
    ctx.fillStyle = "#8b7fa6";
    ctx.font = "11px monospace";
    ctx.fillText(label, leftX, yPos);
    ctx.fillStyle = "#e0daf0";
    ctx.font = "13px monospace";
    ctx.fillText(truncateText(ctx, value, 340), leftX, yPos + 16);
  };

  drawLabel("CERTIFICATE ID", certificate.id.substring(0, 36), y);
  drawLabel("ISSUED", new Date(certificate.timestamp).toLocaleString(), y + 42);
  drawLabel("PROFILES TESTED", String(certificate.profileCount), y + 84);
  drawLabel("TESTS PASSED", `${certificate.passCount} / ${certificate.totalTests}`, y + 126);
  drawLabel("USER AGENT", certificate.braveVersion, y + 168);

  // Center column: section results
  const sectionX = 440;
  ctx.fillStyle = "#8b7fa6";
  ctx.font = "bold 11px monospace";
  ctx.fillText("SECTION RESULTS", sectionX, y);

  const sectionY = y + 20;
  const colW = 190;
  for (let i = 0; i < certificate.sectionResults.length; i++) {
    const s = certificate.sectionResults[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = sectionX + col * colW;
    const sy = sectionY + row * 22;

    const allPassed = s.passed === s.total;
    ctx.fillStyle = allPassed ? "#22d3ee" : s.passed === 0 ? "#ef4444" : "#f59e0b";
    ctx.beginPath();
    ctx.arc(sx + 5, sy + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e0daf0";
    ctx.font = "11px monospace";
    ctx.fillText(`${s.name}`, sx + 15, sy + 8);

    ctx.fillStyle = "#8b7fa6";
    ctx.font = "10px monospace";
    const countText = `${s.passed}/${s.total}`;
    ctx.fillText(countText, sx + colW - 35, sy + 8);
  }

  // Right column: visual hash + uniqueness
  ctx.fillStyle = "#8b7fa6";
  ctx.font = "bold 11px monospace";
  ctx.fillText("VISUAL HASH", rightX, y);

  const pattern = generateVisualHashPattern(certificate.resultsHash);
  const cellSize = 20;
  const gap = 3;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = rightX + col * (cellSize + gap);
      const cy = y + 16 + row * (cellSize + gap);
      if (pattern.grid[row][col]) {
        ctx.fillStyle = pattern.colors[(row + col) % pattern.colors.length];
      } else {
        ctx.fillStyle = "rgba(139, 127, 166, 0.1)";
      }
      roundRect(ctx, cx, cy, cellSize, cellSize, 3);
      ctx.fill();
    }
  }

  // Uniqueness
  if (crossProfile) {
    const uY = y + 145;
    ctx.fillStyle = "#8b7fa6";
    ctx.font = "bold 11px monospace";
    ctx.fillText("UNIQUENESS", rightX, uY);

    const drawUniqueness = (label: string, data: { uniqueAudio: number; uniqueCanvas: number; uniqueTimezones: number; uniqueScreens: number; total: number }, baseY: number) => {
      ctx.fillStyle = "#e0daf0";
      ctx.font = "11px monospace";
      ctx.fillText(label, rightX, baseY);
      const items = [
        ["Audio", data.uniqueAudio],
        ["Canvas", data.uniqueCanvas],
        ["TZ", data.uniqueTimezones],
        ["Screen", data.uniqueScreens],
      ] as const;
      let ix = rightX;
      for (const [name, val] of items) {
        ctx.fillStyle = val === data.total ? "#22d3ee" : "#f59e0b";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`${val}/${data.total}`, ix, baseY + 16);
        ctx.fillStyle = "#8b7fa6";
        ctx.font = "9px monospace";
        ctx.fillText(name, ix, baseY + 28);
        ix += 70;
      }
    };

    drawUniqueness("macOS Per-Context", crossProfile.macPerContext, uY + 18);
    drawUniqueness("Linux Per-Context", crossProfile.linuxPerContext, uY + 65);
  }

  // Failures
  if (certificate.failedTests.length > 0) {
    const fY = 560;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, fY);
    ctx.lineTo(W - 60, fY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`FAILURES (${certificate.failedTests.length})`, leftX, fY + 20);

    ctx.fillStyle = "#fca5a5";
    ctx.font = "11px monospace";
    const maxShow = 5;
    for (let i = 0; i < Math.min(certificate.failedTests.length, maxShow); i++) {
      ctx.fillText(
        truncateText(ctx, certificate.failedTests[i], W - 140),
        leftX + 10,
        fY + 38 + i * 16
      );
    }
    if (certificate.failedTests.length > maxShow) {
      ctx.fillStyle = "#8b7fa6";
      ctx.fillText(
        `...and ${certificate.failedTests.length - maxShow} more`,
        leftX + 10,
        fY + 38 + maxShow * 16
      );
    }
  }

  // Bottom divider
  const bY = H - 100;
  const bottomGrad = ctx.createLinearGradient(60, 0, W - 60, 0);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(0.3, "rgba(34, 211, 238, 0.3)");
  bottomGrad.addColorStop(0.7, "rgba(6, 182, 212, 0.3)");
  bottomGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = bottomGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, bY);
  ctx.lineTo(W - 60, bY);
  ctx.stroke();

  // Hashes
  ctx.fillStyle = "#8b7fa6";
  ctx.font = "9px monospace";
  ctx.fillText("RESULTS HASH", leftX, bY + 18);
  ctx.fillStyle = "#e0daf0";
  ctx.font = "10px monospace";
  ctx.fillText(certificate.resultsHash, leftX, bY + 32);

  ctx.fillStyle = "#8b7fa6";
  ctx.font = "9px monospace";
  ctx.fillText("HMAC SIGNATURE", leftX, bY + 50);
  ctx.fillStyle = "#e0daf0";
  ctx.font = "10px monospace";
  ctx.fillText(certificate.signature, leftX, bY + 64);

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#8b7fa6";
  ctx.font = "10px monospace";
  ctx.fillText("Brave Tester", W / 2, H - 15);
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
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}
