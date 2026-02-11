'use client';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { GameAssets, Direction, PlayerState } from '../types';
import { TILE, SCALED_TILE, MOVE_DURATION, ROUTE1_MAP_DATA, ROUTE1_WIDTH, ROUTE1_HEIGHT, ROUTE1_PLAYER_START } from '../constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { useKeyboard } from '../hooks/useKeyboard';
import { renderPlayer, getPlayerPixelPosition } from '../renderer/playerRenderer';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills } from '@/hooks/useElectron';
import { SKILLS_DATABASE } from '@/lib/skills-database';

const SOLID_TILES = new Set<number>([TILE.TREE, TILE.BUILDING, TILE.FENCE, TILE.WATER, TILE.SIGN]);

// Sign dialogue data: "x,y" → lines of text
const ROUTE1_SIGNS: Record<string, string[]> = {
  '16,36': ['ROUTE 1', 'Northern Route'],
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
            text: 'My ClawBot is an automation tool that allows agents to manage tasks in parallel and interact with macOS applications. I control it using my wife\'s sex toy.',
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
}

export default function RouteOverlay({ assets, onExit, onInstallSkill }: RouteOverlayProps) {
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
  const playerRef = useRef<PlayerState>({
    x: ROUTE1_PLAYER_START.x,
    y: ROUTE1_PLAYER_START.y,
    targetX: ROUTE1_PLAYER_START.x,
    targetY: ROUTE1_PLAYER_START.y,
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

  // Trainer encounter state
  const encounterRef = useRef<EncounterState | null>(null);
  const battleSelectedRef = useRef(0);
  const battleNavCooldownRef = useRef(0);

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
      const nx = enc && enc.npcId === npc.id ? Math.round(enc.npcX) : npc.x;
      const ny = enc && enc.npcId === npc.id ? Math.round(enc.npcY) : npc.y;
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
          interactionCooldownRef.current = Date.now() + 400;
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
          const nx = encState && encState.npcId === n.id ? encState.npcX : n.x;
          const ny = encState && encState.npcId === n.id ? encState.npcY : n.y;
          return nx === facingX && ny === facingY;
        });
        if (npc && npc.dialogue.length > 0) {
          dialogueRef.current = npc.dialogue[0];
          dialogueQueueRef.current = [...npc.dialogue.slice(1)];
          dialogueSpeakerRef.current = npc.name;
          interacted = true;
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

        // Check sign interaction
        if (!interacted && facingX >= 0 && facingX < ROUTE1_WIDTH && facingY >= 0 && facingY < ROUTE1_HEIGHT) {
          if (ROUTE1_MAP_DATA[facingY][facingX] === TILE.SIGN) {
            const key = `${facingX},${facingY}`;
            const text = ROUTE1_SIGNS[key];
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
        }
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
      let npcDrawX: number, npcDrawY: number, npcDir: Direction, npcAnim: number;
      if (isEncNpc) {
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

      // Skip if off-screen
      if (npcDrawX + SCALED_TILE < 0 || npcDrawX > vw || npcDrawY + SCALED_TILE < 0 || npcDrawY > vh) continue;

      // Load sprite if needed
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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sprite,
          col * frameW, row * frameH, frameW, frameH,
          npcDrawX + offsetX, npcDrawY + offsetY, drawW, drawH,
        );
      }

      // Draw "!" exclamation bubble during alert phase
      if (isEncNpc && encState.phase === 'alert') {
        const bubbleX = npcDrawX + SCALED_TILE / 2;
        const bubbleY = npcDrawY - SCALED_TILE * 0.9;
        // White bubble
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(bubbleX, bubbleY, 14, 18, 0, 0, Math.PI * 2);
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
      const boxH = hasPbChoice ? 120 : 90;
      const boxW = Math.min(vw - 32, 560);
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
  }, [assets, getKeys, consumeAction, consumeCancel, onExit, canMoveTo, calculateCamera, ensureGrassCache, ensureWaterCache]);

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

const battleBg = getBattleImage('/pokemon/pokemon-battle.png');
const playerBattleSprite = getBattleImage('/pokemon/battle/player.png');

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
