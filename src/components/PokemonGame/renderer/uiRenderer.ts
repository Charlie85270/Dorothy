import { Camera } from '../engine/camera';
import { SCALE } from '../constants';

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  showInteractionPrompt: boolean
) {
  // Location banner at top
  drawLocationBanner(ctx, viewportWidth);

  // Interaction prompt at bottom
  if (showInteractionPrompt) {
    drawInteractionPrompt(ctx, viewportWidth, viewportHeight);
  }
}

function drawLocationBanner(ctx: CanvasRenderingContext2D, viewportWidth: number) {
  const text = 'PALLET TOWN';
  ctx.font = `bold ${12 * SCALE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Semi-transparent banner
  const metrics = ctx.measureText(text);
  const bannerWidth = metrics.width + 40;
  const bannerHeight = 14 * SCALE;
  const x = viewportWidth / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - bannerWidth / 2, 8, bannerWidth, bannerHeight);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, 12);
}

function drawInteractionPrompt(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number) {
  const text = 'Press SPACE';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const y = viewportHeight - 80;
  const x = viewportWidth / 2;

  // Bouncing animation based on time
  const bounce = Math.sin(Date.now() / 300) * 3;

  // Background pill
  const metrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  const pillW = metrics.width + 24;
  const pillH = 28;
  ctx.beginPath();
  ctx.roundRect(x - pillW / 2, y - pillH + bounce, pillW, pillH, 8);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y - 4 + bounce);
}

export function renderLoadingScreen(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  progress: number
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Loading...', viewportWidth / 2, viewportHeight / 2 - 20);

  // Progress bar
  const barWidth = 200;
  const barHeight = 12;
  const barX = viewportWidth / 2 - barWidth / 2;
  const barY = viewportHeight / 2 + 10;

  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = '#48d848';
  ctx.fillRect(barX, barY, barWidth * (progress / 100), barHeight);
}
