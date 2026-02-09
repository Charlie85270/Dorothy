import { Direction, SpriteFrame } from './types';

const PLAYER_SHEET_WIDTH = 213;
const PLAYER_SHEET_HEIGHT = 19;
const PLAYER_FRAME_COUNT = 12;
const PLAYER_FRAME_WIDTH = PLAYER_SHEET_WIDTH / PLAYER_FRAME_COUNT; // ~17.75

// Direction to frame offset mapping
const DIRECTION_FRAME_OFFSET: Record<Direction, number> = {
  down: 0,
  left: 3,
  up: 6,
  right: 9,
};

// Inset to avoid bleeding edge pixels from adjacent frames
const PLAYER_INSET = 1;

export function getPlayerFrame(direction: Direction, animFrame: number): SpriteFrame {
  const baseFrame = DIRECTION_FRAME_OFFSET[direction];
  const frameIndex = baseFrame + animFrame;
  return {
    sx: frameIndex * PLAYER_FRAME_WIDTH + PLAYER_INSET,
    sy: 0,
    sw: PLAYER_FRAME_WIDTH - PLAYER_INSET * 2,
    sh: PLAYER_SHEET_HEIGHT,
  };
}

// Pokemon sprite sheet (back.png) is 2000x1600
// Grid approximately 25 cols x 20 rows = 80x80 per sprite
const POKEMON_SPRITE_SIZE = 80;
const POKEMON_COLS = 25;

export function getPokemonFrame(row: number, col: number): SpriteFrame {
  return {
    sx: col * POKEMON_SPRITE_SIZE,
    sy: row * POKEMON_SPRITE_SIZE,
    sw: POKEMON_SPRITE_SIZE,
    sh: POKEMON_SPRITE_SIZE,
  };
}

// Grass tile sprite (grass.png) - the visible grass tiles are in upper right
// The tile pattern is at approximately x=256, y=0, each tile 16x16
export const GRASS_TILE_FRAME: SpriteFrame = {
  sx: 256,
  sy: 0,
  sw: 16,
  sh: 16,
};

// Chen sprite (chen.png) is 80x128 - single static sprite
export const CHEN_SPRITE = {
  width: 80,
  height: 128,
};

// House sprite (house.png) is 109x100 - single building
export const HOUSE_SPRITE = {
  width: 109,
  height: 100,
};

// Battle background (pokemon-battle.png) is 240x160
export const BATTLE_BG = {
  width: 240,
  height: 160,
};
