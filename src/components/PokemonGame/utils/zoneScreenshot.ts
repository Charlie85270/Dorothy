import type { GenerativeZone } from '@/types/world';
import type { GameAssets } from '../types';
import { TILE, SCALED_TILE } from '../constants';

const SOLID_TILES = new Set<number>([TILE.TREE, TILE.FENCE, TILE.WATER]);

/**
 * Renders an offscreen top-down screenshot of a generative zone.
 * Returns a data:image/png;base64,... string.
 */
export async function renderZoneScreenshot(
  zone: GenerativeZone,
  assets: GameAssets,
  maxDimension = 512,
): Promise<string> {
  const fullW = zone.width * SCALED_TILE;
  const fullH = zone.height * SCALED_TILE;

  // Scale factor to fit within maxDimension
  const scaleFactor = Math.min(1, maxDimension / Math.max(fullW, fullH));
  const canvasW = Math.round(fullW * scaleFactor);
  const canvasH = Math.round(fullH * scaleFactor);

  // Pre-load zone-specific sprites
  const spritePromises: Promise<void>[] = [];
  const spriteCache = new Map<string, HTMLImageElement>();

  const loadSprite = (path: string) => {
    if (!path || spriteCache.has(path)) return;
    const img = new Image();
    spriteCache.set(path, img);
    spritePromises.push(
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // don't block on missing sprites
        img.src = path;
      }),
    );
  };

  for (const npc of zone.npcs) loadSprite(npc.spritePath);
  for (const b of zone.buildings) loadSprite(b.spriteFile);

  // Also load tile images
  const tileImages: Record<string, HTMLImageElement> = {};
  const loadTileImage = (key: string, src: string) => {
    const img = new Image();
    tileImages[key] = img;
    spritePromises.push(
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      }),
    );
  };
  loadTileImage('flower', '/pokemon/grass/flower.png');
  loadTileImage('barrier', '/pokemon/grass/barrier.png');
  loadTileImage('sign', '/pokemon/grass/pancarte.png');
  loadTileImage('grave', '/pokemon/graveyard/stone.png');

  await Promise.all(spritePromises);

  // Create offscreen canvas at full resolution then scale
  const offscreen = document.createElement('canvas');
  offscreen.width = fullW;
  offscreen.height = fullH;
  const ctx = offscreen.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Render grass cache tile
  let grassTile: HTMLCanvasElement | null = null;
  if (assets.grass) {
    grassTile = document.createElement('canvas');
    grassTile.width = SCALED_TILE;
    grassTile.height = SCALED_TILE;
    const gc = grassTile.getContext('2d')!;
    gc.imageSmoothingEnabled = false;
    gc.drawImage(assets.grass, 0, 0, assets.grass.width, assets.grass.height, 0, 0, SCALED_TILE, SCALED_TILE);
  }

  // Water cache tile
  const waterTile = document.createElement('canvas');
  waterTile.width = SCALED_TILE;
  waterTile.height = SCALED_TILE;
  const wc = waterTile.getContext('2d')!;
  wc.fillStyle = '#4890F8';
  wc.fillRect(0, 0, SCALED_TILE, SCALED_TILE);
  wc.fillStyle = '#68B0F8';
  wc.fillRect(4, 8, 16, 3);
  wc.fillRect(28, 24, 14, 3);
  wc.fillRect(10, 38, 12, 3);

  // === Ground layer ===
  for (let row = 0; row < zone.height; row++) {
    for (let col = 0; col < zone.width; col++) {
      const tile = zone.tilemap[row]?.[col];
      if (tile === undefined) continue;
      const px = col * SCALED_TILE;
      const py = row * SCALED_TILE;

      // Grass base
      if (grassTile) {
        ctx.drawImage(grassTile, px, py);
      } else {
        ctx.fillStyle = (col + row) % 2 === 0 ? '#73CDA4' : '#6BC59C';
        ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
      }

      switch (tile) {
        case TILE.TALL_GRASS:
          if (assets.tallGrass) {
            ctx.drawImage(assets.tallGrass, 0, 0, assets.tallGrass.width, assets.tallGrass.height, px, py, SCALED_TILE, SCALED_TILE);
          } else {
            ctx.fillStyle = '#48A848';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
            ctx.globalAlpha = 1;
          }
          break;
        case TILE.FLOWER: {
          const fi = tileImages['flower'];
          if (fi?.complete && fi.naturalWidth > 0) {
            ctx.drawImage(fi, px, py, SCALED_TILE, SCALED_TILE);
          }
          break;
        }
        case TILE.WATER:
          ctx.drawImage(waterTile, px, py);
          break;
        case TILE.FENCE: {
          const bi = tileImages['barrier'];
          if (bi?.complete && bi.naturalWidth > 0) {
            ctx.drawImage(bi, px, py, SCALED_TILE, SCALED_TILE);
          } else {
            ctx.fillStyle = '#8B7355';
            ctx.fillRect(px + 2, py + SCALED_TILE * 0.3, SCALED_TILE - 4, 6);
            ctx.fillRect(px + 2, py + SCALED_TILE * 0.7, SCALED_TILE - 4, 6);
          }
          break;
        }
        case TILE.SIGN: {
          const si = tileImages['sign'];
          if (si?.complete && si.naturalWidth > 0) {
            ctx.drawImage(si, px, py, SCALED_TILE, SCALED_TILE);
          }
          break;
        }
        case TILE.GRAVE: {
          const gi = tileImages['grave'];
          if (gi?.complete && gi.naturalWidth > 0) {
            ctx.drawImage(gi, px, py, SCALED_TILE, SCALED_TILE);
          }
          break;
        }
      }
    }
  }

  // === Buildings ===
  for (const building of zone.buildings) {
    const bpx = building.x * SCALED_TILE;
    const bpy = building.y * SCALED_TILE;
    const bw = building.width * SCALED_TILE;
    const bh = building.height * SCALED_TILE;

    const spriteImg = spriteCache.get(building.spriteFile);
    if (spriteImg?.complete && spriteImg.naturalWidth > 0) {
      const spriteAspect = spriteImg.width / spriteImg.height;
      const tileAspect = bw / bh;
      let drawW: number, drawH: number;
      if (spriteAspect > tileAspect) {
        drawW = bw;
        drawH = bw / spriteAspect;
      } else {
        drawH = bh;
        drawW = bh * spriteAspect;
      }
      const drawX = bpx + (bw - drawW) / 2;
      const drawY = bpy + bh - drawH;
      ctx.drawImage(spriteImg, drawX, drawY, drawW, drawH);
    } else {
      const roofH = Math.floor(bh * 0.35);
      ctx.fillStyle = '#B83020';
      ctx.fillRect(bpx - 4, bpy, bw + 8, roofH);
      ctx.fillStyle = '#E8D8A8';
      ctx.fillRect(bpx, bpy + roofH, bw, bh - roofH);
    }
  }

  // === NPCs at positions (static, frame 0) ===
  type Direction = 'down' | 'up' | 'left' | 'right';
  for (const npc of zone.npcs) {
    const npx = npc.x * SCALED_TILE;
    const npy = npc.y * SCALED_TILE;

    const sprite = spriteCache.get(npc.spritePath);
    if (sprite?.complete && sprite.naturalWidth > 0) {
      const dirRow: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
      const row = dirRow[npc.direction as Direction] ?? 0;
      const frameW = sprite.naturalWidth / 4;
      const frameH = sprite.naturalHeight / 4;
      const drawW = SCALED_TILE;
      const drawH = SCALED_TILE * 1.5;
      const offsetX = (SCALED_TILE - drawW) / 2;
      const offsetY = SCALED_TILE - drawH;
      ctx.drawImage(
        sprite,
        0, row * frameH, frameW, frameH,
        npx + offsetX, npy + offsetY, drawW, drawH,
      );
    } else {
      const cx = npx + SCALED_TILE / 2;
      const cy = npy + SCALED_TILE / 2;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(cx, cy, SCALED_TILE * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(npc.name.charAt(0).toUpperCase(), cx, cy);
    }
  }

  // === Tree overlay (depth) ===
  for (let row = 0; row < zone.height; row++) {
    for (let col = 0; col < zone.width; col++) {
      if (zone.tilemap[row]?.[col] !== TILE.TREE) continue;
      const px = col * SCALED_TILE;
      const py = row * SCALED_TILE;
      const variant = (col + row) % 3;
      const treeImg = variant % 2 === 0 ? assets.tree1 : assets.tree2;
      if (treeImg) {
        const drawW = SCALED_TILE;
        const drawH = SCALED_TILE * (45 / 30);
        const offsetY = SCALED_TILE - drawH;
        ctx.drawImage(treeImg, 0, 0, treeImg.width, treeImg.height, px, py + offsetY, drawW, drawH);
      } else {
        ctx.fillStyle = '#395A10';
        ctx.fillRect(px + 18, py + 32, 12, 16);
        ctx.fillStyle = '#399431';
        ctx.beginPath();
        ctx.arc(px + SCALED_TILE / 2, py + SCALED_TILE / 2 - 4, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Scale down to target size
  const output = document.createElement('canvas');
  output.width = canvasW;
  output.height = canvasH;
  const outCtx = output.getContext('2d')!;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(offscreen, 0, 0, fullW, fullH, 0, 0, canvasW, canvasH);

  return output.toDataURL('image/png');
}
