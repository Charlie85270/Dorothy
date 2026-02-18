'use client';
import { useRef, useEffect, useCallback } from 'react';
import { GameAssets, NPC, Building, Direction } from './types';
import { SCALED_TILE, MOVE_DURATION, TILE, MAP_HEIGHT } from './constants';
import { useGameLoop } from './hooks/useGameLoop';
import { useKeyboard } from './hooks/useKeyboard';
import { useGameState } from './hooks/useGameState';
import { calculateCamera } from './engine/camera';
import { canMoveTo, getTileAt } from './engine/collision';
import { checkInteraction, hasNearbyInteractable, checkStandingOnDoor } from './engine/interaction';
import { renderMap, renderTreeOverlay, renderBuildingLabels, renderTallGrassOverlay } from './renderer/mapRenderer';
import { renderPlayer, getPlayerPixelPosition } from './renderer/playerRenderer';
import { renderNPCs } from './renderer/npcRenderer';
import { renderHUD } from './renderer/uiRenderer';

interface GameCanvasProps {
  assets: GameAssets;
  agentNPCs: NPC[];
  onInteractBuilding: (building: Building) => void;
  onInteractNPC: (npc: NPC) => void;
  onDialogueAdvance: () => void;
  onMenuToggle: () => void;
  onEnterRoute: (routeId: string) => void;
  screen: 'game' | 'battle' | 'menu' | 'interior';
  dialogueText: string | null;
}

export default function GameCanvas({
  assets,
  agentNPCs,
  onInteractBuilding,
  onInteractNPC,
  onDialogueAdvance,
  onMenuToggle,
  onEnterRoute,
  screen,
  dialogueText,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getKeys, consumeAction, consumeCancel } = useKeyboard();
  const {
    getState,
    updatePlayer,
    setState,
    setNPCs,
  } = useGameState();

  // Track if we already triggered a door/route interaction to avoid re-triggering
  const doorTriggeredRef = useRef(false);
  const routeTriggeredRef = useRef(false);

  // Cooldown after returning from battle/overlay to prevent immediate re-interaction
  const interactionCooldownRef = useRef(0);
  const prevScreenRef = useRef(screen);
  useEffect(() => {
    if (prevScreenRef.current !== 'game' && screen === 'game') {
      interactionCooldownRef.current = Date.now() + 300; // 300ms cooldown
    }
    prevScreenRef.current = screen;
  }, [screen]);

  // Cooldown after dialogue closes to prevent immediate re-interaction
  const prevDialogueRef = useRef(dialogueText);
  useEffect(() => {
    if (prevDialogueRef.current && !dialogueText) {
      interactionCooldownRef.current = Date.now() + 400;
    }
    prevDialogueRef.current = dialogueText;
  }, [dialogueText]);

  // Wanderer NPC definitions (persisted via ref so positions survive re-renders)
  const wandererNPCsRef = useRef<NPC[]>([
    { id: 'wanderer-prof', name: 'Professor', type: 'wanderer', x: 18, y: 13, direction: 'down' as Direction, spritePath: '/pokemon/pnj/prof.png', dialogue: ['Don\'t go on the road to the north, I\'ve heard that strange things happen there.'] },
    { id: 'wanderer-girl', name: 'Lass', type: 'wanderer', x: 24, y: 20, direction: 'left' as Direction, spritePath: '/pokemon/pnj/girld.png', dialogue: ['My brother went to Apple in the north to buy a Mac mini, he never came back, I\'m starting to worry.'] },
    { id: 'wanderer-brian', name: 'Brian', type: 'wanderer', x: 15, y: 28, direction: 'right' as Direction, spritePath: '/pokemon/pnj/coinbase-brian.png', dialogue: ['Hey Bro, I\'m Brian from Coinbase!', 'Did you see my video at halftime during the Super Bowl? It\'s awesome, right?'] },
    { id: 'world-builder-npc', name: 'World Architect', type: 'professor' as const, x: 20, y: 33, direction: 'up' as Direction, spritePath: '/pokemon/pnj/trainer_SAGE.png', dialogue: ['Welcome to the World Gate!', 'I can take you to an existing world, or create a brand new one!'] },
  ]);
  const wandererMovementRef = useRef<Map<string, { tileX: number; tileY: number; targetX: number; targetY: number; isMoving: boolean; moveProgress: number; nextMoveTime: number }>>(new Map());

  // Sync agent NPCs + wanderers into game state
  useEffect(() => {
    setNPCs([...agentNPCs, ...wandererNPCsRef.current]);
  }, [agentNPCs, setNPCs]);

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

  const gameLoop = useCallback((delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = getState();
    const player = state.player;
    const keys = getKeys();
    const isGameActive = screen === 'game' && !dialogueText;

    // === UPDATE PHASE ===

    // Handle movement
    if (player.isMoving) {
      // Continue current movement
      const newProgress = player.moveProgress + delta / MOVE_DURATION;
      if (newProgress >= 1) {
        // Movement complete - snap to target
        updatePlayer(() => ({
          x: player.targetX,
          y: player.targetY,
          isMoving: false,
          moveProgress: 0,
          animFrame: 0,
        }));

        // Check if player walked onto a door tile
        const doorBuilding = checkStandingOnDoor({
          ...player,
          x: player.targetX,
          y: player.targetY,
          isMoving: false,
        });
        if (doorBuilding && !doorTriggeredRef.current) {
          doorTriggeredRef.current = true;
          onInteractBuilding(doorBuilding);
        }

        // Check if player walked onto a route exit tile
        const targetTile = getTileAt(player.targetX, player.targetY);
        if (targetTile === TILE.ROUTE_EXIT && !routeTriggeredRef.current) {
          routeTriggeredRef.current = true;
          // South edge = World Gate (generative zones), North edge = Route 1
          if (player.targetY >= MAP_HEIGHT - 2) {
            onEnterRoute('world:latest');
          } else {
            onEnterRoute('route1');
          }
        }
      } else {
        // Animate walk cycle
        const walkFrame = newProgress < 0.33 ? 0 : newProgress < 0.66 ? 1 : 2;
        updatePlayer(() => ({
          moveProgress: newProgress,
          animFrame: walkFrame,
        }));
      }
    } else if (isGameActive) {
      // Reset door trigger when not on a door
      const currentDoor = checkStandingOnDoor(player);
      if (!currentDoor) {
        doorTriggeredRef.current = false;
      }

      // Reset route trigger when not on a route exit
      const currentTile = getTileAt(player.x, player.y);
      if (currentTile !== TILE.ROUTE_EXIT) {
        routeTriggeredRef.current = false;
      }

      // Check for new movement input
      let dir: Direction | null = null;
      if (keys.up) dir = 'up';
      else if (keys.down) dir = 'down';
      else if (keys.left) dir = 'left';
      else if (keys.right) dir = 'right';

      if (dir) {
        const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
        const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
        const targetX = player.x + dx[dir];
        const targetY = player.y + dy[dir];

        // Check if NPC is at target position
        const npcAtTarget = state.npcs.find(n => Math.round(n.x) === targetX && Math.round(n.y) === targetY);

        if (canMoveTo(targetX, targetY) && !npcAtTarget) {
          updatePlayer(() => ({
            direction: dir!,
            targetX,
            targetY,
            isMoving: true,
            moveProgress: 0,
            animFrame: 1,
          }));
        } else {
          // Just face the direction
          updatePlayer(() => ({ direction: dir! }));
        }
      }
    }

    // === WANDERER NPC MOVEMENT ===
    for (const npc of state.npcs) {
      if (npc.type !== 'wanderer') continue;
      const wStates = wandererMovementRef.current;
      if (!wStates.has(npc.id)) {
        wStates.set(npc.id, {
          tileX: npc.x, tileY: npc.y, targetX: npc.x, targetY: npc.y,
          isMoving: false, moveProgress: 0,
          nextMoveTime: Date.now() + 2000 + Math.random() * 3000,
        });
      }
      const ws = wStates.get(npc.id)!;
      if (ws.isMoving) {
        ws.moveProgress += delta / MOVE_DURATION;
        if (ws.moveProgress >= 1) {
          ws.tileX = ws.targetX;
          ws.tileY = ws.targetY;
          ws.isMoving = false;
          ws.moveProgress = 0;
          ws.nextMoveTime = Date.now() + 1500 + Math.random() * 3000;
          npc.x = ws.tileX;
          npc.y = ws.tileY;
          npc.animFrame = 0;
        } else {
          npc.x = ws.tileX + (ws.targetX - ws.tileX) * ws.moveProgress;
          npc.y = ws.tileY + (ws.targetY - ws.tileY) * ws.moveProgress;
          // Walk cycle: columns 1→0→3 mapped from progress
          npc.animFrame = ws.moveProgress < 0.33 ? 1 : ws.moveProgress < 0.66 ? 0 : 3;
        }
      } else if (isGameActive && Date.now() >= ws.nextMoveTime) {
        const dirs: Direction[] = ['up', 'down', 'left', 'right'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
        const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
        const tx = ws.tileX + dxMap[dir];
        const ty = ws.tileY + dyMap[dir];
        npc.direction = dir;
        const pTileX = Math.round(player.x);
        const pTileY = Math.round(player.y);
        const blocked = state.npcs.some(n => n.id !== npc.id && Math.round(n.x) === tx && Math.round(n.y) === ty);
        if (canMoveTo(tx, ty) && !blocked && !(pTileX === tx && pTileY === ty)) {
          ws.targetX = tx;
          ws.targetY = ty;
          ws.isMoving = true;
          ws.moveProgress = 0;
        } else {
          ws.nextMoveTime = Date.now() + 1000 + Math.random() * 2000;
        }
      }
    }

    // Handle Space/Enter interactions (NPCs and facing doors)
    if (isGameActive && consumeAction()) {
      if (Date.now() > interactionCooldownRef.current) {
        const interactable = checkInteraction(getState().player, state.npcs);
        if (interactable) {
          if ('route' in interactable) {
            onInteractBuilding(interactable as Building);
          } else {
            const npc = interactable as NPC;
            // Make wanderer face the player and pause movement
            if (npc.type === 'wanderer') {
              const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
              npc.direction = opposite[player.direction];
              npc.animFrame = 0;
              const ws = wandererMovementRef.current.get(npc.id);
              if (ws) {
                // Snap back to current tile and stop movement
                npc.x = ws.tileX;
                npc.y = ws.tileY;
                ws.isMoving = false;
                ws.moveProgress = 0;
                ws.nextMoveTime = Date.now() + 3000;
              }
            }
            onInteractNPC(npc);
          }
        }
      }
    }

    // Consume stale action presses during dialogue (DialogueBox handles advancement)
    if (dialogueText) {
      consumeAction();
    }

    // Handle menu toggle
    if (consumeCancel()) {
      onMenuToggle();
    }

    // Update interaction prompt visibility
    const currentState = getState();
    const hasInteractable = !currentState.player.isMoving &&
      hasNearbyInteractable(currentState.player, currentState.npcs);
    setState(() => ({ showInteractionPrompt: hasInteractable && isGameActive }));

    // === RENDER PHASE ===
    const vw = canvas.width;
    const vh = canvas.height;

    // Get player pixel position for camera
    const playerPixel = getPlayerPixelPosition(currentState.player);
    const camera = calculateCamera(playerPixel.x, playerPixel.y, vw, vh);

    // Clear
    ctx.clearRect(0, 0, vw, vh);

    // Draw map (ground, trees, paths, buildings)
    renderMap(ctx, camera, vw, vh, assets);

    // Draw NPCs (sorted by Y)
    renderNPCs(ctx, currentState.npcs, camera, assets, vw, vh);

    // Draw player
    renderPlayer(ctx, currentState.player, camera, assets);

    // Draw trees on top of player for depth (canopy effect)
    renderTreeOverlay(ctx, camera, vw, vh, assets);

    // Draw building labels on top of trees so they're always visible
    renderBuildingLabels(ctx, camera, vw, vh);

    // Draw tall grass overlay (on top of player for immersion)
    renderTallGrassOverlay(ctx, camera, vw, vh, assets);

    // Draw HUD
    renderHUD(ctx, vw, vh, currentState.showInteractionPrompt);
  }, [
    assets, screen, dialogueText, getKeys, getState,
    updatePlayer, setState, consumeAction, consumeCancel,
    onInteractBuilding, onInteractNPC, onMenuToggle, onEnterRoute,
  ]);

  useGameLoop(gameLoop, true);

  return (
    <div ref={containerRef} className="w-full h-full relative" tabIndex={0}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
