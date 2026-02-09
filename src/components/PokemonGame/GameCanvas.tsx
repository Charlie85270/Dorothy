'use client';
import { useRef, useEffect, useCallback } from 'react';
import { GameAssets, NPC, Building, Direction } from './types';
import { SCALED_TILE, MOVE_DURATION } from './constants';
import { useGameLoop } from './hooks/useGameLoop';
import { useKeyboard } from './hooks/useKeyboard';
import { useGameState } from './hooks/useGameState';
import { calculateCamera } from './engine/camera';
import { canMoveTo } from './engine/collision';
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

  // Track if we already triggered a door interaction to avoid re-triggering
  const doorTriggeredRef = useRef(false);

  // Sync agent NPCs into game state
  useEffect(() => {
    setNPCs(agentNPCs);
  }, [agentNPCs, getState, setNPCs]);

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
        const npcAtTarget = state.npcs.find(n => n.x === targetX && n.y === targetY);

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

    // Handle Space/Enter interactions (NPCs and facing doors)
    if (isGameActive && consumeAction()) {
      const interactable = checkInteraction(getState().player, state.npcs);
      if (interactable) {
        if ('route' in interactable) {
          onInteractBuilding(interactable as Building);
        } else {
          onInteractNPC(interactable as NPC);
        }
      }
    }

    // Handle dialogue advancement
    if (dialogueText && consumeAction()) {
      onDialogueAdvance();
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
    onInteractBuilding, onInteractNPC, onDialogueAdvance, onMenuToggle,
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
