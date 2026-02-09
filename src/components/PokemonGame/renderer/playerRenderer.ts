import { PlayerState, GameAssets } from '../types';
import { SCALED_TILE, SCALE } from '../constants';
import { Camera } from '../engine/camera';
import { getPlayerFrame } from '../sprites';

export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera,
  assets: GameAssets
) {
  // Calculate interpolated pixel position
  let pixelX: number;
  let pixelY: number;

  if (player.isMoving) {
    pixelX = (player.x + (player.targetX - player.x) * player.moveProgress) * SCALED_TILE;
    pixelY = (player.y + (player.targetY - player.y) * player.moveProgress) * SCALED_TILE;
  } else {
    pixelX = player.x * SCALED_TILE;
    pixelY = player.y * SCALED_TILE;
  }

  const screenX = pixelX - camera.x;
  const screenY = pixelY - camera.y;

  if (assets.player) {
    const frame = getPlayerFrame(player.direction, player.animFrame);
    ctx.imageSmoothingEnabled = false;
    // Draw player sprite scaled up
    const drawWidth = frame.sw * SCALE;
    const drawHeight = frame.sh * SCALE;
    // Center horizontally on tile, align bottom to tile bottom
    const offsetX = (SCALED_TILE - drawWidth) / 2;
    const offsetY = SCALED_TILE - drawHeight;
    ctx.drawImage(
      assets.player,
      frame.sx, frame.sy, frame.sw, frame.sh,
      screenX + offsetX, screenY + offsetY, drawWidth, drawHeight
    );
  } else {
    // Fallback: simple colored square
    ctx.fillStyle = '#f83838';
    ctx.fillRect(screenX + 8, screenY + 8, SCALED_TILE - 16, SCALED_TILE - 16);
    // Hat
    ctx.fillStyle = '#e82020';
    ctx.fillRect(screenX + 12, screenY + 4, SCALED_TILE - 24, 12);
  }
}

export function getPlayerPixelPosition(player: PlayerState): { x: number; y: number } {
  if (player.isMoving) {
    return {
      x: (player.x + (player.targetX - player.x) * player.moveProgress) * SCALED_TILE,
      y: (player.y + (player.targetY - player.y) * player.moveProgress) * SCALED_TILE,
    };
  }
  return {
    x: player.x * SCALED_TILE,
    y: player.y * SCALED_TILE,
  };
}
