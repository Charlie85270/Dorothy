import { NPC, GameAssets } from '../types';
import { SCALED_TILE, SCALE } from '../constants';
import { Camera } from '../engine/camera';
import { getNPCWandererFrame } from '../sprites';

// Cache for individually-loaded pokemon sprite images
const spriteImageCache: Record<string, HTMLImageElement> = {};

export function renderNPCs(
  ctx: CanvasRenderingContext2D,
  npcs: NPC[],
  camera: Camera,
  assets: GameAssets,
  viewportWidth: number,
  viewportHeight: number
) {
  // Sort by Y for depth ordering
  const sorted = [...npcs].sort((a, b) => a.y - b.y);

  for (const npc of sorted) {
    const screenX = npc.x * SCALED_TILE - camera.x;
    const screenY = npc.y * SCALED_TILE - camera.y;

    // Cull if offscreen
    if (screenX + SCALED_TILE * 2 < 0 || screenX > viewportWidth ||
        screenY + SCALED_TILE * 2 < 0 || screenY > viewportHeight) continue;

    if (npc.type === 'professor') {
      renderProfessorChen(ctx, screenX, screenY, assets);
    } else if (npc.type === 'wanderer') {
      renderWandererNPC(ctx, screenX, screenY, npc);
    } else {
      renderAgentPokemon(ctx, screenX, screenY, npc, assets);
    }

    // Draw name label above NPC (skip for wanderers)
    if (npc.type !== 'wanderer') {
      renderNPCLabel(ctx, screenX + SCALED_TILE / 2, screenY - 8, npc.name);
    }
  }
}

function renderProfessorChen(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  assets: GameAssets
) {
  if (assets.chen) {
    ctx.imageSmoothingEnabled = false;
    const drawWidth = SCALED_TILE * 1.2;
    const drawHeight = SCALED_TILE * 1.8;
    const offsetX = (SCALED_TILE - drawWidth) / 2;
    const offsetY = SCALED_TILE - drawHeight;
    ctx.drawImage(
      assets.chen,
      screenX + offsetX, screenY + offsetY,
      drawWidth, drawHeight
    );
  } else {
    // Fallback: pixel-art professor character
    const cx = screenX + SCALED_TILE / 2;
    const cy = screenY + SCALED_TILE / 2;
    // Lab coat body
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(cx - 12, cy - 4, 24, 28);
    // Head
    ctx.fillStyle = '#d0b080';
    ctx.fillRect(cx - 8, cy - 16, 16, 14);
    // Hair
    ctx.fillStyle = '#888888';
    ctx.fillRect(cx - 8, cy - 18, 16, 6);
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 4, cy - 10, 3, 3);
    ctx.fillRect(cx + 2, cy - 10, 3, 3);
  }
}

function renderAgentPokemon(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  npc: NPC,
  assets: GameAssets
) {
  const spritePath = npc.spritePath;

  if (spritePath) {
    // Load and cache individual sprite image
    if (!spriteImageCache[spritePath]) {
      const img = new Image();
      img.src = spritePath;
      spriteImageCache[spritePath] = img;
    }

    const img = spriteImageCache[spritePath];
    if (img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      const drawSize = SCALED_TILE * 1.2;
      const offset = (SCALED_TILE - drawSize) / 2;
      ctx.drawImage(img, screenX + offset, screenY + offset, drawSize, drawSize);
    } else {
      // Still loading — draw placeholder
      renderSpritePlaceholder(ctx, screenX, screenY, npc.name);
    }
  } else {
    // No sprite path — draw placeholder
    renderSpritePlaceholder(ctx, screenX, screenY, npc.name);
  }

  // Status indicator dot
  if (npc.agentStatus) {
    const color = npc.agentStatus === 'running' ? '#48d848' :
                  npc.agentStatus === 'idle' ? '#d8d848' : '#d84848';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX + SCALED_TILE - 6, screenY + 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function renderWandererNPC(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  npc: NPC,
) {
  const spritePath = npc.spritePath;
  if (!spritePath) {
    renderSpritePlaceholder(ctx, screenX, screenY, npc.name);
    return;
  }

  if (!spriteImageCache[spritePath]) {
    const img = new Image();
    img.src = spritePath;
    spriteImageCache[spritePath] = img;
  }

  const img = spriteImageCache[spritePath];
  if (!img.complete || img.naturalWidth === 0) {
    renderSpritePlaceholder(ctx, screenX, screenY, npc.name);
    return;
  }

  const frame = getNPCWandererFrame(npc.direction, npc.animFrame || 0);
  ctx.imageSmoothingEnabled = false;
  // Scale to fit nicely — frame is 32x48, use SCALE*0.5 to match tile proportions
  const drawScale = SCALE * 0.5;
  const drawWidth = frame.sw * drawScale;
  const drawHeight = frame.sh * drawScale;
  // Center horizontally on tile, align bottom to tile bottom
  const offsetX = (SCALED_TILE - drawWidth) / 2;
  const offsetY = SCALED_TILE - drawHeight;
  ctx.drawImage(
    img,
    frame.sx, frame.sy, frame.sw, frame.sh,
    screenX + offsetX, screenY + offsetY, drawWidth, drawHeight
  );
}

function renderSpritePlaceholder(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, name: string) {
  const cx = screenX + SCALED_TILE / 2;
  const cy = screenY + SCALED_TILE / 2;
  ctx.fillStyle = '#f8a848';
  ctx.beginPath();
  ctx.arc(cx, cy, SCALED_TILE / 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c07020';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.charAt(0), cx, cy);
}

function renderNPCLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, name: string) {
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(name);
  const padding = 4;

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const bgX = cx - metrics.width / 2 - padding;
  const bgY = cy - 16;
  const bgW = metrics.width + padding * 2;
  const bgH = 20;
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgW, bgH, 3);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, cx, cy);
}
