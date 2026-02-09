import { PlayerState, NPC, Building, Direction } from '../types';
import { BUILDINGS } from '../constants';
import { getTileAt } from './collision';
import { TILE } from '../constants';

function getFacingTile(player: PlayerState): { x: number; y: number } {
  const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
  const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
  return {
    x: Math.round(player.x) + dx[player.direction],
    y: Math.round(player.y) + dy[player.direction],
  };
}

export function getInteractableNPC(player: PlayerState, npcs: NPC[]): NPC | null {
  if (player.isMoving) return null;
  const facing = getFacingTile(player);
  return npcs.find(npc => npc.x === facing.x && npc.y === facing.y) ?? null;
}

export function getInteractableBuilding(player: PlayerState): Building | null {
  if (player.isMoving) return null;
  const facing = getFacingTile(player);
  const tile = getTileAt(facing.x, facing.y);
  if (tile === TILE.DOOR) {
    return BUILDINGS.find(b => b.doorX === facing.x && b.doorY === facing.y) ?? null;
  }
  return null;
}

/** Check if the player is currently standing on a door tile */
export function checkStandingOnDoor(player: PlayerState): Building | null {
  if (player.isMoving) return null;
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const tile = getTileAt(px, py);
  if (tile === TILE.DOOR) {
    return BUILDINGS.find(b => b.doorX === px && b.doorY === py) ?? null;
  }
  return null;
}

export function checkInteraction(player: PlayerState, npcs: NPC[]): NPC | Building | null {
  const npc = getInteractableNPC(player, npcs);
  if (npc) return npc;
  const building = getInteractableBuilding(player);
  if (building) return building;
  return null;
}

export function hasNearbyInteractable(player: PlayerState, npcs: NPC[]): boolean {
  return checkInteraction(player, npcs) !== null;
}
