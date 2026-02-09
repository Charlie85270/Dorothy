'use client';
import { useRef, useEffect, useCallback } from 'react';
import { InteriorConfig, InteriorRoomConfig, InteriorNPC, GameAssets, Direction, PlayerState } from '../types';
import { TILE_SIZE, MOVE_DURATION } from '../constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { getPlayerFrame } from '../sprites';

const INTERIOR_TILE = {
  FLOOR: 0,
  WALL: 1,
  FURNITURE: 2,
  EXIT: 3,
};

interface InteriorRoomProps {
  config: InteriorConfig;
  roomConfig: InteriorRoomConfig;
  assets: GameAssets;
  active: boolean;
  onInteractNPC: (npcId?: string) => void;
  onExit: () => void;
  interiorNPCs?: InteriorNPC[];
}

export default function InteriorRoom({
  config,
  roomConfig,
  assets,
  active,
  onInteractNPC,
  onExit,
  interiorNPCs,
}: InteriorRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player state (mutable ref for game loop performance)
  const playerRef = useRef<PlayerState>({
    x: roomConfig.playerStart.x,
    y: roomConfig.playerStart.y,
    targetX: roomConfig.playerStart.x,
    targetY: roomConfig.playerStart.y,
    direction: 'up',
    isMoving: false,
    moveProgress: 0,
    animFrame: 0,
  });

  // Key state
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const actionJustPressedRef = useRef(false);
  const actionPressedRef = useRef(false);
  const showPromptRef = useRef(false);
  const facingNpcIdRef = useRef<string | null>(null);

  // Cache loaded NPC sprite images
  const npcImageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Load NPC sprite images on demand
  useEffect(() => {
    if (!interiorNPCs) return;
    for (const npc of interiorNPCs) {
      if (!npcImageCacheRef.current[npc.spritePath]) {
        const img = new Image();
        img.src = npc.spritePath;
        npcImageCacheRef.current[npc.spritePath] = img;
      }
    }
  }, [interiorNPCs]);

  // Keyboard handlers - only registered when room is active
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          keysRef.current.up = true;
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          keysRef.current.down = true;
          break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          keysRef.current.left = true;
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          keysRef.current.right = true;
          break;
        case ' ':
          e.preventDefault();
          if (!actionPressedRef.current) {
            actionJustPressedRef.current = true;
            actionPressedRef.current = true;
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          keysRef.current.up = false;
          break;
        case 'ArrowDown': case 's': case 'S':
          keysRef.current.down = false;
          break;
        case 'ArrowLeft': case 'a': case 'A':
          keysRef.current.left = false;
          break;
        case 'ArrowRight': case 'd': case 'D':
          keysRef.current.right = false;
          break;
        case ' ':
          actionPressedRef.current = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Reset state when deactivating
      keysRef.current = { up: false, down: false, left: false, right: false };
      actionJustPressedRef.current = false;
      actionPressedRef.current = false;
    };
  }, [active]);

  // Canvas resize
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

  // Can the player move to this tile?
  const canMoveToTile = useCallback((x: number, y: number) => {
    if (x < 0 || x >= roomConfig.width || y < 0 || y >= roomConfig.height) return false;
    const tile = roomConfig.tilemap[y][x];
    return tile === INTERIOR_TILE.FLOOR || tile === INTERIOR_TILE.EXIT;
  }, [roomConfig]);

  // Check if player is facing the static NPC (legacy)
  // Supports interaction across furniture tiles (e.g. counter between player and vendor)
  const isFacingStaticNPC = useCallback((player: PlayerState) => {
    if (roomConfig.dynamicNPCs) return false; // skip static NPC check for dynamic rooms
    const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
    const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
    const stepX = dx[player.direction];
    const stepY = dy[player.direction];
    // Check up to 3 tiles ahead, passing through furniture
    for (let dist = 1; dist <= 3; dist++) {
      const fx = Math.round(player.x) + stepX * dist;
      const fy = Math.round(player.y) + stepY * dist;
      if (fx === roomConfig.npcPosition.x && fy === roomConfig.npcPosition.y) return true;
      // Stop scanning if we hit a non-furniture blocking tile (wall)
      const tile = roomConfig.tilemap[fy]?.[fx];
      if (tile === undefined || tile === INTERIOR_TILE.WALL) break;
      // Continue through furniture tiles
      if (tile !== INTERIOR_TILE.FURNITURE) break;
    }
    return false;
  }, [roomConfig]);

  // Check which dynamic NPC the player is facing (returns id or null)
  const getFacingDynamicNPC = useCallback((player: PlayerState, npcs: InteriorNPC[]): string | null => {
    const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
    const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
    const fx = Math.round(player.x) + dx[player.direction];
    const fy = Math.round(player.y) + dy[player.direction];
    for (const npc of npcs) {
      if (npc.x === fx && npc.y === fy) return npc.id;
    }
    return null;
  }, []);

  // ── Game Loop ──────────────────────────────────────────────────────────────
  const gameLoop = useCallback((delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const keys = keysRef.current;
    const dynNPCs = interiorNPCs || [];

    // ═══ UPDATE (only when active) ═══
    if (active) {
      if (player.isMoving) {
        const newProgress = player.moveProgress + delta / MOVE_DURATION;
        if (newProgress >= 1) {
          // Movement complete
          player.x = player.targetX;
          player.y = player.targetY;
          player.isMoving = false;
          player.moveProgress = 0;
          player.animFrame = 0;

          // Check if stepped on exit tile
          const tile = roomConfig.tilemap[player.y]?.[player.x];
          if (tile === INTERIOR_TILE.EXIT) {
            onExit();
            return;
          }
        } else {
          player.moveProgress = newProgress;
          player.animFrame = newProgress < 0.33 ? 0 : newProgress < 0.66 ? 1 : 2;
        }
      } else {
        // Check movement input
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

          // Block if static NPC is at target
          const staticNpcAtTarget =
            !roomConfig.dynamicNPCs &&
            targetX === roomConfig.npcPosition.x && targetY === roomConfig.npcPosition.y;

          // Block if any dynamic NPC is at target
          const dynamicNpcAtTarget = dynNPCs.some(n => n.x === targetX && n.y === targetY);

          if (canMoveToTile(targetX, targetY) && !staticNpcAtTarget && !dynamicNpcAtTarget) {
            player.direction = dir;
            player.targetX = targetX;
            player.targetY = targetY;
            player.isMoving = true;
            player.moveProgress = 0;
            player.animFrame = 1;
          } else {
            // Just face the direction
            player.direction = dir;
          }
        }
      }

      // Handle Space interaction
      if (actionJustPressedRef.current) {
        actionJustPressedRef.current = false;
        if (!player.isMoving) {
          if (dynNPCs.length > 0) {
            const facingId = getFacingDynamicNPC(player, dynNPCs);
            if (facingId) {
              onInteractNPC(facingId);
            }
          } else if (isFacingStaticNPC(player)) {
            onInteractNPC();
          }
        }
      }

      // Update facing prompt
      if (dynNPCs.length > 0) {
        const facingId = !player.isMoving ? getFacingDynamicNPC(player, dynNPCs) : null;
        showPromptRef.current = facingId !== null;
        facingNpcIdRef.current = facingId;
      } else {
        showPromptRef.current = !player.isMoving && isFacingStaticNPC(player);
        facingNpcIdRef.current = null;
      }
    }

    // ═══ RENDER (always, so room stays visible behind overlays) ═══
    const vw = canvas.width;
    const vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    const bgImage = assets.interiorBackgrounds[config.backgroundImage];
    if (!bgImage) return;

    // Scale background to fit canvas while preserving aspect ratio
    const bgAspect = bgImage.width / bgImage.height;
    const canvasAspect = vw / vh;
    let displayW: number, displayH: number, offsetX: number, offsetY: number;

    if (canvasAspect > bgAspect) {
      displayH = vh;
      displayW = vh * bgAspect;
    } else {
      displayW = vw;
      displayH = vw / bgAspect;
    }
    offsetX = (vw - displayW) / 2;
    offsetY = (vh - displayH) / 2;

    const tileW = displayW / roomConfig.width;
    const tileH = displayH / roomConfig.height;

    // Draw background image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bgImage, offsetX, offsetY, displayW, displayH);

    // ── Build entities for Y-sorting ──
    type Entity = { y: number; draw: () => void };
    const entities: Entity[] = [];

    // Static NPC (Chen) — only for non-dynamic rooms
    if (!roomConfig.dynamicNPCs && config.npcSprite) {
      const npcY = roomConfig.npcPosition.y;
      entities.push({
        y: npcY,
        draw: () => {
          const chenImage = assets.interiorBackgrounds[config.npcSprite!];
          const chenScreenX = offsetX + roomConfig.npcPosition.x * tileW;
          const chenScreenY = offsetY + roomConfig.npcPosition.y * tileH;

          if (chenImage) {
            const chenDrawW = tileW;
            const chenDrawH = (chenImage.height / chenImage.width) * chenDrawW;
            const chenOffX = (tileW - chenDrawW) / 2;
            const chenOffY = tileH - chenDrawH;
            ctx.drawImage(
              chenImage,
              chenScreenX + chenOffX,
              chenScreenY + chenOffY,
              chenDrawW,
              chenDrawH
            );
          } else {
            // Fallback pixel art
            const cx = chenScreenX + tileW / 2;
            const cy = chenScreenY + tileH / 2;
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(cx - 12, cy - 4, 24, 28);
            ctx.fillStyle = '#d0b080';
            ctx.fillRect(cx - 8, cy - 16, 16, 14);
            ctx.fillStyle = '#888888';
            ctx.fillRect(cx - 8, cy - 18, 16, 6);
            ctx.fillStyle = '#000';
            ctx.fillRect(cx - 4, cy - 10, 3, 3);
            ctx.fillRect(cx + 2, cy - 10, 3, 3);
          }

          // Name label
          if (config.npcName) {
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const labelX = chenScreenX + tileW / 2;
            const labelY = chenScreenY - 4;
            const metrics = ctx.measureText(config.npcName);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.roundRect(
              labelX - metrics.width / 2 - 4,
              labelY - 16,
              metrics.width + 8,
              20,
              3
            );
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(config.npcName, labelX, labelY);
          }
        },
      });
    }

    // Dynamic NPCs
    for (const npc of dynNPCs) {
      entities.push({
        y: npc.y,
        draw: () => {
          const spriteImg = npcImageCacheRef.current[npc.spritePath];
          const screenX = offsetX + npc.x * tileW;
          const screenY = offsetY + npc.y * tileH;

          if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
            // Draw pokemon sprite scaled to tile
            const drawW = tileW * 0.9;
            const drawH = (spriteImg.height / spriteImg.width) * drawW;
            const offX = (tileW - drawW) / 2;
            const offY = tileH - drawH;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spriteImg, screenX + offX, screenY + offY, drawW, drawH);
          } else {
            // Fallback colored circle
            const cx = screenX + tileW / 2;
            const cy = screenY + tileH / 2;
            ctx.fillStyle = '#f8a848';
            ctx.beginPath();
            ctx.arc(cx, cy, tileW * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(npc.name.charAt(0), cx, cy);
          }

          // Name label + status dot
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const labelX = screenX + tileW / 2;
          const labelY = screenY - 2;
          const nameText = npc.name.length > 10 ? npc.name.substring(0, 9) + '..' : npc.name;
          const metrics = ctx.measureText(nameText);
          const dotRadius = 4;
          const totalW = metrics.width + (npc.status ? dotRadius * 2 + 6 : 0) + 8;

          // Background pill
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.beginPath();
          ctx.roundRect(labelX - totalW / 2, labelY - 15, totalW, 17, 4);
          ctx.fill();

          // Status dot
          if (npc.status) {
            const dotColor =
              npc.status === 'running' ? '#22c55e' :
              npc.status === 'idle' || npc.status === 'waiting' ? '#eab308' :
              '#ef4444';
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(labelX - totalW / 2 + 8, labelY - 7, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Name text
          ctx.fillStyle = '#fff';
          const textOffsetX = npc.status ? dotRadius + 4 : 0;
          ctx.fillText(nameText, labelX + textOffsetX / 2, labelY);
        },
      });
    }

    // Player entity
    const playerVisualY = player.isMoving
      ? player.y + (player.targetY - player.y) * player.moveProgress
      : player.y;

    entities.push({
      y: playerVisualY,
      draw: () => {
        let px: number, py: number;
        if (player.isMoving) {
          px = player.x + (player.targetX - player.x) * player.moveProgress;
          py = player.y + (player.targetY - player.y) * player.moveProgress;
        } else {
          px = player.x;
          py = player.y;
        }

        const screenX = offsetX + px * tileW;
        const screenY = offsetY + py * tileH;

        if (assets.player) {
          const frame = getPlayerFrame(player.direction, player.animFrame);
          ctx.imageSmoothingEnabled = false;
          const spriteScale = tileW / TILE_SIZE;
          const drawWidth = frame.sw * spriteScale;
          const drawHeight = frame.sh * spriteScale;
          const pOffsetX = (tileW - drawWidth) / 2;
          const pOffsetY = tileH - drawHeight;
          ctx.drawImage(
            assets.player,
            frame.sx, frame.sy, frame.sw, frame.sh,
            screenX + pOffsetX,
            screenY + pOffsetY,
            drawWidth,
            drawHeight
          );
        } else {
          // Fallback colored square
          ctx.fillStyle = '#f83838';
          ctx.fillRect(screenX + 4, screenY + 4, tileW - 8, tileH - 8);
        }
      },
    });

    // Y-sort and draw all entities (painter's algorithm)
    entities.sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      entity.draw();
    }

    // ── Interaction prompt ──
    if (showPromptRef.current && active) {
      const promptText = 'Press SPACE';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const promptY = vh - 60;
      const bounce = Math.sin(Date.now() / 300) * 3;
      const pm = ctx.measureText(promptText);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(
        vw / 2 - pm.width / 2 - 12,
        promptY - 14 + bounce,
        pm.width + 24,
        28,
        8
      );
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(promptText, vw / 2, promptY + bounce);
    }

    // ── Room title banner ──
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const titleMetrics = ctx.measureText(config.title);
    const bannerW = titleMetrics.width + 32;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(vw / 2 - bannerW / 2, 8, bannerW, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(config.title, vw / 2, 14);
  }, [active, assets, config, roomConfig, interiorNPCs, canMoveToTile, isFacingStaticNPC, getFacingDynamicNPC, onInteractNPC, onExit]);

  useGameLoop(gameLoop, true);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
