import { GameAssets } from '../types';
import { TILE, MAP_DATA, SCALED_TILE, BUILDINGS, SCALE } from '../constants';
import { Camera, getVisibleTileRange } from '../engine/camera';

// ── Cached grass pattern canvas ─────────────────────────────────────────────
let grassPatternCanvas: HTMLCanvasElement | null = null;
let waterTileCanvas: HTMLCanvasElement | null = null;

function ensureGrassPattern(grassImg: HTMLImageElement) {
  if (grassPatternCanvas) return;
  // Create a pattern tile at SCALED_TILE size from the grass.png (156x156)
  const c = document.createElement('canvas');
  c.width = SCALED_TILE;
  c.height = SCALED_TILE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grassImg, 0, 0, grassImg.width, grassImg.height, 0, 0, SCALED_TILE, SCALED_TILE);
  grassPatternCanvas = c;
}

function ensureWaterTile() {
  if (waterTileCanvas) return;
  const s = SCALED_TILE;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4890F8';
  ctx.fillRect(0, 0, s, s);
  // Wave highlights
  ctx.fillStyle = '#68B0F8';
  ctx.fillRect(4, 8, 16, 3);
  ctx.fillRect(28, 24, 14, 3);
  ctx.fillRect(10, 38, 12, 3);
  // Dark depth
  ctx.fillStyle = '#3878D8';
  ctx.fillRect(20, 4, 12, 3);
  ctx.fillRect(4, 28, 10, 3);
  waterTileCanvas = c;
}

// ── Tree rendering using sprites ────────────────────────────────────────────
function drawTree(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  variant: number,
  assets: GameAssets
) {
  const treeImg = variant % 2 === 0 ? assets.tree1 : assets.tree2;

  if (treeImg) {
    ctx.imageSmoothingEnabled = false;
    // Tree sprites are 30x45, draw to fill a tile with some overhang upward
    // Scale tree to be slightly larger than tile for a natural look
    const drawW = SCALED_TILE;
    const drawH = SCALED_TILE * (45 / 30); // maintain aspect ratio
    const offsetY = SCALED_TILE - drawH; // tree extends upward above tile
    ctx.drawImage(treeImg, 0, 0, treeImg.width, treeImg.height, px, py + offsetY, drawW, drawH);
  } else {
    // Fallback: simple green circle tree
    ctx.fillStyle = '#395A10';
    ctx.fillRect(px + 18, py + 32, 12, 16);
    ctx.fillStyle = '#399431';
    ctx.beginPath();
    ctx.arc(px + SCALED_TILE / 2, py + SCALED_TILE / 2 - 4, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#83D562';
    ctx.beginPath();
    ctx.arc(px + SCALED_TILE / 2 - 2, py + SCALED_TILE / 2 - 8, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Flower rendering ────────────────────────────────────────────────────────
function drawFlower(ctx: CanvasRenderingContext2D, px: number, py: number, tileX: number, tileY: number) {
  const flowerColors = ['#F85858', '#F8A8F8', '#F8F858'];
  const colorIdx = (tileX * 3 + tileY * 7) % 3;

  const positions = [
    [12, 12], [32, 8], [20, 28], [36, 32], [8, 36]
  ];

  for (let i = 0; i < positions.length; i++) {
    const [fx, fy] = positions[i];
    // Petals
    ctx.fillStyle = flowerColors[(colorIdx + i) % 3];
    ctx.fillRect(px + fx - 3, py + fy, 3, 3);
    ctx.fillRect(px + fx + 3, py + fy, 3, 3);
    ctx.fillRect(px + fx, py + fy - 3, 3, 3);
    ctx.fillRect(px + fx, py + fy + 3, 3, 3);
    // Center
    ctx.fillStyle = '#F8D830';
    ctx.fillRect(px + fx, py + fy, 3, 3);
  }
  // Stems
  ctx.fillStyle = '#48A048';
  ctx.fillRect(px + 13, py + 20, 2, 8);
  ctx.fillRect(px + 33, py + 16, 2, 8);
}

// ── Door rendering ──────────────────────────────────────────────────────────
function drawDoor(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.fillStyle = '#785828';
  ctx.fillRect(px + 14, py + 4, SCALED_TILE - 28, SCALED_TILE - 4);
  ctx.fillStyle = '#583818';
  ctx.fillRect(px + 16, py + 6, SCALED_TILE - 32, SCALED_TILE - 8);
  ctx.fillStyle = '#F8D830';
  ctx.fillRect(px + SCALED_TILE / 2 + 4, py + SCALED_TILE / 2, 3, 3);
  ctx.fillStyle = 'rgba(255,240,180,0.3)';
  ctx.fillRect(px + 18, py + 8, SCALED_TILE - 36, SCALED_TILE - 14);
}

// ── Building label rendering ────────────────────────────────────────────────
function drawBuildingLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
  ctx.font = `bold ${10 * SCALE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(label);
  const padding = 6;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';

  const bgX = cx - metrics.width / 2 - padding;
  const bgY = cy - 10 * SCALE - padding;
  const bgW = metrics.width + padding * 2;
  const bgH = 10 * SCALE + padding * 2;

  const r = 4;
  ctx.beginPath();
  ctx.moveTo(bgX + r, bgY);
  ctx.lineTo(bgX + bgW - r, bgY);
  ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r);
  ctx.lineTo(bgX + bgW, bgY + bgH - r);
  ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH);
  ctx.lineTo(bgX + r, bgY + bgH);
  ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - r);
  ctx.lineTo(bgX, bgY + r);
  ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, cx, cy);
}

// ── Main Map Render ─────────────────────────────────────────────────────────
export function renderMap(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  assets: GameAssets
) {
  if (assets.grass) ensureGrassPattern(assets.grass);
  ensureWaterTile();

  const { startX, startY, endX, endY } = getVisibleTileRange(camera, viewportWidth, viewportHeight);
  ctx.imageSmoothingEnabled = false;

  // === Ground layer ===
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = MAP_DATA[y]?.[x];
      if (tile === undefined) continue;

      const px = x * SCALED_TILE - camera.x;
      const py = y * SCALED_TILE - camera.y;

      // Draw grass as base for all walkable-ish tiles
      if (grassPatternCanvas) {
        ctx.drawImage(grassPatternCanvas, px, py);
      } else {
        // Minimal fallback if grass image hasn't loaded
        ctx.fillStyle = (x + y) % 2 === 0 ? '#73CDA4' : '#6BC59C';
        ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
      }

      // Draw tile-specific content on top
      switch (tile) {
        case TILE.TREE:
          // Trees drawn in separate overlay pass (renderTreeOverlay) for depth sorting
          break;

        case TILE.DOOR:
          drawDoor(ctx, px, py);
          break;

        case TILE.FLOWER:
          drawFlower(ctx, px, py, x, y);
          break;

        case TILE.WATER:
          if (waterTileCanvas) {
            ctx.drawImage(waterTileCanvas, px, py);
          }
          break;

        case TILE.TALL_GRASS:
          // Draw tall grass sprite on top of base grass, but under trees/player
          if (assets.tallGrass) {
            ctx.drawImage(assets.tallGrass, 0, 0, assets.tallGrass.width, assets.tallGrass.height, px, py, SCALED_TILE, SCALED_TILE);
          } else {
            ctx.fillStyle = '#48A848';
            for (let i = 0; i < 6; i++) {
              const gx = px + (i % 3) * 16 + 4;
              const gy = py + Math.floor(i / 3) * 24 + 8;
              ctx.fillRect(gx - 3, gy + 4, 3, 8);
              ctx.fillRect(gx, gy, 3, 12);
              ctx.fillRect(gx + 3, gy + 4, 3, 8);
            }
          }
          break;

        // GRASS, BUILDING - no extra drawing on ground layer
        // Buildings drawn separately below as sprites
      }
    }
  }

  // === Building sprite layer ===
  for (const building of BUILDINGS) {
    const bpx = building.x * SCALED_TILE - camera.x;
    const bpy = building.y * SCALED_TILE - camera.y;
    const bw = building.width * SCALED_TILE;
    const bh = building.height * SCALED_TILE;

    // Skip if not visible (with margin for labels)
    if (bpx + bw < -40 || bpx > viewportWidth + 40 ||
        bpy + bh < -60 || bpy > viewportHeight + 40) continue;

    // Draw building sprite from loaded assets
    const spriteImg = assets.buildingSprites[building.spriteFile];
    if (spriteImg) {
      ctx.imageSmoothingEnabled = false;
      // Draw the sprite to fill the building's tile allocation
      // Maintain aspect ratio, anchored to bottom so roofs extend up naturally
      const spriteAspect = spriteImg.width / spriteImg.height;
      const tileAspect = bw / bh;

      let drawW: number, drawH: number;
      if (spriteAspect > tileAspect) {
        // Sprite is wider than space - fit to width
        drawW = bw;
        drawH = bw / spriteAspect;
      } else {
        // Sprite is taller than space - fit to height
        drawH = bh;
        drawW = bh * spriteAspect;
      }

      // Center horizontally, anchor to bottom of building area
      const drawX = bpx + (bw - drawW) / 2;
      const drawY = bpy + bh - drawH;

      ctx.drawImage(spriteImg, drawX, drawY, drawW, drawH);
    } else {
      // Fallback: simple colored building
      const roofH = Math.floor(bh * 0.35);
      ctx.fillStyle = '#B83020';
      ctx.fillRect(bpx - 4, bpy, bw + 8, roofH);
      ctx.fillStyle = '#E8D8A8';
      ctx.fillRect(bpx, bpy + roofH, bw, bh - roofH);
    }

    // Labels drawn in renderBuildingLabels (after tree overlay)
  }
}

// ── Building Labels (rendered after tree overlay so they're always visible) ──
export function renderBuildingLabels(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
) {
  for (const building of BUILDINGS) {
    const bpx = building.x * SCALED_TILE - camera.x;
    const bpy = building.y * SCALED_TILE - camera.y;
    const bw = building.width * SCALED_TILE;
    const bh = building.height * SCALED_TILE;

    if (bpx + bw < -40 || bpx > viewportWidth + 40 ||
        bpy + bh < -60 || bpy > viewportHeight + 40) continue;

    drawBuildingLabel(ctx, bpx + bw / 2, bpy - 8, building.label);
  }
}

// ── Tree Overlay (rendered after player for depth sorting) ──────────────────
export function renderTreeOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  assets: GameAssets
) {
  const { startX, startY, endX, endY } = getVisibleTileRange(camera, viewportWidth, viewportHeight);
  ctx.imageSmoothingEnabled = false;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = MAP_DATA[y]?.[x];
      if (tile !== TILE.TREE) continue;

      const px = x * SCALED_TILE - camera.x;
      const py = y * SCALED_TILE - camera.y;
      drawTree(ctx, px, py, (x + y) % 3, assets);
    }
  }
}

// ── Tall Grass Overlay (no-op: tall grass now renders in ground layer) ───────
export function renderTallGrassOverlay(
  _ctx: CanvasRenderingContext2D,
  _camera: Camera,
  _viewportWidth: number,
  _viewportHeight: number,
  _assets: GameAssets
) {
  // Tall grass is now drawn in renderMap ground layer,
  // under trees and player. This function kept for API compat.
}
