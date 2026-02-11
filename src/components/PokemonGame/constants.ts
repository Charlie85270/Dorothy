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
  ROUTE_EXIT: 10,
  GRAVE: 11,
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

  { id: 'kanban', label: 'KANBAN CENTER', route: '/kanban', x: 4, y: 9, width: 4, height: 3,
    doorX: 6, doorY: 11, buildingType: 'center', spriteFile: '/pokemon/house/sprite_10.png',
    description: 'Kanban Center - Organize tasks on your board!', interiorId: 'kanban' },

  { id: 'agents', label: 'AGENT GYM', route: '/agents', x: 26, y: 9, width: 5, height: 3,
    doorX: 28, doorY: 11, buildingType: 'gym', spriteFile: '/pokemon/house/sprite_4.png',
    description: 'Agent Gym - Train and manage your AI agents!' },

  { id: 'scheduler', label: 'SCHEDULER', route: '/recurring-tasks', x: 10, y: 14, width: 4, height: 3,
    doorX: 12, doorY: 16, buildingType: 'house', spriteFile: '/pokemon/house/house.png',
    description: 'Scheduler - Set up recurring tasks!', interiorId: 'scheduler' },

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

  // Northern passage to Route 1 (blocked for now)
  for (const col of [24, 25, 26]) {
    map[0][col] = TILE.ROUTE_EXIT; // Walkable route transition trigger
    map[1][col] = TILE.GRASS; // Cleared path
    map[2][col] = TILE.GRASS; // Cleared path
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
    [5,5],[27,8],[8,13],[24,18],[10,23],[35,26],[22,31],
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
  kanban: {
    backgroundImage: '/pokemon/kanban/interior.png',
    npcDialogue: ['Opening the Kanban Board...'],
    title: 'KANBAN CENTER',
  },
  scheduler: {
    backgroundImage: '/pokemon/scheduler/interior.png',
    npcDialogue: ['Accessing the Schedule Board...'],
    title: 'SCHEDULER',
  },
  'vercel-hq': {
    backgroundImage: '/pokemon/vercel/interior.png',
    npcDialogue: ['Accessing Vercel Best Practices Board...'],
    title: 'VERCEL HQ',
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
  kanban: {
    width: 10,
    height: 9,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1], // row 0: top wall / ceiling
      [1,2,1,1,1,1,1,1,1,1], // row 1: board area (instrument left, board center)
      [1,1,2,2,2,2,2,2,2,1], // row 2: ledge below board — blocks walking
      [1,0,0,0,0,0,0,0,0,1], // row 3: first walkable row (face up → board)
      [1,0,0,0,0,0,0,0,0,1], // row 4: walkable
      [1,0,0,0,0,0,0,0,0,1], // row 5: walkable
      [1,0,0,0,0,0,0,0,0,1], // row 6: walkable
      [1,0,0,0,0,0,0,0,0,1], // row 7: near exit
      [1,1,1,1,3,3,1,1,1,1], // row 8: bottom wall with exit
    ],
    npcPosition: { x: 2, y: 1 },   // board starts at x=2 on the wall
    npcWidth: 7,                     // board spans x=2 through x=8
    playerStart: { x: 4, y: 7 },    // near entrance
  },
  scheduler: {
    width: 10,
    height: 9,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1], // row 0: top wall (TV, picture)
      [1,1,1,1,1,1,1,1,1,1], // row 1: upper wall
      [1,0,0,0,0,0,0,0,0,1], // row 2: walkable above whiteboard
      [1,0,0,2,1,1,1,0,0,1], // row 3: whiteboard top (wall — blocks scan from above)
      [1,0,0,2,1,1,1,0,0,1], // row 4: whiteboard mid (wall — blocks scan)
      [1,0,0,2,2,2,2,0,0,1], // row 5: whiteboard base (furniture — NPC/PC here)
      [1,0,0,0,0,0,0,0,0,1], // row 6: walkable
      [1,2,0,0,0,0,0,0,0,1], // row 7: gem decoration bottom-left
      [1,1,1,1,3,3,1,1,1,1], // row 8: exit
    ],
    npcPosition: { x: 3, y: 5 },   // PC on whiteboard base (furniture row)
    npcWidth: 1,                     // only the PC column
    playerStart: { x: 4, y: 6 },    // near entrance
  },
  'vercel-hq': {
    width: 12,
    height: 12,
    tilemap: [
      [1,1,1,1,1,1,1,1,1,1,1,1], // row 0: top wall (machines, awards)
      [1,2,2,2,2,0,0,0,2,2,2,1], // row 1: back wall (counter, shelves, frames)
      [1,0,0,0,0,0,0,0,0,0,0,0], // row 2: robot left, chalkboard right
      [1,2,2,0,0,0,0,1,1,1,0,0], // row 3: walkable
      [0,2,2,0,0,0,0,0,0,0,0,0], // row 4: walkable
      [0,0,0,0,0,0,0,0,0,0,0,0], // row 5: walkable
      [1,1,1,1,1,0,0,1,1,1,1,1], // row 6: walkable
      [1,1,1,1,1,0,0,1,1,1,1,1], // row 7: walkable
      [0,0,0,0,0,0,0,0,0,0,0,0], // row 8: walkable
      [0,0,0,0,0,0,0,0,0,0,0,0], // row 9: walkable
      [1,0,0,0,0,0,0,0,0,0,0,1], // row 10: plants on sides
      [1,1,1,1,1,3,3,1,1,1,1,1], // row 11: exit
    ],
    npcPosition: { x: 6, y: 0 },   // two framed papers on the top wall
    npcWidth: 1,                     // papers span x=5-6
    playerStart: { x: 5, y: 10 },   // near entrance
    interactables: [
      {
        id: 'vercel-pc',
        x: 2, y: 1, width: 1,
        speaker: 'VERCEL PC',
        dialogue: [
          'Booting Cloud Functions and Analytics....',
          'Tunununu.....',
          'Image optimization activated .....',
          'Tunununu.....',
          'Printing the bill.......',
          '4,678$. Uch.',
        ],
      },
      {
        id: 'rocker',
        x: 8, y: 9,
        speaker: 'Young CEO',
        spritePath: '/pokemon/pnj/rocker.png',
        direction: 'down',
        dialogue: [
          'Man Vercel is so fucking cool. I can deploy my SaaS in seconds, it even compress images without coding.',
          'I can rollback anytime I want, use AI Gateway, Core Platform, CI/CD,Fluid Compute... Fuck you Developer, I\'m the boss now.',
          'And you\'ll not believe it, but I only pay 14,657$ per month.',
          'Can\'t wait to scale my SaaS to 100,000 users. Only 99 876 left.',
        ],
      },
      {
        id: 'leader',
        x: 3, y: 5,
        speaker: 'Guillaume',
        spritePath: '/pokemon/pnj/leader.png',
        direction: 'left',
        exitAfterDialogue: true,
        dialogue: [
          'Every Monday I get a deep AI analysis of our metrics across every product area to enjoy with my coffee.',
          'Anomalies, growth, trends, recommendations. AI spots patterns human analysts easily miss. I can @ the agent for further questions.',
          'AI will soon be running every company.',
          'No point in building things if you don’t ship them.',
          'There’s never been a better time to start a company.',
          'Oh shit the time flew by, already 3 min without pushing to prod, I need to go ser(verless lol), sorry, euuh bye.',
        ],
      },
    ],
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
  2,3,4,5,6,7,8,9,10,11,12,13,14,
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
    return '/pokemon/poke/1.png';
  }
  const idx = hashString(agentId) % AVAILABLE_POKEMON_SPRITES.length;
  return `/pokemon/poke/${AVAILABLE_POKEMON_SPRITES[idx]}.png`;
}

// ── Route 1 Map ──────────────────────────────────────────────────────────────
export const ROUTE1_WIDTH = 30;
export const ROUTE1_HEIGHT = 40;
export const ROUTE1_PLAYER_START: Position = { x: 14, y: 37 };

// ── Route 1 Buildings ──────────────────────────────────────────────────────
export const ROUTE1_BUILDINGS: { id: string; label: string; x: number; y: number; width: number; height: number; doorX: number; doorY: number; spriteFile: string; interiorId?: string }[] = [
  { id: 'vercel-party', label: 'VERCEL HQ', x: 4, y: 19, width: 4, height: 3, doorX: 5, doorY: 21, spriteFile: '/pokemon/house/vercel.png', interiorId: 'vercel-hq' },
];

function generateRoute1Map(): number[][] {
  const w = ROUTE1_WIDTH;
  const h = ROUTE1_HEIGHT;
  const map: number[][] = [];

  // Fill EVERYTHING with trees (path will be carved out)
  for (let row = 0; row < h; row++) {
    map[row] = new Array(w).fill(TILE.TREE);
  }

  // Helper: carve a rectangular grass area
  function carve(x1: number, y1: number, x2: number, y2: number) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) map[y][x] = TILE.GRASS;
      }
    }
  }

  // ── S-shaped snake path (7 tiles wide = center ± 3) ──
  // Path segments defined by centerline:
  //   Start at bottom center, snake left-right going north
  const P = 3; // half-width of path (total = 7 tiles)

  // Seg 1: South entrance going up (center x=14, from row 39 to 32)
  carve(14 - P, 32, 14 + P, 39);

  // Seg 2: Turn left at row 32 (horizontal, x from 14 to 7)
  carve(7 - P, 32 - P, 14 + P, 32 + P);

  // Seg 3: Go up on left side (center x=7, from row 32 to 22)
  carve(7 - P, 22, 7 + P, 32);

  // Seg 4: Turn right at row 22 (horizontal, x from 7 to 22)
  carve(7 - P, 22 - P, 22 + P, 22 + P);

  // Seg 5: Go up on right side (center x=22, from row 22 to 12)
  carve(22 - P, 12, 22 + P, 22);

  // Seg 6: Turn left at row 12 (horizontal, x from 22 to 8)
  carve(8 - P, 12 - P, 22 + P, 12 + P);

  // Seg 7: Go up to top (center x=8, from row 12 to 3)
  carve(8 - P, 3, 8 + P, 12);

  // Wider clearing at the top
  carve(5, 3, 15, 7);

  // ── North path (toward ferry / next map) ──
  // Carve a 5-tile wide path going north from the top clearing to the map edge
  carve(9, 0, 11, 3);

  // ── South exit (3-tile gap in tree wall) ──
  // Narrow the very bottom to a 3-tile exit
  for (let col = 0; col < w; col++) {
    if (col < 13 || col > 15) {
      map[39][col] = TILE.TREE;
      map[38][col] = TILE.TREE;
    }
  }
  for (let col = 13; col <= 15; col++) {
    map[39][col] = TILE.ROUTE_EXIT;
    map[38][col] = TILE.GRASS;
  }

  // ── Tall grass patches (within the carved path) ──
  const tallGrassPatches = [
    // Near south entrance
    { x: 12, y: 34, w: 4, h: 2 },
    // Left corridor
    { x: 5, y: 27, w: 3, h: 3 },
    { x: 7, y: 24, w: 3, h: 2 },
    // Middle horizontal (lower)
    { x: 13, y: 20, w: 4, h: 2 },
    // Right corridor
    { x: 20, y: 16, w: 3, h: 3 },
    { x: 21, y: 13, w: 3, h: 2 },
    // Middle horizontal (upper)
    { x: 13, y: 10, w: 4, h: 2 },
    // Top area
    { x: 6, y: 5, w: 3, h: 2 },
    { x: 11, y: 4, w: 3, h: 2 },
  ];
  for (const p of tallGrassPatches) {
    for (let row = p.y; row < p.y + p.h; row++) {
      for (let col = p.x; col < p.x + p.w; col++) {
        if (row >= 0 && row < h && col >= 0 && col < w && map[row][col] === TILE.GRASS) {
          map[row][col] = TILE.TALL_GRASS;
        }
      }
    }
  }

  // ── Flower decorations (scattered in the path) ──
  const flowers: [number, number][] = [
    [15, 36], [13, 33], [6, 30], [9, 26], [10, 21],
    [20, 20], [23, 18], [24, 14], [16, 11], [10, 10],
    [7, 7], [13, 5], [8, 4],
  ];
  for (const [x, y] of flowers) {
    if (y >= 0 && y < h && x >= 0 && x < w && map[y][x] === TILE.GRASS) {
      map[y][x] = TILE.FLOWER;
    }
  }

  // ── Fences (horizontal barriers for variety) ──
  // Fence across the lower horizontal corridor
  for (let col = 11; col <= 14; col++) {
    if (map[21][col] === TILE.GRASS) map[21][col] = TILE.FENCE;
  }
  // Fence in the upper horizontal corridor
  for (let col = 15; col <= 18; col++) {
    if (map[11][col] === TILE.GRASS) map[11][col] = TILE.FENCE;
  }

  // ── Signs ──
  map[36][16] = TILE.SIGN; // "Northern Route" sign near south entrance

  // ── Scattered trees inside the path for natural feel ──
  const innerTrees: [number, number][] = [
    // Left corridor
    [8, 28], [6, 26],
    // Lower horizontal
    [11, 23], [14, 24],
    // Right corridor
    [21, 19], [24, 17],
    // Upper horizontal
    [18, 10], [12, 13],
    // Top area
    [12, 6], [14, 4],
    // Near south
    [16, 35], [12, 37], [17, 36],
  ];
  for (const [x, y] of innerTrees) {
    if (y >= 0 && y < h && x >= 0 && x < w && map[y][x] === TILE.GRASS) {
      map[y][x] = TILE.TREE;
    }
  }

  // ── Graveyard (bottom-right of the horizontal corridor) ──
  // Carve extra rows south for the graveyard
  carve(19, 26, 25, 27);

  // Fence border
  const gyT = 21, gyB = 27, gyL = 19, gyR = 25;
  const gyEntryY = 24; // entry on left side
  for (let x = gyL; x <= gyR; x++) {
    map[gyT][x] = TILE.FENCE;
    map[gyB][x] = TILE.FENCE;
  }
  for (let y = gyT; y <= gyB; y++) {
    if (y !== gyEntryY) map[y][gyL] = TILE.FENCE;
    map[y][gyR] = TILE.FENCE;
  }

  // Gravestones (3 columns x 3 rows, every other tile)
  const gravePositions: [number, number][] = [
    [20, 22], [22, 22], [24, 22],
    [22, 24], [24, 24],
    [20, 26], [22, 26], [24, 26],
  ];
  for (const [gx, gy] of gravePositions) {
    map[gy][gx] = TILE.GRAVE;
  }

  // ── Route 1 buildings ──
  for (const b of ROUTE1_BUILDINGS) {
    for (let row = b.y; row < b.y + b.height; row++) {
      for (let col = b.x; col < b.x + b.width; col++) {
        if (row >= 0 && row < h && col >= 0 && col < w) {
          map[row][col] = TILE.BUILDING;
        }
      }
    }
    if (b.doorY >= 0 && b.doorY < h && b.doorX >= 0 && b.doorX < w) {
      map[b.doorY][b.doorX] = TILE.DOOR;
    }
  }

  return map;
}

export const ROUTE1_MAP_DATA: number[][] = generateRoute1Map();
