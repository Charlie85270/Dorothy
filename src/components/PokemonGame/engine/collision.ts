import { TILE, MAP_DATA, MAP_WIDTH, MAP_HEIGHT } from '../constants';

const SOLID_TILES = new Set<number>([TILE.TREE, TILE.BUILDING, TILE.FENCE, TILE.WATER]);

export function isSolid(tileX: number, tileY: number): boolean {
  if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
    return true;
  }
  return SOLID_TILES.has(MAP_DATA[tileY][tileX]);
}

export function canMoveTo(tileX: number, tileY: number): boolean {
  return !isSolid(tileX, tileY);
}

export function getTileAt(tileX: number, tileY: number): number {
  if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
    return TILE.TREE;
  }
  return MAP_DATA[tileY][tileX];
}
