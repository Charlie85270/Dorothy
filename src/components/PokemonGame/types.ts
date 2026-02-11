export type Direction = 'down' | 'up' | 'left' | 'right';

export type Screen = 'title' | 'game' | 'battle' | 'menu' | 'interior' | 'route';

export type TileType =
  | 'grass'      // 0 - walkable ground
  | 'tree'       // 1 - solid tree border
  | 'path'       // 2 - walkable (unused, kept for compat)
  | 'tallGrass'  // 3 - walkable with overlay effect
  | 'building'   // 4 - solid building body
  | 'door'       // 5 - walkable interaction trigger
  | 'flower'     // 6 - decoration on grass
  | 'fence'      // 7 - solid fence
  | 'sign'       // 8 - readable sign
  | 'water';     // 9 - impassable water

export interface Position {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  isMoving: boolean;
  moveProgress: number; // 0-1 interpolation between tiles
  animFrame: number;    // 0, 1, 2 for walk cycle
}

export interface NPC {
  id: string;
  name: string;
  type: 'professor' | 'agent' | 'wanderer';
  x: number;
  y: number;
  direction: Direction;
  spriteIndex?: number; // index into pokemon sprite sheet for agents
  spritePath?: string;  // path to individual pokemon sprite image
  animFrame?: number;   // walk cycle frame for sprite sheet NPCs
  agentStatus?: string;
  agentProject?: string;
  dialogue: string[];
}

export type BuildingType = 'lab' | 'gym' | 'center' | 'mart' | 'house' | 'dojo' | 'shop' | 'plant';

export interface Building {
  id: string;
  label: string;
  route: string;
  x: number;       // tile position (top-left)
  y: number;
  width: number;    // in tiles
  height: number;
  doorX: number;    // door tile position
  doorY: number;
  description: string;
  buildingType: BuildingType;
  spriteFile: string; // path to house sprite image
  interiorId?: string; // links to INTERIOR_CONFIGS for in-game interiors
}

export interface GameAssets {
  player: HTMLImageElement | null;
  grass: HTMLImageElement | null;
  tallGrass: HTMLImageElement | null;
  tree1: HTMLImageElement | null;
  tree2: HTMLImageElement | null;
  buildingSprites: Record<string, HTMLImageElement>;
  interiorBackgrounds: Record<string, HTMLImageElement>;
  // Legacy - may be null if files removed
  back: HTMLImageElement | null;
  chen: HTMLImageElement | null;
  pokemonBattle: HTMLImageElement | null;
  title: HTMLImageElement | null;
}

export interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface GameState {
  screen: Screen;
  player: PlayerState;
  npcs: NPC[];
  buildings: Building[];
  interacting: NPC | Building | null;
  dialogueText: string | null;
  dialogueQueue: string[];
  assetsLoaded: boolean;
  showInteractionPrompt: boolean;
  titleStarted: boolean;
}

// ── Interior System Types ──────────────────────────────────────────────────

export type InteriorPhase = 'entering' | 'room' | 'dialogue' | 'content' | 'terminal';

export interface InteriorConfig {
  backgroundImage: string;
  npcSprite?: string;
  npcName?: string;
  npcDialogue?: string[];
  title: string;
}

export interface InteriorNPC {
  id: string;
  x: number;
  y: number;
  spritePath: string;
  name: string;
  status?: string;
  project?: string;
}

export interface InteriorContentProps {
  onExit: () => void;
  onOpenTerminal: (config: TerminalConfig) => void;
  onTalkToAgent?: (agentId: string) => void;
  onInstallSkill?: (repo: string, title: string) => void;
  onInstallPlugin?: (command: string, title: string) => void;
  selectedNpcId?: string;
  agents?: { id: string; name: string; status: string; assignedProject?: string }[];
}

export interface TerminalConfig {
  title: string;
  repo: string;
}

export interface InteriorRoomConfig {
  width: number;
  height: number;
  tilemap: number[][];
  npcPosition: Position;
  npcWidth?: number;       // how many tiles wide the interaction zone is (default 1)
  playerStart: Position;
  dynamicNPCs?: boolean;
}

export interface PokemonMenuItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  installs?: string;
  repo?: string;
  badge?: string | null;
  badgeColor?: string;
}
