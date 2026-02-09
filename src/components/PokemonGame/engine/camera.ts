import { MAP_WIDTH, MAP_HEIGHT, SCALED_TILE } from '../constants';

export interface Camera {
  x: number;
  y: number;
}

export function calculateCamera(
  playerPixelX: number,
  playerPixelY: number,
  viewportWidth: number,
  viewportHeight: number
): Camera {
  const mapPixelWidth = MAP_WIDTH * SCALED_TILE;
  const mapPixelHeight = MAP_HEIGHT * SCALED_TILE;

  // Center camera on player
  let camX = playerPixelX - viewportWidth / 2 + SCALED_TILE / 2;
  let camY = playerPixelY - viewportHeight / 2 + SCALED_TILE / 2;

  // Clamp to map bounds
  camX = Math.max(0, Math.min(camX, mapPixelWidth - viewportWidth));
  camY = Math.max(0, Math.min(camY, mapPixelHeight - viewportHeight));

  return { x: Math.round(camX), y: Math.round(camY) };
}

export function getVisibleTileRange(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number
): { startX: number; startY: number; endX: number; endY: number } {
  const startX = Math.max(0, Math.floor(camera.x / SCALED_TILE) - 1);
  const startY = Math.max(0, Math.floor(camera.y / SCALED_TILE) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((camera.x + viewportWidth) / SCALED_TILE) + 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((camera.y + viewportHeight) / SCALED_TILE) + 1);
  return { startX, startY, endX, endY };
}
