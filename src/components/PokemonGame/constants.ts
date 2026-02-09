import { Building, InteriorConfig, InteriorRoomConfig, Position } from './types';

// ── Tile Constants ──────────────────────────────────────────────────────────
export const TILE = {
  GRASS: 0,
  TREE: 1,
  PATH: 2,
  TALL_GRASS: 3,
  BUILDING: 4,
  DOOR: 5,
  FLOWER: 6,
  FENCE: 7,
  SIGN: 8,
  WATER: 9,
} as const;

// ── Rendering Constants ─────────────────────────────────────────────────────
export const TILE_SIZE = 16;
export const SCALE = 3;
export const SCALED_TILE = TILE_SIZE * SCALE; // 48

// ── Map Dimensions ──────────────────────────────────────────────────────────
export const MAP_WIDTH = 42;
export const MAP_HEIGHT = 36;

// ── Movement ────────────────────────────────────────────────────────────────
export const MOVE_DURATION = 180;

// ── Player Start Position ───────────────────────────────────────────────────
export const PLAYER_START: Position = { x: 16, y: 7 };

// ── Professor Chen Position ─────────────────────────────────────────────────
export const PROFESSOR_CHEN_POS: Position = { x: 20, y: 24 };

// ── Buildings ───────────────────────────────────────────────────────────────
export const BUILDINGS: Building[] = [
  { id: 'dashboard', label: 'CLAUDE LAB', route: '/', x: 14, y: 3, width: 5, height: 4,
    doorX: 16, doorY: 6, buildingType: 'lab', spriteFile: '/pokemon/house/sprite_6.png',
    description: 'Welcome to Claude Lab! Your command center awaits.', interiorId: 'claude-lab' },

  { id: 'usage', label: 'USAGE CTR', route: '/usage', x: 30, y: 4, width: 4, height: 3,
    doorX: 32, doorY: 6, buildingType: 'center', spriteFile: '/pokemon/house/sprite_3.png',
    description: 'Usage Center - Monitor your resource consumption.' },

  { id: 'kanban', label: 'KANBAN MART', route: '/kanban', x: 4, y: 9, width: 4, height: 3,
    doorX: 6, doorY: 11, buildingType: 'mart', spriteFile: '/pokemon/house/sprite_5.png',
    description: 'Kanban Mart - Organize tasks on your board!' },

  { id: 'agents', label: 'AGENT GYM', route: '/agents', x: 26, y: 9, width: 5, height: 3,
    doorX: 28, doorY: 11, buildingType: 'gym', spriteFile: '/pokemon/house/sprite_4.png',
    description: 'Agent Gym - Train and manage your AI agents!' },

  { id: 'scheduler', label: 'SCHEDULER', route: '/recurring-tasks', x: 10, y: 14, width: 4, height: 3,
    doorX: 12, doorY: 16, buildingType: 'house', spriteFile: '/pokemon/house/house.png',
    description: 'Scheduler - Set up recurring tasks!' },

  { id: 'settings', label: 'SETTINGS', route: '/settings', x: 28, y: 14, width: 3, height: 3,
    doorX: 29, doorY: 16, buildingType: 'house', spriteFile: '/pokemon/house/settings.png',
    description: 'Settings - Customize your experience.', interiorId: 'settings' },

  { id: 'skills', label: 'SKILL DOJO', route: '/skills', x: 4, y: 20, width: 4, height: 3,
    doorX: 6, doorY: 22, buildingType: 'dojo', spriteFile: '/pokemon/house/sprite_11.png',
    description: 'Skill Dojo - Learn new abilities!', interiorId: 'skills' },

  { id: 'plugins', label: 'PLUGIN SHOP', route: '/plugins', x: 17, y: 19, width: 4, height: 3,
    doorX: 19, doorY: 21, buildingType: 'shop', spriteFile: '/pokemon/house/sprite_15.png',
    description: 'Plugin Shop - Extend your powers!', interiorId: 'plugin-shop' },

  { id: 'automations', label: 'AUTO PLANT', route: '/automations', x: 8, y: 27, width: 4, height: 3,
    doorX: 10, doorY: 29, buildingType: 'plant', spriteFile: '/pokemon/house/sprite_19.png',
    description: 'Auto Plant - Automate your workflows!' },

  { id: 'projects', label: 'PROJECT LAB', route: '/projects', x: 28, y: 27, width: 4, height: 3,
    doorX: 30, doorY: 29, buildingType: 'lab', spriteFile: '/pokemon/house/sprite_8.png',
    description: 'Project Lab - Manage your projects!' },
];

// ── Pokemon Sprite Constants ────────────────────────────────────────────────
export const POKEMON_SPRITE_COLS = 25;
export const POKEMON_SPRITE_SIZE = 80;

// ── Character-to-Pokemon Mapping ────────────────────────────────────────────
export const CHARACTER_POKEMON_MAP: Record<string, { row: number; col: number; name: string }> = {
  robot: { row: 0, col: 0, name: 'Bulbasaur' },
  ninja: { row: 0, col: 3, name: 'Charmander' },
  wizard: { row: 0, col: 6, name: 'Squirtle' },
  astronaut: { row: 0, col: 24, name: 'Pikachu' },
  knight: { row: 1, col: 0, name: 'Nidoran' },
  pirate: { row: 1, col: 6, name: 'Vulpix' },
  alien: { row: 2, col: 0, name: 'Jigglypuff' },
  viking: { row: 2, col: 5, name: 'Psyduck' },
  frog: { row: 2, col: 14, name: 'Poliwag' },
};

// ── Map Generation ──────────────────────────────────────────────────────────

function generateMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < MAP_HEIGHT; row++) {
    map[row] = new Array(MAP_WIDTH).fill(TILE.GRASS);
  }

  // Organic tree border
  for (let col = 0; col < MAP_WIDTH; col++) {
    map[0][col] = TILE.TREE;
    map[1][col] = TILE.TREE;
    if (col < 3 || col > MAP_WIDTH - 4 || (col % 7 !== 3)) map[2][col] = TILE.TREE;
  }
  for (let col = 0; col < MAP_WIDTH; col++) {
    map[MAP_HEIGHT - 1][col] = TILE.TREE;
    map[MAP_HEIGHT - 2][col] = TILE.TREE;
    if (col < 3 || col > MAP_WIDTH - 4 || (col % 7 !== 4)) map[MAP_HEIGHT - 3][col] = TILE.TREE;
  }
  for (let row = 0; row < MAP_HEIGHT; row++) {
    map[row][0] = TILE.TREE;
    map[row][1] = TILE.TREE;
    if (row < 3 || row > MAP_HEIGHT - 4 || (row % 6 !== 2)) map[row][2] = TILE.TREE;
  }
  for (let row = 0; row < MAP_HEIGHT; row++) {
    map[row][MAP_WIDTH - 1] = TILE.TREE;
    map[row][MAP_WIDTH - 2] = TILE.TREE;
    if (row < 3 || row > MAP_HEIGHT - 4 || (row % 6 !== 3)) map[row][MAP_WIDTH - 3] = TILE.TREE;
  }

  // Interior tree clusters
  const treeClusters = [
    [8,4],[9,4],[8,5], [22,5],[23,5], [21,4],[22,4],
    [3,14],[3,15], [20,14],[21,14],
    [35,9],[36,9],[35,10], [36,15],[37,15],
    [13,21],[14,21], [33,22],[34,22],[33,23],
    [5,30],[6,30], [20,30],[21,30], [35,30],[36,30],
    [9,17],[25,17], [15,25],[16,25], [37,24],[38,24],
  ];
  for (const [col, row] of treeClusters) {
    if (row >= 0 && row < MAP_HEIGHT && col >= 0 && col < MAP_WIDTH) {
      map[row][col] = TILE.TREE;
    }
  }

  // Place buildings
  for (const b of BUILDINGS) {
    for (let row = b.y; row < b.y + b.height; row++) {
      for (let col = b.x; col < b.x + b.width; col++) {
        if (row >= 0 && row < MAP_HEIGHT && col >= 0 && col < MAP_WIDTH) {
          map[row][col] = TILE.BUILDING;
        }
      }
    }
    if (b.doorY >= 0 && b.doorY < MAP_HEIGHT && b.doorX >= 0 && b.doorX < MAP_WIDTH) {
      map[b.doorY][b.doorX] = TILE.DOOR;
    }
  }

  // Water pond
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const wx = 34 + dx, wy = 19 + dy;
      if (wy < MAP_HEIGHT && wx < MAP_WIDTH && map[wy][wx] === TILE.GRASS) {
        map[wy][wx] = TILE.WATER;
      }
    }
  }

  // Tall grass patches
  const tallGrassPatches = [
    { x: 10, y: 4, w: 3, h: 2 }, { x: 24, y: 5, w: 3, h: 2 },
    { x: 10, y: 9, w: 3, h: 2 }, { x: 20, y: 10, w: 3, h: 2 },
    { x: 5, y: 24, w: 3, h: 2 }, { x: 13, y: 24, w: 3, h: 2 },
    { x: 24, y: 24, w: 3, h: 2 }, { x: 15, y: 31, w: 4, h: 2 },
    { x: 28, y: 31, w: 3, h: 2 },
  ];
  for (const p of tallGrassPatches) {
    for (let row = p.y; row < p.y + p.h; row++) {
      for (let col = p.x; col < p.x + p.w; col++) {
        if (row >= 0 && row < MAP_HEIGHT && col >= 0 && col < MAP_WIDTH && map[row][col] === TILE.GRASS) {
          map[row][col] = TILE.TALL_GRASS;
        }
      }
    }
  }

  // Flower decorations
  const flowers = [
    [5,5],[12,5],[27,5],[5,8],[15,8],[24,8],
    [8,13],[15,13],[23,13],[6,17],[14,18],[24,18],[32,18],
    [10,23],[22,23],[30,23],[5,26],[16,26],[25,26],[35,26],
    [4,31],[22,31],[36,31],
  ];
  for (const [x, y] of flowers) {
    if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && map[y][x] === TILE.GRASS) {
      map[y][x] = TILE.FLOWER;
    }
  }

  return map;
}

export const MAP_DATA: number[][] = generateMap();

// ── Interior Configs ───────────────────────────────────────────────────────
export const INTERIOR_CONFIGS: Record<string, InteriorConfig> = {
  skills: {
    backgroundImage: '/pokemon/skill/background.png',
    npcSprite: '/pokemon/chen.png',
    npcName: 'Prof. Chen',
    npcDialogue: [
      'Welcome to the Skill Dojo!',
      'Here you can learn new abilities to power up your Claude agents.',
      'Browse the list and install any skill you like!',
    ],
    title: 'SKILL DOJO',
  },
  settings: {
    backgroundImage: '/pokemon/settings/back.png',
    npcDialogue: ['Booting up Settings PC...'],
    title: 'SETTINGS',
  },
  'claude-lab': {
    backgroundImage: '/pokemon/claude-lab/back.png',
    title: 'CLAUDE LAB',
  },
  'plugin-shop': {
    backgroundImage: '/pokemon/shop/back.png',
    npcSprite: '/pokemon/shop/vendor.png',
    npcName: 'Vendor',
    npcDialogue: [
      'Welcome to the Plugin Shop!',
      'We have all sorts of plugins to power up Claude Code.',
      'Browse around and pick what you need!',
    ],
    title: 'PLUGIN SHOP',
  },
};

// ── Interior Room Configs (walkable room layouts) ─────────────────────────
// Tile types: 0=floor, 1=wall, 2=furniture, 3=exit
export const INTERIOR_ROOM_CONFIGS: Record<string, InteriorRoomConfig> = {
  skills: {
    width: 12,
    height: 10,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1,1,1], // top wall
      [1,1,1,1,1,1,1,1,1,1,1,1], // wall (windows, board, shelf)
      [1,0,0,0,0,0,0,0,0,0,0,1], // walkable (Chen near board)
      [1,0,0,0,0,0,0,0,0,0,0,1], // walkable
      [1,0,0,0,0,2,2,2,0,0,0,1], // big desk (cols 5-7)
      [1,0,0,0,0,0,0,0,0,0,0,1], // walkable
      [1,0,0,0,0,2,2,0,0,0,0,1], // small desks (cols 5-6)
      [1,0,0,0,0,0,0,0,0,0,0,1], // walkable
      [1,2,0,0,0,0,0,0,0,0,2,1], // plants on sides
      [1,1,1,1,1,3,3,1,1,1,1,1], // bottom wall with exit
    ],
    npcPosition: { x: 5, y: 2 },  // Chen near the chalkboard
    playerStart: { x: 5, y: 8 },   // near the entrance
  },
  settings: {
    width: 10,
    height: 9,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1], // top wall
      [1,2,2,2,1,1,2,2,2,1], // cabinets + machines
      [1,2,2,0,0,0,0,2,2,1], // large machines (sides), walkable center
      [1,0,0,0,0,0,0,0,0,1], // walkable
      [1,0,0,2,2,0,0,0,0,1], // desk with computer (cols 3-4)
      [1,0,0,0,0,0,0,0,0,1], // walkable
      [1,0,0,0,0,0,0,2,0,1], // small item on right
      [1,2,0,0,0,0,0,0,2,1], // plants at bottom sides
      [1,1,1,1,3,3,1,1,1,1], // bottom wall with exit
    ],
    npcPosition: { x: 3, y: 4 },   // computer on desk (interaction point)
    playerStart: { x: 4, y: 7 },    // near the entrance
  },
  'plugin-shop': {
    width: 12,
    height: 10,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1,1,1], // top wall
      [1,2,2,2,2,2,2,2,2,2,2,1], // back wall items, shelves
      [1,2,2,2,0,0,0,0,0,0,0,0], // plant, register area
      [1,2,2,2,0,0,0,0,0,0,0,0], // counter left, vendor at (5,3) on blue floor
      [1,2,2,2,0,0,0,0,2,2,0,1], // counter row continues
      [0,0,0,0,0,0,0,0,2,2,0,1], // walkable, vending machines right
      [0,0,0,0,0,0,0,0,2,2,0,1], // walkable, vending machines right
      [0,2,2,0,0,0,0,0,0,0,0,1], // lower display left
      [0,0,0,0,0,0,0,0,0,0,0,1], // near exit
      [0,1,1,1,1,3,3,1,1,1,1,0], // exit
    ],
    npcPosition: { x: 1, y: 3 },   // vendor on blue floor in front of counter papers
    playerStart: { x: 5, y: 8 },    // near entrance
  },
  'claude-lab': {
    width: 14,
    height: 12,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1], // top wall
      [1,2,1,1,1,1,1,1,1,1,1,1,1,1], // scoreboard + wall
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1], // walkable arena
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1], // center area
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1], // player start row
      [1,1,1,1,1,1,3,3,1,1,1,1,1,1], // exit
    ],
    npcPosition: { x: -1, y: -1 },  // no static NPC (uses dynamicNPCs)
    playerStart: { x: 6, y: 10 },
    dynamicNPCs: true,
  },
};

// ── Pokemon Sprite Assignment for Agents ──────────────────────────────────

// Available individual pokemon sprite numbers (excluding 1 = Charizard reserved for super agents)
export const AVAILABLE_POKEMON_SPRITES: number[] = [
  2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
  41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,
  61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,
  81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,
  101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,
  121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,
  141,142,143,144,145,146,147,148,149,150,
];

// Agent grid positions inside claude-lab (up to 12 agents)
export const AGENT_GRID_POSITIONS: Position[] = [
  { x: 3, y: 3 },  { x: 6, y: 3 },  { x: 9, y: 3 },  { x: 12, y: 3 },
  { x: 3, y: 6 },  { x: 6, y: 6 },  { x: 9, y: 6 },  { x: 12, y: 6 },
  { x: 3, y: 9 },  { x: 6, y: 9 },  { x: 9, y: 9 },  { x: 12, y: 9 },
];

/** Simple string hash → deterministic number */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** Returns the sprite path for an agent. Super agents get Charizard (sprite_1). */
export function getAgentSpritePath(agentId: string, agentName?: string): string {
  const name = (agentName || '').toLowerCase();
  if (name.includes('super agent') || name.includes('orchestrator')) {
    return '/pokemon/poke/sprite_1.png';
  }
  const idx = hashString(agentId) % AVAILABLE_POKEMON_SPRITES.length;
  return `/pokemon/poke/sprite_${AVAILABLE_POKEMON_SPRITES[idx]}.png`;
}
