'use client';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { GameAssets, Direction, PlayerState } from '../types';
import { TILE, SCALED_TILE, SCALE, MOVE_DURATION, ROUTE1_MAP_DATA, ROUTE1_WIDTH, ROUTE1_HEIGHT, ROUTE1_PLAYER_START, ROUTE1_BUILDINGS } from '../constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { useKeyboard } from '../hooks/useKeyboard';
import { renderPlayer, getPlayerPixelPosition } from '../renderer/playerRenderer';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills } from '@/hooks/useElectron';
import { SKILLS_DATABASE } from '@/lib/skills-database';

const SOLID_TILES = new Set<number>([TILE.TREE, TILE.BUILDING, TILE.FENCE, TILE.WATER, TILE.SIGN, TILE.GRAVE]);

// Persists across RouteOverlay mounts (survives interior transitions)
let officerMovedState: { x: number; y: number; direction: Direction } | null = null;

// Sign dialogue data: "x,y" → lines of text
const ROUTE1_SIGNS: Record<string, string[]> = {
  '16,36': ['ROUTE 1', 'Northern Route'],
};

// Gravestone dialogue data: "x,y" → lines of text
const ROUTE1_GRAVES: Record<string, string[]> = {
  '20,22': ['Simple Claw', '2026 - 2026'],
  '22,22': ['ClawClick', '2026 - 2026'],
  '24,22': ['OneClickClaw', '2026 - 2026'],
  '22,24': ['ClawFast', '2026 - 2026'],
  '24,24': ['Motlbot', '2026 - 2026'],
  '20,26': ['Jeffrey Epstein', '1953 - Still alive', 'WTF ?'],
  '22,26': ['OneShotClaw', '2026 - 2026'],
  '24,26': ['LeftClickClaw', '2026 - 2026'],
};

// ── Conversation tree system ─────────────────────────────────────────────────
// Each node is a piece of NPC dialogue, optionally followed by player choices.
// Choices lead to the next node, forming a tree of arbitrary depth.
interface ConversationNode {
  text: string;
  speaker?: string; // defaults to NPC name if omitted
  choices?: ConversationChoice[]; // if absent, conversation ends after this text
}

interface ConversationChoice {
  id: string;
  label: string;
  color?: string;
  next: ConversationNode;
}

// Route 1 NPCs
interface RouteNPC {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: Direction;
  spritePath: string;
  dialogue: string[];
  sightRange?: number;
  battleSprite?: string;
  conversation?: ConversationNode; // battle conversation tree
  patrol?: Direction[]; // repeating walk pattern (one step per direction entry)
  spritePerDirection?: Record<Direction, string>; // separate sprite images per direction
}

// Mutable patrol NPC walk state
interface PatrolState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  isMoving: boolean;
  moveProgress: number;
  patrolStep: number;
  waitTimer: number; // ms to wait before next step
}

const ROUTE1_NPCS: RouteNPC[] = [
  {
    id: 'vibe-coder',
    name: 'Vibe Coder',
    x: 12,
    y: 36,
    direction: 'right',
    spritePath: '/pokemon/pnj/vibe-coder.png',
    dialogue: [
      'Hey! I\'m just vibing here, coding in the wild.',
      'Do you want to see my ClawBot fork?',
    ],
    sightRange: 5,
    battleSprite: '/pokemon/battle/vide-coder.png',
    conversation: {
      text: 'Vibe Coder wants to show you his fork!',
      choices: [
        {
          id: 'more',
          label: 'TELL ME MORE',
          next: {
            text: 'Look Bro, I forked ClawBot to use it with Codex 6 Kernel 2.65, I manage 84 parallel agents on the same screen and I changed the color of the logo on the top bar. All without coding, developer are so dead. Oh...And I control it using my wife\'s sex toy.',
            choices: [
              {
                id: 'key',
                label: 'INTERESTING... BUT WHAT\'S THIS KEY I SEE ON THE CODE?',
                next: {
                  text: 'It\'s my Anthropic API key, bro, that\'s how it works. Did I tell you I could tell it to scrape weather apps to display the sun on my microwave?',
                  choices: [
                    {
                      id: 'port',
                      label: 'IS THE PORT 8000 ON YOUR PC OPEN TO EVERYONE !?',
                      next: { text: 'Yes, my dear, it\'s a custom setup so I can talk to my agent from anywhere. It\'s really useful when I\'m on the bus.... Anyway you understand nothing, I\'ve got other things to do to talk with idiots, I\'ve already received five offers on trustmrr, I need to check them out. Bye!' },
                    },
                    {
                      id: 'weather',
                      label: 'ENOUGH TIME LOST, BYE.',
                      next: { text: 'Alright, see you around! Keep vibing!' },
                    },
                  ],
                },
              },
              {
                id: 'enough',
                label: 'ENOUGH FOR ME, SEE YOU LATER',
                next: { text: 'Alright, see you around! Keep vibing!' },
              },
            ],
          },
        },
        {
          id: 'nope',
          label: 'I DON\'T GIVE A SHIT',
          next: { text: 'Nobody cares about what I\'m building, but that won\'t stop me.' },
        },
      ],
    },
  },
  {
    id: 'graveyard-twin',
    name: 'MCP',
    x: 18,
    y: 23,
    direction: 'left',
    spritePath: '/pokemon/pnj/twin.png',
    dialogue: [
      'Look at all these "one click deploy clawbot" projects...',
      'It\'s a disaster, we\'re running out of space in the graveyard...',
    ],
  },
  {
    id: 'sailor-1',
    name: 'Sailor',
    x: 9,
    y: 1,
    direction: 'down',
    spritePath: '/pokemon/pnj/sailor.png',
    dialogue: [
      'The ferry hasn\'t arrived yet. Please come back later.',
    ],
  },
  {
    id: 'sailor-2',
    name: 'Sailor',
    x: 10,
    y: 1,
    direction: 'down',
    spritePath: '/pokemon/pnj/sailor.png',
    dialogue: [
      'The ferry hasn\'t arrived yet. Please come back later.',
    ],
  },
  {
    id: 'sailor-3',
    name: 'Sailor',
    x: 11,
    y: 1,
    direction: 'down',
    spritePath: '/pokemon/pnj/sailor.png',
    dialogue: [
      'The ferry hasn\'t arrived yet. Please come back later.',
    ],
  },
  {
    id: 'officer',
    name: 'Officer',
    x: 5,
    y: 22,
    direction: 'down',
    spritePath: '/pokemon/pnj/officier.png',
    dialogue: [
      'Sorry my boy, it\'s a private Vercel HQ.',
    ],
  },
  {
    id: 'explorer',
    name: 'Explorer',
    x: 10,
    y: 13,
    direction: 'left',
    spritePath: '/pokemon/pnj/explorer.png',
    dialogue: [
      'Please help me, I beg you!',
      'I taught my agent the "Crypto Marketing Expert" skill, and now he\'s gone crazy and is talking nonsense!',
    ],
  },
  {
    id: 'patrol-pokemon',
    name: 'Wild Agent',
    x: 6,
    y: 12,
    direction: 'right',
    spritePath: '/pokemon/agent/face.png', // fallback, uses spritePerDirection
    dialogue: [
      'SOL at 1200$ in 2 months.',
      'My Polymarket bot went from $50 to $29,800 in 18 minutes. Coded.',
      'Alt season is coming.',
      'My contact at Blackrock told me they are secretly buying $DIDICK token on Base. Here is the contract : 0x454e44..',
      'I copy trade this guy and make 1000$ in 1 hour. He is a genius.',
      'Cobie is CZ',
    ],
    spritePerDirection: {
      down: '/pokemon/agent/face.png',
      up: '/pokemon/agent/back.png',
      left: '/pokemon/agent/left.png',
      right: '/pokemon/agent/right.png',
    },
    patrol: [
      'right', 'right', 'right',
      'down', 'down',
      'left', 'left', 'left',
      'up', 'up',
    ],
  },
];

// Encounter state machine
type EncounterPhase = 'idle' | 'alert' | 'approaching' | 'dialogue' | 'battle-text' | 'battle-choices';

interface EncounterState {
  phase: EncounterPhase;
  npcId: string;
  timer: number;
  npcX: number;
  npcY: number;
  npcTargetX: number;
  npcTargetY: number;
  npcMoving: boolean;
  npcMoveProgress: number;
  npcAnimFrame: number;
  npcDirection: Direction;
  triggered: boolean;
  conversationNode: ConversationNode | null; // current node in the conversation tree
}

// ── Pokeball positions on Route 1 ────────────────────────────────────────────
const POKEBALL_POSITIONS = [
  { x: 8, y: 33 },
];

interface RouteOverlayProps {
  assets: GameAssets;
  onExit: () => void;
  onInstallSkill?: (repo: string, title: string) => void;
  onEnterInterior?: (interiorId: string) => void;
  playerStart?: { x: number; y: number };
  onBattleStart?: () => void;
  onBattleEnd?: () => void;
}

export default function RouteOverlay({ assets, onExit, onInstallSkill, onEnterInterior, playerStart, onBattleStart, onBattleEnd }: RouteOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getKeys, consumeAction, consumeCancel } = useKeyboard();
  const exitTriggeredRef = useRef(false);
  const fadeRef = useRef(1); // 1 = fully black, fades to 0
  const routeNameTimerRef = useRef(3000); // ms for route name banner

  // Dialogue state (refs for game loop access)
  const dialogueRef = useRef<string | null>(null);
  const dialogueQueueRef = useRef<string[]>([]);
  const dialogueSpeakerRef = useRef<string | undefined>(undefined);
  const interactionCooldownRef = useRef(0);

  // Player state ref (mutable for game loop performance)
  const startX = playerStart?.x ?? ROUTE1_PLAYER_START.x;
  const startY = playerStart?.y ?? ROUTE1_PLAYER_START.y;
  const playerRef = useRef<PlayerState>({
    x: startX,
    y: startY,
    targetX: startX,
    targetY: startY,
    direction: 'up' as Direction,
    isMoving: false,
    moveProgress: 0,
    animFrame: 0,
  });

  // Cached grass and water tile canvases
  const grassCacheRef = useRef<HTMLCanvasElement | null>(null);
  const waterCacheRef = useRef<HTMLCanvasElement | null>(null);

  // NPC sprite cache
  const npcSpritesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Building sprite cache
  const buildingSpritesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Door interaction tracking
  const doorTriggeredRef = useRef(false);

  // NPC facing override (makes NPC face player during dialogue)
  const npcFacingOverrideRef = useRef<Map<string, Direction>>(new Map());

  // Patrol NPC mutable state (keyed by npc id)
  const patrolStatesRef = useRef<Map<string, PatrolState>>(new Map());
  // Initialize patrol states + preload direction sprites
  if (patrolStatesRef.current.size === 0) {
    for (const npc of ROUTE1_NPCS) {
      // Preload per-direction sprites
      if (npc.spritePerDirection) {
        for (const dir of ['down', 'up', 'left', 'right'] as Direction[]) {
          const key = `${npc.id}-${dir}`;
          if (!npcSpritesRef.current.has(key)) {
            const img = new Image();
            img.src = npc.spritePerDirection[dir];
            npcSpritesRef.current.set(key, img);
          }
        }
      }
      if (npc.patrol) {
        patrolStatesRef.current.set(npc.id, {
          x: npc.x,
          y: npc.y,
          targetX: npc.x,
          targetY: npc.y,
          direction: npc.direction,
          isMoving: false,
          moveProgress: 0,
          patrolStep: 0,
          waitTimer: 500, // initial pause before starting
        });
      }
    }
  }

  // Trainer encounter state
  const encounterRef = useRef<EncounterState | null>(null);
  const battleSelectedRef = useRef(0);
  const battleNavCooldownRef = useRef(0);
  const inBattleRef = useRef(false);

  // Pokeball state
  const collectedPokeballsRef = useRef<Set<string>>(new Set());
  const pokeballChoiceRef = useRef<{ skillName: string; skillRepo: string; pokeballKey: string; selected: number } | null>(null);

  // Detect uninstalled skills
  const { data: claudeData } = useClaude();
  const { installedSkills: electronSkills } = useElectronSkills();
  const uninstalledSkills = useMemo(() => {
    const fromPlugins = (claudeData?.plugins || []).map(p => p.name.toLowerCase());
    const fromClaudeSkills = (claudeData?.skills || []).map(s => s.name.toLowerCase());
    const fromElectron = electronSkills.map(s => s.toLowerCase());
    const installed = new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron]);
    return SKILLS_DATABASE.filter(s => !installed.has(s.name.toLowerCase()));
  }, [claudeData?.plugins, claudeData?.skills, electronSkills]);

  // Check if player has the Vercel Best Practices skill (ref so game loop always reads latest)
  const hasVercelSkillRef = useRef(false);
  useMemo(() => {
    const fromPlugins = (claudeData?.plugins || []).map(p => p.name.toLowerCase());
    const fromClaudeSkills = (claudeData?.skills || []).map(s => s.name.toLowerCase());
    const fromElectron = electronSkills.map(s => s.toLowerCase());
    const installed = new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron]);
    hasVercelSkillRef.current = installed.has('vercel-react-best-practices');
  }, [claudeData?.plugins, claudeData?.skills, electronSkills]);

  // Officer NPC state uses module-level variable (survives unmount during interior visits)
  const officerPendingMoveRef = useRef(false);

  // Pick a random uninstalled skill per pokeball (stable across renders)
  const pokeballSkillsRef = useRef<Map<string, { name: string; repo: string }>>(new Map());

  // Handle canvas resizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Collision check for Route 1
  const canMoveTo = useCallback((x: number, y: number) => {
    if (x < 0 || x >= ROUTE1_WIDTH || y < 0 || y >= ROUTE1_HEIGHT) return false;
    if (SOLID_TILES.has(ROUTE1_MAP_DATA[y][x])) return false;
    // Block NPC positions (use encounter position if active)
    const enc = encounterRef.current;
    for (const npc of ROUTE1_NPCS) {
      let nx: number, ny: number;
      const patrol = patrolStatesRef.current.get(npc.id);
      if (patrol) {
        // Use patrol NPC's current mutable position
        nx = patrol.isMoving ? patrol.targetX : patrol.x;
        ny = patrol.isMoving ? patrol.targetY : patrol.y;
      } else if (npc.id === 'officer' && officerMovedState) {
        nx = officerMovedState.x;
        ny = officerMovedState.y;
      } else {
        nx = enc && enc.npcId === npc.id ? Math.round(enc.npcX) : npc.x;
        ny = enc && enc.npcId === npc.id ? Math.round(enc.npcY) : npc.y;
      }
      if (nx === x && ny === y) return false;
    }
    // Block uncollected pokeball positions
    for (const pb of POKEBALL_POSITIONS) {
      if (pb.x === x && pb.y === y && !collectedPokeballsRef.current.has(`${x},${y}`)) return false;
    }
    return true;
  }, []);

  // Camera calculation for Route 1
  const calculateCamera = useCallback((px: number, py: number, vw: number, vh: number) => {
    const mapPW = ROUTE1_WIDTH * SCALED_TILE;
    const mapPH = ROUTE1_HEIGHT * SCALED_TILE;
    let camX = px - vw / 2 + SCALED_TILE / 2;
    let camY = py - vh / 2 + SCALED_TILE / 2;
    camX = Math.max(0, Math.min(camX, mapPW - vw));
    camY = Math.max(0, Math.min(camY, mapPH - vh));
    return { x: Math.round(camX), y: Math.round(camY) };
  }, []);

  // Ensure cached tiles
  const ensureGrassCache = useCallback(() => {
    if (grassCacheRef.current || !assets.grass) return;
    const c = document.createElement('canvas');
    c.width = SCALED_TILE;
    c.height = SCALED_TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets.grass, 0, 0, assets.grass.width, assets.grass.height, 0, 0, SCALED_TILE, SCALED_TILE);
    grassCacheRef.current = c;
  }, [assets.grass]);

  const ensureWaterCache = useCallback(() => {
    if (waterCacheRef.current) return;
    const s = SCALED_TILE;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#4890F8';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#68B0F8';
    ctx.fillRect(4, 8, 16, 3);
    ctx.fillRect(28, 24, 14, 3);
    ctx.fillRect(10, 38, 12, 3);
    ctx.fillStyle = '#3878D8';
    ctx.fillRect(20, 4, 12, 3);
    ctx.fillRect(4, 28, 10, 3);
    waterCacheRef.current = c;
  }, []);

  const gameLoop = useCallback((delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const keys = getKeys();
    const vw = canvas.width;
    const vh = canvas.height;

    // Fade-in animation
    if (fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - delta / 400);
    }
    const isActive = fadeRef.current <= 0;

    // Route name banner timer
    if (routeNameTimerRef.current > 0) {
      routeNameTimerRef.current -= delta;
    }

    // === UPDATE PHASE ===
    const enc = encounterRef.current;
    const inEncounter = enc && enc.phase !== 'idle';

    // Handle pokeball Yes/No choice (intercept before normal dialogue handling)
    const pbChoice = pokeballChoiceRef.current;
    if (dialogueRef.current && pbChoice) {
      const now = Date.now();
      if (now > battleNavCooldownRef.current) {
        if (keys.left || keys.up) {
          pbChoice.selected = 0;
          battleNavCooldownRef.current = now + 180;
        } else if (keys.right || keys.down) {
          pbChoice.selected = 1;
          battleNavCooldownRef.current = now + 180;
        }
      }
      if (consumeAction()) {
        if (pbChoice.selected === 0) {
          // YES — install skill, collect pokeball
          collectedPokeballsRef.current.add(pbChoice.pokeballKey);
          if (onInstallSkill) {
            onInstallSkill(pbChoice.skillRepo, pbChoice.skillName);
          }
          dialogueRef.current = null;
          dialogueSpeakerRef.current = undefined;
          pokeballChoiceRef.current = null;
          interactionCooldownRef.current = Date.now() + 400;
        } else {
          // NO — just close dialogue, pokeball stays
          dialogueRef.current = null;
          dialogueSpeakerRef.current = undefined;
          pokeballChoiceRef.current = null;
          interactionCooldownRef.current = Date.now() + 400;
        }
      }
    }
    // Handle dialogue
    else if (dialogueRef.current) {
      if (consumeAction()) {
        if (dialogueQueueRef.current.length > 0) {
          dialogueRef.current = dialogueQueueRef.current.shift()!;
        } else {
          dialogueRef.current = null;
          dialogueSpeakerRef.current = undefined;
          npcFacingOverrideRef.current.clear();
          interactionCooldownRef.current = Date.now() + 400;
          // Officer steps aside after granting access
          if (officerPendingMoveRef.current) {
            officerPendingMoveRef.current = false;
            const officer = ROUTE1_NPCS.find(n => n.id === 'officer')!;
            const px = playerRef.current.x;
            const py = playerRef.current.y;
            // Move officer to the opposite side of the player (left or right)
            const moveDir = px <= officer.x ? 1 : -1;
            // Face toward the player after moving
            const dx = px - (officer.x + moveDir);
            const dy = py - officer.y;
            let faceDir: Direction;
            if (Math.abs(dx) >= Math.abs(dy)) {
              faceDir = dx > 0 ? 'right' : 'left';
            } else {
              faceDir = dy > 0 ? 'down' : 'up';
            }
            officerMovedState = {
              x: officer.x + moveDir,
              y: officer.y,
              direction: faceDir,
            };
          }
          if (enc) {
            if (enc.phase === 'dialogue') {
              // After walk-up dialogue, enter battle conversation if NPC has one
              const npc = ROUTE1_NPCS.find(n => n.id === enc.npcId);
              if (npc?.conversation) {
                enc.phase = 'battle-text';
                enc.conversationNode = npc.conversation;
                battleSelectedRef.current = 0;
              } else {
                enc.phase = 'idle';
                enc.triggered = true;
              }
            } else if (enc.phase === 'battle-text') {
              // Current node text dismissed
              const node = enc.conversationNode;
              if (node?.choices && node.choices.length > 0) {
                // Node has choices → show them
                enc.phase = 'battle-choices';
                battleSelectedRef.current = 0;
              } else {
                // No choices → conversation over, exit
                const npc = ROUTE1_NPCS.find(n => n.id === enc.npcId);
                enc.phase = 'idle';
                enc.triggered = false;
                enc.conversationNode = null;
                if (npc) { enc.npcX = npc.x; enc.npcY = npc.y; enc.npcDirection = npc.direction; }
                interactionCooldownRef.current = Date.now() + 800;
                if (inBattleRef.current) {
                  inBattleRef.current = false;
                  onBattleEnd?.();
                }
              }
            }
          }
        }
      }
      // Skip movement while dialogue is active
    } else if (inEncounter) {
      // === ENCOUNTER STATE MACHINE ===
      if (enc.phase === 'alert') {
        enc.timer -= delta;
        if (enc.timer <= 0) {
          // Transition to approaching: NPC walks toward the player
          enc.phase = 'approaching';
          // Calculate direction toward player
          const dxToPlayer = player.x - enc.npcX;
          const dyToPlayer = player.y - enc.npcY;
          if (Math.abs(dxToPlayer) > Math.abs(dyToPlayer)) {
            enc.npcDirection = dxToPlayer > 0 ? 'right' : 'left';
          } else {
            enc.npcDirection = dyToPlayer > 0 ? 'down' : 'up';
          }
        }
      } else if (enc.phase === 'approaching') {
        if (enc.npcMoving) {
          // Animate NPC walk
          enc.npcMoveProgress += delta / MOVE_DURATION;
          if (enc.npcMoveProgress >= 1) {
            enc.npcX = enc.npcTargetX;
            enc.npcY = enc.npcTargetY;
            enc.npcMoving = false;
            enc.npcMoveProgress = 0;
            enc.npcAnimFrame = 0;
          } else {
            enc.npcAnimFrame = enc.npcMoveProgress < 0.33 ? 1 : enc.npcMoveProgress < 0.66 ? 0 : 3;
          }
        } else {
          // Check if NPC is adjacent to player (distance = 1)
          const distX = Math.abs(player.x - enc.npcX);
          const distY = Math.abs(player.y - enc.npcY);
          if (distX + distY <= 1) {
            // Arrived — face the player and start dialogue
            const dxP = player.x - enc.npcX;
            const dyP = player.y - enc.npcY;
            if (Math.abs(dxP) >= Math.abs(dyP)) {
              enc.npcDirection = dxP > 0 ? 'right' : 'left';
            } else {
              enc.npcDirection = dyP > 0 ? 'down' : 'up';
            }
            // Make player face the NPC
            const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
            player.direction = opposite[enc.npcDirection];
            // Start dialogue
            enc.phase = 'dialogue';
            const npc = ROUTE1_NPCS.find(n => n.id === enc.npcId);
            if (npc && npc.dialogue.length > 0) {
              dialogueRef.current = npc.dialogue[0];
              dialogueQueueRef.current = [...npc.dialogue.slice(1)];
              dialogueSpeakerRef.current = npc.name;
            }
            if (!inBattleRef.current && npc?.conversation) {
              inBattleRef.current = true;
              onBattleStart?.();
            }
          } else {
            // Move one step closer to the player
            const dxP = player.x - enc.npcX;
            const dyP = player.y - enc.npcY;
            let stepDir: Direction;
            if (Math.abs(dxP) > Math.abs(dyP)) {
              stepDir = dxP > 0 ? 'right' : 'left';
            } else {
              stepDir = dyP > 0 ? 'down' : 'up';
            }
            const dxStep: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
            const dyStep: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
            enc.npcTargetX = enc.npcX + dxStep[stepDir];
            enc.npcTargetY = enc.npcY + dyStep[stepDir];
            enc.npcDirection = stepDir;
            enc.npcMoving = true;
            enc.npcMoveProgress = 0;
            enc.npcAnimFrame = 1;
          }
        }
      } else if (enc.phase === 'battle-text') {
        // Set dialogue from current conversation node once
        if (!dialogueRef.current && enc.conversationNode) {
          dialogueRef.current = enc.conversationNode.text;
          dialogueQueueRef.current = [];
          dialogueSpeakerRef.current = enc.conversationNode.speaker || ROUTE1_NPCS.find(n => n.id === enc.npcId)?.name;
        }
        // Dialogue advance is handled at the top — transitions to battle-choices or exits there
      } else if (enc.phase === 'battle-choices') {
        const node = enc.conversationNode;
        const choices = node?.choices || [];
        // Handle selection
        if (consumeAction()) {
          const chosen = choices[battleSelectedRef.current];
          if (chosen?.next) {
            // Navigate to the next conversation node
            enc.conversationNode = chosen.next;
            enc.phase = 'battle-text';
            dialogueRef.current = chosen.next.text;
            dialogueQueueRef.current = [];
            dialogueSpeakerRef.current = chosen.next.speaker || ROUTE1_NPCS.find(n => n.id === enc.npcId)?.name;
            battleSelectedRef.current = 0;
          }
        }
        if (consumeCancel()) {
          const npc = ROUTE1_NPCS.find(n => n.id === enc.npcId);
          enc.phase = 'idle';
          enc.triggered = false;
          enc.conversationNode = null;
          if (npc) { enc.npcX = npc.x; enc.npcY = npc.y; enc.npcDirection = npc.direction; }
          interactionCooldownRef.current = Date.now() + 800;
          if (inBattleRef.current) {
            inBattleRef.current = false;
            onBattleEnd?.();
          }
        }
        // Arrow key navigation with cooldown
        const now = Date.now();
        if (now > battleNavCooldownRef.current) {
          if (keys.up || keys.left) {
            battleSelectedRef.current = Math.max(0, battleSelectedRef.current - 1);
            battleNavCooldownRef.current = now + 180;
          } else if (keys.down || keys.right) {
            battleSelectedRef.current = Math.min(choices.length - 1, battleSelectedRef.current + 1);
            battleNavCooldownRef.current = now + 180;
          }
        }
      }
      // Consume stale inputs during non-menu encounter phases
      if (enc.phase !== 'battle-choices') {
        consumeAction();
        consumeCancel();
      }
    } else if (player.isMoving) {
      const newProgress = player.moveProgress + delta / MOVE_DURATION;
      if (newProgress >= 1) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.isMoving = false;
        player.moveProgress = 0;
        player.animFrame = 0;

        // Check for route exit tile
        if (ROUTE1_MAP_DATA[player.y]?.[player.x] === TILE.ROUTE_EXIT && !exitTriggeredRef.current) {
          exitTriggeredRef.current = true;
          onExit();
          return;
        }

        // Check if player walked onto a door tile
        if (ROUTE1_MAP_DATA[player.y]?.[player.x] === TILE.DOOR && !doorTriggeredRef.current) {
          const building = ROUTE1_BUILDINGS.find(b => b.doorX === player.x && b.doorY === player.y);
          if (building) {
            doorTriggeredRef.current = true;
            if (building.interiorId && onEnterInterior) {
              onEnterInterior(building.interiorId);
              return;
            }
            dialogueRef.current = `The ${building.label} is closed for now, but will open soon!`;
            dialogueQueueRef.current = [];
            dialogueSpeakerRef.current = undefined;
          }
        } else if (ROUTE1_MAP_DATA[player.y]?.[player.x] !== TILE.DOOR) {
          doorTriggeredRef.current = false;
        }

        // Check if player walked into NPC sight line
        for (const npc of ROUTE1_NPCS) {
          if (!npc.sightRange) continue;
          if (encounterRef.current?.triggered && encounterRef.current.npcId === npc.id) continue;
          const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
          const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
          const sightDx = dx[npc.direction];
          const sightDy = dy[npc.direction];
          // Check tiles in line of sight
          for (let i = 1; i <= npc.sightRange; i++) {
            const checkX = npc.x + sightDx * i;
            const checkY = npc.y + sightDy * i;
            // Blocked by solid tile
            if (checkX < 0 || checkX >= ROUTE1_WIDTH || checkY < 0 || checkY >= ROUTE1_HEIGHT) break;
            if (SOLID_TILES.has(ROUTE1_MAP_DATA[checkY][checkX])) break;
            // Player spotted!
            if (checkX === player.x && checkY === player.y) {
              encounterRef.current = {
                phase: 'alert',
                npcId: npc.id,
                timer: 800,
                npcX: npc.x,
                npcY: npc.y,
                npcTargetX: npc.x,
                npcTargetY: npc.y,
                npcMoving: false,
                npcMoveProgress: 0,
                npcAnimFrame: 0,
                npcDirection: npc.direction,
                triggered: false,
                conversationNode: null,
              };
              break;
            }
          }
        }
      } else {
        player.moveProgress = newProgress;
        player.animFrame = newProgress < 0.33 ? 0 : newProgress < 0.66 ? 1 : 2;
      }
    } else if (isActive) {
      // Handle ESC to exit
      if (consumeCancel()) {
        onExit();
        return;
      }

      // Handle Space to interact with signs and NPCs
      if (consumeAction() && Date.now() > interactionCooldownRef.current) {
        const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
        const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
        const facingX = player.x + dxMap[player.direction];
        const facingY = player.y + dyMap[player.direction];

        let interacted = false;

        // Check NPC interaction (use encounter position if available)
        const encState = encounterRef.current;
        const npc = ROUTE1_NPCS.find(n => {
          let nx: number, ny: number;
          const ps = patrolStatesRef.current.get(n.id);
          if (ps) {
            nx = ps.x;
            ny = ps.y;
          } else if (n.id === 'officer' && officerMovedState) {
            nx = officerMovedState.x;
            ny = officerMovedState.y;
          } else {
            nx = encState && encState.npcId === n.id ? encState.npcX : n.x;
            ny = encState && encState.npcId === n.id ? encState.npcY : n.y;
          }
          return nx === facingX && ny === facingY;
        });
        if (npc) {
          if (npc.id === 'officer') {
            // Officer checks for Vercel Best Practices skill
            dialogueRef.current = 'Sorry my boy, this is a Vercel private party.';
            if (hasVercelSkillRef.current) {
              dialogueQueueRef.current = ['Oh I see that you\'ve got the Vercel Best Practices Skill, sorry! You can enter.'];
              officerPendingMoveRef.current = true;
            } else {
              dialogueQueueRef.current = ['You need to install the Vercel Best Practices Skill to enter.'];
            }
            dialogueSpeakerRef.current = npc.name;
            interacted = true;
          } else if (npc.dialogue.length > 0) {
            // Face the player
            const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
            const faceDir = opposite[player.direction];
            // Pause patrol NPC
            const ps = patrolStatesRef.current.get(npc.id);
            if (ps && !ps.isMoving) {
              ps.direction = faceDir;
              ps.waitTimer = 0;
            }
            // Set facing override for static NPCs
            npcFacingOverrideRef.current.set(npc.id, faceDir);
            dialogueRef.current = npc.dialogue[0];
            dialogueQueueRef.current = [...npc.dialogue.slice(1)];
            dialogueSpeakerRef.current = npc.name;
            interacted = true;
          }
        }

        // Check pokeball interaction (player standing on or facing the tile)
        if (!interacted) {
          for (const pb of POKEBALL_POSITIONS) {
            const key = `${pb.x},${pb.y}`;
            if (collectedPokeballsRef.current.has(key)) continue;
            if ((facingX === pb.x && facingY === pb.y) || (player.x === pb.x && player.y === pb.y)) {
              // Pick a random uninstalled skill for this pokeball if not already assigned
              if (!pokeballSkillsRef.current.has(key) && uninstalledSkills.length > 0) {
                const randomSkill = uninstalledSkills[Math.floor(Math.random() * uninstalledSkills.length)];
                pokeballSkillsRef.current.set(key, { name: randomSkill.name, repo: `${randomSkill.repo}/${randomSkill.name}` });
              }
              const skill = pokeballSkillsRef.current.get(key);
              if (skill) {
                dialogueRef.current = `Oh! This pokeball contains the skill "${skill.name}". Do you want to learn it?`;
                dialogueQueueRef.current = [];
                dialogueSpeakerRef.current = undefined;
                pokeballChoiceRef.current = { skillName: skill.name, skillRepo: skill.repo, pokeballKey: key, selected: 0 };
                interacted = true;
              }
              break;
            }
          }
        }

        // Check sign / gravestone interaction
        if (!interacted && facingX >= 0 && facingX < ROUTE1_WIDTH && facingY >= 0 && facingY < ROUTE1_HEIGHT) {
          const facingTile = ROUTE1_MAP_DATA[facingY][facingX];
          if (facingTile === TILE.SIGN) {
            const key = `${facingX},${facingY}`;
            const text = ROUTE1_SIGNS[key];
            if (text && text.length > 0) {
              dialogueRef.current = text[0];
              dialogueQueueRef.current = [...text.slice(1)];
              dialogueSpeakerRef.current = undefined;
            }
          } else if (facingTile === TILE.GRAVE) {
            const key = `${facingX},${facingY}`;
            const text = ROUTE1_GRAVES[key];
            if (text && text.length > 0) {
              dialogueRef.current = text[0];
              dialogueQueueRef.current = [...text.slice(1)];
              dialogueSpeakerRef.current = undefined;
            }
          }
        }
      }

      // Handle movement input
      let dir: Direction | null = null;
      if (keys.up) dir = 'up';
      else if (keys.down) dir = 'down';
      else if (keys.left) dir = 'left';
      else if (keys.right) dir = 'right';

      if (dir) {
        const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
        const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
        const tx = player.x + dx[dir];
        const ty = player.y + dy[dir];

        if (canMoveTo(tx, ty)) {
          player.direction = dir;
          player.targetX = tx;
          player.targetY = ty;
          player.isMoving = true;
          player.moveProgress = 0;
          player.animFrame = 1;
        } else {
          player.direction = dir;
        }
      }
    }

    // === UPDATE PATROL NPCs ===
    const isInDialogue = !!dialogueRef.current;
    for (const npc of ROUTE1_NPCS) {
      if (!npc.patrol) continue;
      const ps = patrolStatesRef.current.get(npc.id);
      if (!ps) continue;

      // Pause while player is in dialogue
      if (isInDialogue) continue;

      const PATROL_SPEED = MOVE_DURATION * 1.8; // slower than player for smooth feel
      if (ps.isMoving) {
        // Advance movement
        ps.moveProgress += delta / PATROL_SPEED;
        if (ps.moveProgress >= 1) {
          ps.x = ps.targetX;
          ps.y = ps.targetY;
          ps.isMoving = false;
          ps.moveProgress = 0;
          ps.patrolStep = (ps.patrolStep + 1) % npc.patrol.length;
          // Immediately start next step for fluid motion
          ps.waitTimer = 0;
        }
      }
      if (!ps.isMoving) {
        ps.waitTimer -= delta;
        if (ps.waitTimer <= 0) {
          const dir = npc.patrol[ps.patrolStep];
          const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
          const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
          const nx = ps.x + dxMap[dir];
          const ny = ps.y + dyMap[dir];
          ps.direction = dir;

          // Check if player blocks the target tile
          const px = player.x, py = player.y;
          const ptx = player.targetX, pty = player.targetY;
          if ((nx === px && ny === py) || (nx === ptx && ny === pty)) {
            ps.waitTimer = 100;
          } else {
            ps.targetX = nx;
            ps.targetY = ny;
            ps.isMoving = true;
            ps.moveProgress = 0;
          }
        }
      }
    }

    // === RENDER PHASE ===
    ensureGrassCache();
    ensureWaterCache();
    ctx.clearRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = false;

    // Camera
    const playerPixel = getPlayerPixelPosition(player);
    const camera = calculateCamera(playerPixel.x, playerPixel.y, vw, vh);

    // Visible tile range
    const startX = Math.max(0, Math.floor(camera.x / SCALED_TILE) - 1);
    const startY = Math.max(0, Math.floor(camera.y / SCALED_TILE) - 1);
    const endX = Math.min(ROUTE1_WIDTH, Math.ceil((camera.x + vw) / SCALED_TILE) + 1);
    const endY = Math.min(ROUTE1_HEIGHT, Math.ceil((camera.y + vh) / SCALED_TILE) + 1);

    // Ground layer
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = ROUTE1_MAP_DATA[y]?.[x];
        if (tile === undefined) continue;
        const px = x * SCALED_TILE - camera.x;
        const py = y * SCALED_TILE - camera.y;

        // Grass base for all tiles
        if (grassCacheRef.current) {
          ctx.drawImage(grassCacheRef.current, px, py);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#73CDA4' : '#6BC59C';
          ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
        }

        // Tile-specific rendering
        switch (tile) {
          case TILE.TALL_GRASS:
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
          case TILE.FLOWER:
            drawFlower(ctx, px, py);
            break;
          case TILE.WATER:
            if (waterCacheRef.current) ctx.drawImage(waterCacheRef.current, px, py);
            break;
          case TILE.FENCE:
            drawFence(ctx, px, py);
            break;
          case TILE.SIGN:
            drawSign(ctx, px, py);
            break;
          case TILE.GRAVE:
            drawGrave(ctx, px, py);
            break;
        }
      }
    }

    // Buildings
    for (const building of ROUTE1_BUILDINGS) {
      const bpx = building.x * SCALED_TILE - camera.x;
      const bpy = building.y * SCALED_TILE - camera.y;
      const bw = building.width * SCALED_TILE;
      const bh = building.height * SCALED_TILE;

      if (bpx + bw < -40 || bpx > vw + 40 || bpy + bh < -60 || bpy > vh + 40) continue;

      // Load sprite if needed
      if (!buildingSpritesRef.current.has(building.spriteFile)) {
        const img = new Image();
        img.src = building.spriteFile;
        buildingSpritesRef.current.set(building.spriteFile, img);
      }
      const spriteImg = buildingSpritesRef.current.get(building.spriteFile);
      if (spriteImg?.complete && spriteImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
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
        // Fallback: simple colored building
        const roofH = Math.floor(bh * 0.35);
        ctx.fillStyle = '#B83020';
        ctx.fillRect(bpx - 4, bpy, bw + 8, roofH);
        ctx.fillStyle = '#E8D8A8';
        ctx.fillRect(bpx, bpy + roofH, bw, bh - roofH);
      }
    }

    // Pokeballs
    for (const pb of POKEBALL_POSITIONS) {
      const key = `${pb.x},${pb.y}`;
      if (collectedPokeballsRef.current.has(key)) continue;
      const pbPx = pb.x * SCALED_TILE - camera.x;
      const pbPy = pb.y * SCALED_TILE - camera.y;
      if (pbPx + SCALED_TILE < 0 || pbPx > vw || pbPy + SCALED_TILE < 0 || pbPy > vh) continue;
      drawPokeball(ctx, pbPx, pbPy);
    }

    // NPCs
    const encState = encounterRef.current;
    for (const npc of ROUTE1_NPCS) {
      // Use encounter position if this NPC is in an encounter
      const isEncNpc = encState && encState.npcId === npc.id;
      const ps = patrolStatesRef.current.get(npc.id);
      let npcDrawX: number, npcDrawY: number, npcDir: Direction, npcAnim: number;
      if (ps) {
        // Patrol NPC — interpolate position during movement
        const interpX = ps.isMoving
          ? ps.x + (ps.targetX - ps.x) * ps.moveProgress
          : ps.x;
        const interpY = ps.isMoving
          ? ps.y + (ps.targetY - ps.y) * ps.moveProgress
          : ps.y;
        npcDrawX = interpX * SCALED_TILE - camera.x;
        npcDrawY = interpY * SCALED_TILE - camera.y;
        npcDir = ps.direction;
        npcAnim = ps.isMoving ? Math.floor(ps.moveProgress * 4) % 2 : 0;
      } else if (npc.id === 'officer' && officerMovedState) {
        // Officer moved aside
        npcDrawX = officerMovedState.x * SCALED_TILE - camera.x;
        npcDrawY = officerMovedState.y * SCALED_TILE - camera.y;
        npcDir = officerMovedState.direction;
        npcAnim = 0;
      } else if (isEncNpc) {
        // Interpolate position during movement
        const baseX = encState.npcX;
        const baseY = encState.npcY;
        const interpX = encState.npcMoving
          ? baseX + (encState.npcTargetX - baseX) * encState.npcMoveProgress
          : baseX;
        const interpY = encState.npcMoving
          ? baseY + (encState.npcTargetY - baseY) * encState.npcMoveProgress
          : baseY;
        npcDrawX = interpX * SCALED_TILE - camera.x;
        npcDrawY = interpY * SCALED_TILE - camera.y;
        npcDir = encState.npcDirection;
        npcAnim = encState.npcAnimFrame;
      } else {
        npcDrawX = npc.x * SCALED_TILE - camera.x;
        npcDrawY = npc.y * SCALED_TILE - camera.y;
        npcDir = npc.direction;
        npcAnim = 0;
      }

      // Apply facing override (NPC turns to face player during dialogue)
      const facingOverride = npcFacingOverrideRef.current.get(npc.id);
      if (facingOverride) npcDir = facingOverride;

      // Skip if off-screen
      if (npcDrawX + SCALED_TILE < 0 || npcDrawX > vw || npcDrawY + SCALED_TILE < 0 || npcDrawY > vh) continue;

      ctx.imageSmoothingEnabled = false;

      // Per-direction sprites (separate image files)
      if (npc.spritePerDirection) {
        const spriteKey = `${npc.id}-${npcDir}`;
        if (!npcSpritesRef.current.has(spriteKey)) {
          const img = new Image();
          img.src = npc.spritePerDirection[npcDir];
          npcSpritesRef.current.set(spriteKey, img);
        }
        const sprite = npcSpritesRef.current.get(spriteKey)!;
        if (sprite.complete && sprite.naturalWidth > 0) {
          const drawW = SCALED_TILE * 0.9;
          const drawH = SCALED_TILE * 0.9;
          const offsetX = (SCALED_TILE - drawW) / 2;
          const offsetY = (SCALED_TILE - drawH);
          // Bob animation when walking
          const bobY = ps?.isMoving ? Math.sin(ps.moveProgress * Math.PI * 2) * 2 : 0;
          ctx.drawImage(
            sprite,
            0, 0, sprite.naturalWidth, sprite.naturalHeight,
            npcDrawX + offsetX, npcDrawY + offsetY + bobY, drawW, drawH,
          );
        }
      } else {
        // Sprite sheet NPC (4x4 grid)
        if (!npcSpritesRef.current.has(npc.id)) {
          const img = new Image();
          img.src = npc.spritePath;
          npcSpritesRef.current.set(npc.id, img);
        }
        const sprite = npcSpritesRef.current.get(npc.id)!;
        if (sprite.complete && sprite.naturalWidth > 0) {
          const dirRow: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
          const row = dirRow[npcDir];
          const col = npcAnim % 4;
          const frameW = sprite.naturalWidth / 4;
          const frameH = sprite.naturalHeight / 4;
          const drawW = SCALED_TILE * 1.0;
          const drawH = SCALED_TILE * 1.5;
          const offsetX = (SCALED_TILE - drawW) / 2;
          const offsetY = SCALED_TILE - drawH;
          ctx.drawImage(
            sprite,
            col * frameW, row * frameH, frameW, frameH,
            npcDrawX + offsetX, npcDrawY + offsetY, drawW, drawH,
          );
        }
      }

      // Draw "!" exclamation bubble during alert phase
      if (isEncNpc && encState.phase === 'alert') {
        const bubbleX = npcDrawX + SCALED_TILE / 2;
        const bubbleY = npcDrawY - SCALED_TILE * 0.9;
        const bw = 26;
        const bh = 34;
        // White rounded-rect bubble
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(bubbleX - bw / 2, bubbleY - bh / 2, bw, bh, 6);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        // "!" text
        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', bubbleX, bubbleY);
      }
    }

    // Player
    renderPlayer(ctx, player, camera, assets);

    // Tree overlay (drawn after player for depth)
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (ROUTE1_MAP_DATA[y]?.[x] !== TILE.TREE) continue;
        const px = x * SCALED_TILE - camera.x;
        const py = y * SCALED_TILE - camera.y;
        drawTree(ctx, px, py, (x + y) % 3, assets);
      }
    }

    // Building labels (after tree overlay so always visible)
    for (const building of ROUTE1_BUILDINGS) {
      const bpx = building.x * SCALED_TILE - camera.x;
      const bpy = building.y * SCALED_TILE - camera.y;
      const bw = building.width * SCALED_TILE;
      const bh = building.height * SCALED_TILE;
      if (bpx + bw < -40 || bpx > vw + 40 || bpy + bh < -60 || bpy > vh + 40) continue;
      drawBuildingLabel(ctx, bpx + bw / 2, bpy - 8, building.label);
    }

    // Route name banner (fades after 3 seconds)
    if (routeNameTimerRef.current > 0) {
      const alpha = Math.min(1, routeNameTimerRef.current / 1000);
      const bannerW = 200;
      const bannerH = 44;
      const bannerX = vw / 2 - bannerW / 2;
      const bannerY = 24;

      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
      ctx.fill();

      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText('ROUTE 1', vw / 2, bannerY + bannerH / 2);
    }

    // Dialogue box (rendered on canvas — white bg, matching main map style)
    if (dialogueRef.current) {
      const speaker = dialogueSpeakerRef.current;
      const hasPbChoice = !!pokeballChoiceRef.current;
      const boxH = hasPbChoice ? 140 : 110;
      const boxW = Math.min(vw - 32, 640);
      const boxX = (vw - boxW) / 2;
      const boxY = vh - boxH - 16;

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(boxX + 4, boxY + 4, boxW, boxH, 8);
      ctx.fill();

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();

      // Dark border (gray-800)
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Speaker name label (gray, uppercase)
      if (speaker) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(speaker.toUpperCase(), boxX + 16, boxY + 12);
      }

      // Dialogue text (black) with word wrap
      ctx.font = '18px monospace';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const dlgMaxW = hasPbChoice ? boxW * 0.55 : boxW - 40;
      const dlgLines = wrapText(ctx, dialogueRef.current, dlgMaxW);
      const dlgStartY = boxY + (speaker ? 32 : 20);
      for (let i = 0; i < dlgLines.length; i++) {
        ctx.fillText(dlgLines[i], boxX + 16, dlgStartY + i * 20);
      }

      if (hasPbChoice) {
        // Right-side blue panel with vertical YES / NO (battle menu style)
        const pbSel = pokeballChoiceRef.current!.selected;
        const panelW = boxW * 0.35;
        const panelX = boxX + boxW - panelW;

        // Blue panel background
        ctx.fillStyle = '#3870b8';
        ctx.beginPath();
        ctx.roundRect(panelX, boxY, panelW, boxH, [0, 8, 8, 0]);
        ctx.fill();

        // Inner highlight border
        ctx.strokeStyle = '#5090d0';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX + 3, boxY + 3, panelW - 6, boxH - 6);

        // Draw YES / NO vertically
        const labels = ['YES', 'NO'];
        const choiceH = boxH / 2;
        for (let i = 0; i < 2; i++) {
          const cy = boxY + choiceH * i + choiceH / 2;
          const cx = panelX + 30;

          // Selection arrow
          if (i === pbSel) {
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#f8d038';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u25b6', cx - 18, cy);
          }

          // Choice text with shadow
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#282828';
          ctx.fillText(labels[i], cx + 2, cy + 2);
          ctx.fillStyle = '#f8f8f8';
          ctx.fillText(labels[i], cx, cy);
        }
      } else {
        // Advance arrow (black)
        ctx.font = '14px monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText('\u25BC', boxX + boxW - 16, boxY + boxH - 24);
      }
    }

    // === BATTLE SCREEN ===
    if (encState && (encState.phase === 'battle-text' || encState.phase === 'battle-choices')) {
      const battleNpc = ROUTE1_NPCS.find(n => n.id === encState.npcId);
      if (battleNpc) {
        drawBattleScreen(ctx, vw, vh, battleNpc, encState, battleSelectedRef.current);
      }
    }

    // Fade overlay
    if (fadeRef.current > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeRef.current})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }, [assets, getKeys, consumeAction, consumeCancel, onExit, onEnterInterior, onBattleStart, onBattleEnd, canMoveTo, calculateCamera, ensureGrassCache, ensureWaterCache]);

  useGameLoop(gameLoop, true);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black" tabIndex={0}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

// ── Inline drawing helpers ───────────────────────────────────────────────────

function drawTree(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  variant: number,
  assets: GameAssets
) {
  const treeImg = variant % 2 === 0 ? assets.tree1 : assets.tree2;
  if (treeImg) {
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillStyle = '#83D562';
    ctx.beginPath();
    ctx.arc(px + SCALED_TILE / 2 - 2, py + SCALED_TILE / 2 - 8, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Cached flower sprite
let flowerImage: HTMLImageElement | null = null;

function drawFlower(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!flowerImage) {
    flowerImage = new Image();
    flowerImage.src = '/pokemon/grass/flower.png';
  }

  if (flowerImage.complete && flowerImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(flowerImage, px, py, SCALED_TILE, SCALED_TILE);
  }
}

// Cached pokeball sprite
let pokeballImage: HTMLImageElement | null = null;

function drawPokeball(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!pokeballImage) {
    pokeballImage = new Image();
    pokeballImage.src = '/pokemon/grass/pokeball.png';
  }

  if (pokeballImage.complete && pokeballImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    const size = SCALED_TILE * 0.6;
    const offset = (SCALED_TILE - size) / 2;
    ctx.drawImage(pokeballImage, px + offset, py + offset, size, size);
  }
}

// Cached barrier sprite
let barrierImage: HTMLImageElement | null = null;

function drawFence(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!barrierImage) {
    barrierImage = new Image();
    barrierImage.src = '/pokemon/grass/barrier.png';
  }

  if (barrierImage.complete && barrierImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barrierImage, px, py, SCALED_TILE, SCALED_TILE);
  }
}

// Cached sign sprite
let signImage: HTMLImageElement | null = null;

function drawSign(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!signImage) {
    signImage = new Image();
    signImage.src = '/pokemon/grass/pancarte.png';
  }

  if (signImage.complete && signImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(signImage, px, py, SCALED_TILE, SCALED_TILE);
  }
}

// Cached gravestone sprite
let graveImage: HTMLImageElement | null = null;

function drawGrave(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!graveImage) {
    graveImage = new Image();
    graveImage.src = '/pokemon/graveyard/stone.png';
  }

  if (graveImage.complete && graveImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(graveImage, px, py, SCALED_TILE, SCALED_TILE);
  }
}

// ── Building label ───────────────────────────────────────────────────────
function drawBuildingLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
  ctx.font = `bold ${10 * SCALE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(label);
  const padding = 6;
  const bgX = cx - metrics.width / 2 - padding;
  const bgY = cy - 10 * SCALE - padding;
  const bgW = metrics.width + padding * 2;
  const bgH = 10 * SCALE + padding * 2;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgW, bgH, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, cx, cy);
}

// ── Word wrap helper ─────────────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ── Battle screen ────────────────────────────────────────────────────────────

// Cached battle images
const battleImageCache = new Map<string, HTMLImageElement>();

function getBattleImage(src: string): HTMLImageElement {
  if (!battleImageCache.has(src)) {
    const img = new Image();
    img.src = src;
    battleImageCache.set(src, img);
  }
  return battleImageCache.get(src)!;
}

function getBattleBg() { return getBattleImage('/pokemon/pokemon-battle.png'); }
function getPlayerBattleSprite() { return getBattleImage('/pokemon/battle/player.png'); }

function drawBattleScreen(
  ctx: CanvasRenderingContext2D,
  vw: number, vh: number,
  npc: RouteNPC,
  enc: EncounterState,
  selectedIndex: number,
) {
  const node = enc.conversationNode;
  const phase = enc.phase;

  // Full-screen battle overlay
  const battleW = Math.min(vw, vh * (240 / 160));
  const battleH = battleW * (160 / 240);
  const bx = (vw - battleW) / 2;
  const by = (vh - battleH) / 2;

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, vw, vh);

  // Battle background image
  const battleBg = getBattleBg();
  if (battleBg.complete && battleBg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(battleBg, bx, by, battleW, battleH);
  }

  // NPC name label (centered on the info card)
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#282820';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(npc.name.toUpperCase(), bx + battleW * 0.13, by + battleH * 0.14);

  // NPC battle sprite (top-right, centered on grass)
  if (npc.battleSprite) {
    const npcImg = getBattleImage(npc.battleSprite);
    if (npcImg.complete && npcImg.naturalWidth > 0) {
      const sprW = battleW * 0.22;
      const sprH = sprW * (npcImg.naturalHeight / npcImg.naturalWidth);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(npcImg, bx + battleW * 0.61, by + battleH * 0.38 - sprH, sprW, sprH);
    }
  }

  // Player battle sprite (bottom-left)
  const playerBattleSprite = getPlayerBattleSprite();
  if (playerBattleSprite.complete && playerBattleSprite.naturalWidth > 0) {
    const sprW = battleW * 0.24;
    const sprH = sprW * (playerBattleSprite.naturalHeight / playerBattleSprite.naturalWidth);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(playerBattleSprite, bx + battleW * 0.14, by + battleH * 0.74 - sprH, sprW, sprH);
  }

  // Bottom panel
  const panelH = battleH * 0.3;
  const panelY = by + battleH - panelH;

  // Panel border top
  ctx.fillStyle = '#484848';
  ctx.fillRect(bx, panelY, battleW, 4);

  if (phase === 'battle-text' && node) {
    // Full-width text panel showing current node's text
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(bx, panelY + 4, battleW, panelH - 4);
    ctx.fillStyle = '#484848';
    ctx.fillRect(bx, panelY + panelH - 4, battleW, 4);

    // Speaker name
    const speaker = node.speaker || npc.name;
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(speaker.toUpperCase(), bx + 20, panelY + 14);

    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#282828';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const textMaxW = battleW - 50;
    const wrappedLines = wrapText(ctx, node.text, textMaxW);
    const lineH = 32;
    const textStartY = panelY + 38;
    for (let i = 0; i < wrappedLines.length; i++) {
      ctx.fillText(wrappedLines[i], bx + 20, textStartY + i * lineH);
    }

    // Advance arrow
    ctx.font = '16px monospace';
    ctx.fillStyle = '#282828';
    ctx.textAlign = 'right';
    ctx.fillText('\u25BC', bx + battleW - 20, panelY + panelH - 18);
  } else if (phase === 'battle-choices' && node?.choices) {
    const choices = node.choices;
    const halfW = battleW / 2;

    // Left text panel
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(bx, panelY + 4, halfW, panelH - 4);
    ctx.fillStyle = '#484848';
    ctx.fillRect(bx + halfW, panelY + 4, 4, panelH - 4);
    ctx.fillStyle = '#484848';
    ctx.fillRect(bx, panelY + panelH - 4, battleW, 4);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#282828';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('What do you want to do?', bx + 18, panelY + panelH * 0.5);

    // Right action panel (blue)
    ctx.fillStyle = '#3870b8';
    ctx.fillRect(bx + halfW + 4, panelY + 4, halfW - 4, panelH - 8);

    // Inner highlight
    ctx.strokeStyle = '#5090d0';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx + halfW + 7, panelY + 7, halfW - 10, panelH - 14);

    // Draw choices
    const choiceH = (panelH - 16) / Math.max(choices.length, 1);
    for (let i = 0; i < choices.length; i++) {
      const cy = panelY + 10 + choiceH * i + choiceH / 2;
      const cx = bx + halfW + 30;

      // Selection arrow
      if (i === selectedIndex) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#f8d038';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u25b6', cx - 18, cy);
      }

      // Choice text with shadow
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#282828';
      ctx.fillText(choices[i].label, cx + 2, cy + 2);
      ctx.fillStyle = choices[i].color || '#f8f8f8';
      ctx.fillText(choices[i].label, cx, cy);
    }
  }
}
