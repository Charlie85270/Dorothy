'use client';
import { useRef, useEffect, useCallback } from 'react';
import { GameAssets, Direction, PlayerState } from '../types';
import { TILE, SCALED_TILE, SCALE, MOVE_DURATION } from '../constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { useKeyboard } from '../hooks/useKeyboard';
import { renderPlayer, getPlayerPixelPosition } from '../renderer/playerRenderer';
import type { GenerativeZone } from '@/types/world';

const SOLID_TILES = new Set<number>([TILE.TREE, TILE.BUILDING, TILE.FENCE, TILE.WATER, TILE.SIGN, TILE.GRAVE]);

// Interior room dimensions
const INTERIOR_WIDTH = 10;
const INTERIOR_HEIGHT = 8;

// Interior NPC type (from zone data)
interface InteriorNPC {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: Direction;
  spritePath: string;
  dialogue: string[];
}

// Active interior state
interface InteriorState {
  buildingId: string;
  backgroundImage: string;
  npcs: InteriorNPC[];
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
  waitTimer: number;
}

interface GenerativeZoneOverlayProps {
  zone: GenerativeZone;
  assets: GameAssets;
  onExit: () => void;
}

export default function GenerativeZoneOverlay({ zone, assets, onExit }: GenerativeZoneOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getKeys, consumeAction, consumeCancel } = useKeyboard();
  const exitTriggeredRef = useRef(false);
  const fadeRef = useRef(1);
  const zoneNameTimerRef = useRef(3000);

  // Zone ref for hot updates — game loop always reads latest zone data
  const zoneRef = useRef(zone);
  useEffect(() => {
    zoneRef.current = zone;
  }, [zone]);

  // Dialogue state
  const dialogueRef = useRef<string | null>(null);
  const dialogueQueueRef = useRef<string[]>([]);
  const dialogueSpeakerRef = useRef<string | undefined>(undefined);
  const interactionCooldownRef = useRef(0);

  // Player state
  const playerRef = useRef<PlayerState>({
    x: zone.playerStart.x,
    y: zone.playerStart.y,
    targetX: zone.playerStart.x,
    targetY: zone.playerStart.y,
    direction: 'down' as Direction,
    isMoving: false,
    moveProgress: 0,
    animFrame: 0,
  });

  // Cached tile canvases
  const grassCacheRef = useRef<HTMLCanvasElement | null>(null);
  const waterCacheRef = useRef<HTMLCanvasElement | null>(null);

  // Sprite caches
  const npcSpritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const buildingSpritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const failedSpritesRef = useRef<Set<string>>(new Set());

  // NPC facing override during dialogue
  const npcFacingOverrideRef = useRef<Map<string, Direction>>(new Map());

  // Door interaction tracking
  const doorTriggeredRef = useRef(false);

  // Patrol NPC states
  const patrolStatesRef = useRef<Map<string, PatrolState>>(new Map());

  // Interior state
  const interiorRef = useRef<InteriorState | null>(null);
  const interiorPlayerRef = useRef<PlayerState>({
    x: 5, y: 6, targetX: 5, targetY: 6,
    direction: 'up' as Direction, isMoving: false, moveProgress: 0, animFrame: 0,
  });
  const savedZonePlayerRef = useRef<{ x: number; y: number } | null>(null);
  const interiorBgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const interiorNpcSpritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const interiorNpcFacingRef = useRef<Map<string, Direction>>(new Map());

  // Initialize patrol states when zone changes
  useEffect(() => {
    patrolStatesRef.current.clear();
    for (const npc of zone.npcs) {
      if (npc.patrol && npc.patrol.length > 0) {
        patrolStatesRef.current.set(npc.id, {
          x: npc.x,
          y: npc.y,
          targetX: npc.x,
          targetY: npc.y,
          direction: npc.direction,
          isMoving: false,
          moveProgress: 0,
          patrolStep: 0,
          waitTimer: 500,
        });
      }
    }
  }, [zone.npcs]);

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

  // Load sprite with fallback tracking
  const getSprite = useCallback((path: string, cache: Map<string, HTMLImageElement>): HTMLImageElement | null => {
    if (failedSpritesRef.current.has(path)) return null;
    if (!cache.has(path)) {
      const img = new Image();
      img.src = path;
      img.onerror = () => { failedSpritesRef.current.add(path); };
      cache.set(path, img);
    }
    const img = cache.get(path)!;
    if (img.complete && img.naturalWidth > 0) return img;
    return null;
  }, []);

  // Check if a position is inside a building footprint (but not its door)
  const isInsideBuilding = useCallback((x: number, y: number): boolean => {
    const z = zoneRef.current;
    for (const b of z.buildings) {
      if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
        return true; // Inside building body
      }
    }
    return false;
  }, []);

  // Check if position is a building door
  const isBuildingDoor = useCallback((x: number, y: number): boolean => {
    const z = zoneRef.current;
    return z.buildings.some(b => b.doorX === x && b.doorY === y);
  }, []);

  // Collision check
  const canMoveTo = useCallback((x: number, y: number) => {
    const z = zoneRef.current;
    if (x < 0 || x >= z.width || y < 0 || y >= z.height) return false;
    if (SOLID_TILES.has(z.tilemap[y][x])) return false;
    // Block building footprints (defensive — even if tilemap wasn't stamped)
    if (isInsideBuilding(x, y) && !isBuildingDoor(x, y)) return false;
    // Block NPC positions
    for (const npc of z.npcs) {
      const ps = patrolStatesRef.current.get(npc.id);
      const nx = ps ? (ps.isMoving ? ps.targetX : ps.x) : npc.x;
      const ny = ps ? (ps.isMoving ? ps.targetY : ps.y) : npc.y;
      if (nx === x && ny === y) return false;
    }
    return true;
  }, [isInsideBuilding, isBuildingDoor]);

  // Camera — centers the map when it's smaller than the viewport
  const calculateCamera = useCallback((px: number, py: number, vw: number, vh: number) => {
    const z = zoneRef.current;
    const mapPW = z.width * SCALED_TILE;
    const mapPH = z.height * SCALED_TILE;
    let camX: number, camY: number;
    if (mapPW <= vw) {
      // Map smaller than viewport: center it
      camX = -(vw - mapPW) / 2;
    } else {
      camX = px - vw / 2 + SCALED_TILE / 2;
      camX = Math.max(0, Math.min(camX, mapPW - vw));
    }
    if (mapPH <= vh) {
      camY = -(vh - mapPH) / 2;
    } else {
      camY = py - vh / 2 + SCALED_TILE / 2;
      camY = Math.max(0, Math.min(camY, mapPH - vh));
    }
    return { x: Math.round(camX), y: Math.round(camY) };
  }, []);

  // Tile caches
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

  // Build sign/grave lookup maps from zone data
  const getSignText = useCallback((x: number, y: number): string[] | null => {
    const z = zoneRef.current;
    const sign = z.signs.find(s => s.x === x && s.y === y);
    return sign ? sign.text : null;
  }, []);

  const getGraveText = useCallback((x: number, y: number): string[] | null => {
    const z = zoneRef.current;
    const grave = z.graves.find(g => g.x === x && g.y === y);
    return grave ? [grave.name, grave.epitaph] : null;
  }, []);

  const gameLoop = useCallback((delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const z = zoneRef.current;
    const player = playerRef.current;
    const keys = getKeys();
    const vw = canvas.width;
    const vh = canvas.height;

    // Fade-in
    if (fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - delta / 400);
    }
    const isActive = fadeRef.current <= 0;

    // Zone name banner timer
    if (zoneNameTimerRef.current > 0) {
      zoneNameTimerRef.current -= delta;
    }

    // === INTERIOR MODE ===
    if (interiorRef.current) {
      const interior = interiorRef.current;
      const ip = interiorPlayerRef.current;

      // Interior dialogue
      if (dialogueRef.current) {
        if (consumeAction()) {
          if (dialogueQueueRef.current.length > 0) {
            dialogueRef.current = dialogueQueueRef.current.shift()!;
          } else {
            dialogueRef.current = null;
            dialogueSpeakerRef.current = undefined;
            interiorNpcFacingRef.current.clear();
            interactionCooldownRef.current = Date.now() + 400;
          }
        }
      } else if (ip.isMoving) {
        const newProgress = ip.moveProgress + delta / MOVE_DURATION;
        if (newProgress >= 1) {
          ip.x = ip.targetX;
          ip.y = ip.targetY;
          ip.isMoving = false;
          ip.moveProgress = 0;
          ip.animFrame = 0;

          // Check exit (bottom row, middle tiles)
          if (ip.y >= INTERIOR_HEIGHT - 1) {
            // Exit interior
            const saved = savedZonePlayerRef.current;
            if (saved) {
              const zonePlayer = playerRef.current;
              zonePlayer.x = saved.x;
              zonePlayer.y = saved.y;
              zonePlayer.targetX = saved.x;
              zonePlayer.targetY = saved.y;
              zonePlayer.direction = 'down';
              zonePlayer.isMoving = false;
              zonePlayer.moveProgress = 0;
              zonePlayer.animFrame = 0;
            }
            interiorRef.current = null;
            savedZonePlayerRef.current = null;
            doorTriggeredRef.current = true;
            interactionCooldownRef.current = Date.now() + 400;
            return;
          }
        } else {
          ip.moveProgress = newProgress;
          ip.animFrame = newProgress < 0.33 ? 0 : newProgress < 0.66 ? 1 : 2;
        }
      } else if (isActive) {
        // ESC to exit interior
        if (consumeCancel()) {
          const saved = savedZonePlayerRef.current;
          if (saved) {
            const zonePlayer = playerRef.current;
            zonePlayer.x = saved.x;
            zonePlayer.y = saved.y;
            zonePlayer.targetX = saved.x;
            zonePlayer.targetY = saved.y;
            zonePlayer.direction = 'down';
            zonePlayer.isMoving = false;
          }
          interiorRef.current = null;
          savedZonePlayerRef.current = null;
          doorTriggeredRef.current = true;
          interactionCooldownRef.current = Date.now() + 400;
          return;
        }

        // Space to interact with NPC
        if (consumeAction() && Date.now() > interactionCooldownRef.current) {
          const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
          const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
          const facingX = ip.x + dxMap[ip.direction];
          const facingY = ip.y + dyMap[ip.direction];
          const npc = interior.npcs.find(n => n.x === facingX && n.y === facingY);
          if (npc && npc.dialogue.length > 0) {
            const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
            interiorNpcFacingRef.current.set(npc.id, opposite[ip.direction]);
            dialogueRef.current = npc.dialogue[0];
            dialogueQueueRef.current = [...npc.dialogue.slice(1)];
            dialogueSpeakerRef.current = npc.name;
          }
        }

        // Movement
        let dir: Direction | null = null;
        if (keys.up) dir = 'up';
        else if (keys.down) dir = 'down';
        else if (keys.left) dir = 'left';
        else if (keys.right) dir = 'right';

        if (dir) {
          const dx: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
          const dy: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
          const tx = ip.x + dx[dir];
          const ty = ip.y + dy[dir];

          // Bounds check (allow y up to INTERIOR_HEIGHT-1 for exit row)
          const inBounds = tx >= 0 && tx < INTERIOR_WIDTH && ty >= 0 && ty < INTERIOR_HEIGHT;
          const npcBlocking = interior.npcs.some(n => n.x === tx && n.y === ty);

          if (inBounds && !npcBlocking) {
            ip.direction = dir;
            ip.targetX = tx;
            ip.targetY = ty;
            ip.isMoving = true;
            ip.moveProgress = 0;
            ip.animFrame = 1;
          } else {
            ip.direction = dir;
          }
        }
      }

      // === INTERIOR RENDER ===
      ctx.clearRect(0, 0, vw, vh);
      ctx.imageSmoothingEnabled = false;

      // Room dimensions in pixels
      const roomPW = INTERIOR_WIDTH * SCALED_TILE;
      const roomPH = INTERIOR_HEIGHT * SCALED_TILE;
      const roomX = (vw - roomPW) / 2;
      const roomY = (vh - roomPH) / 2;

      // Dark background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, vw, vh);

      // Background image
      const bgImg = getSprite(interior.backgroundImage, interiorBgRef.current);
      if (bgImg) {
        ctx.drawImage(bgImg, roomX, roomY, roomPW, roomPH);
      } else {
        // Fallback: floor tiles
        ctx.fillStyle = '#c4a882';
        ctx.fillRect(roomX, roomY, roomPW, roomPH);
        // Checkerboard
        for (let ry = 0; ry < INTERIOR_HEIGHT; ry++) {
          for (let rx = 0; rx < INTERIOR_WIDTH; rx++) {
            if ((rx + ry) % 2 === 0) {
              ctx.fillStyle = '#b89b72';
              ctx.fillRect(roomX + rx * SCALED_TILE, roomY + ry * SCALED_TILE, SCALED_TILE, SCALED_TILE);
            }
          }
        }
      }

      // Wall border
      ctx.strokeStyle = '#4a3728';
      ctx.lineWidth = 4;
      ctx.strokeRect(roomX, roomY, roomPW, roomPH);

      // Exit indicator at bottom
      const exitX = roomX + 4 * SCALED_TILE;
      const exitY = roomY + (INTERIOR_HEIGHT - 1) * SCALED_TILE;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(exitX, exitY, SCALED_TILE * 2, SCALED_TILE);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', exitX + SCALED_TILE, exitY + SCALED_TILE / 2);

      // Interior NPCs
      for (const npc of interior.npcs) {
        const npx = roomX + npc.x * SCALED_TILE;
        const npy = roomY + npc.y * SCALED_TILE;
        const facingOverride = interiorNpcFacingRef.current.get(npc.id);
        const npcDir = facingOverride || npc.direction;

        const sprite = getSprite(npc.spritePath, interiorNpcSpritesRef.current);
        if (sprite) {
          const dirRow: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
          const row = dirRow[npcDir];
          const frameW = sprite.naturalWidth / 4;
          const frameH = sprite.naturalHeight / 4;
          const drawW = SCALED_TILE * 1.0;
          const drawH = SCALED_TILE * 1.5;
          const offsetX = (SCALED_TILE - drawW) / 2;
          const offsetY = SCALED_TILE - drawH;
          ctx.drawImage(
            sprite,
            0, row * frameH, frameW, frameH,
            npx + offsetX, npy + offsetY, drawW, drawH,
          );
        } else {
          // Fallback circle
          const cx = npx + SCALED_TILE / 2;
          const cy = npy + SCALED_TILE / 2;
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.arc(cx, cy, SCALED_TILE * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = 'bold 16px monospace';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(npc.name.charAt(0).toUpperCase(), cx, cy);
        }
      }

      // Interior player — use renderPlayer with a virtual camera offset by the room position
      const interiorCamera = { x: -roomX, y: -roomY };
      renderPlayer(ctx, ip, interiorCamera, assets);

      // Dialogue box (same as zone)
      if (dialogueRef.current) {
        const speaker = dialogueSpeakerRef.current;
        const boxH = 110;
        const boxW = Math.min(vw - 32, 640);
        const dbX = (vw - boxW) / 2;
        const dbY = vh - boxH - 16;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(dbX + 4, dbY + 4, boxW, boxH, 8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(dbX, dbY, boxW, boxH, 8);
        ctx.fill();

        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 4;
        ctx.stroke();

        if (speaker) {
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#6b7280';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(speaker.toUpperCase(), dbX + 16, dbY + 12);
        }

        ctx.font = '18px monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const dlgMaxW = boxW - 40;
        const dlgLines = wrapText(ctx, dialogueRef.current, dlgMaxW);
        const dlgStartY = dbY + (speaker ? 32 : 20);
        for (let i = 0; i < dlgLines.length; i++) {
          ctx.fillText(dlgLines[i], dbX + 16, dlgStartY + i * 20);
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText('\u25BC', dbX + boxW - 16, dbY + boxH - 24);
      }

      // Fade overlay
      if (fadeRef.current > 0) {
        ctx.fillStyle = `rgba(0,0,0,${fadeRef.current})`;
        ctx.fillRect(0, 0, vw, vh);
      }

      return; // Skip zone rendering
    }

    // === UPDATE PHASE ===

    // Handle dialogue
    if (dialogueRef.current) {
      if (consumeAction()) {
        if (dialogueQueueRef.current.length > 0) {
          dialogueRef.current = dialogueQueueRef.current.shift()!;
        } else {
          dialogueRef.current = null;
          dialogueSpeakerRef.current = undefined;
          npcFacingOverrideRef.current.clear();
          interactionCooldownRef.current = Date.now() + 400;
        }
      }
    } else if (player.isMoving) {
      const newProgress = player.moveProgress + delta / MOVE_DURATION;
      if (newProgress >= 1) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.isMoving = false;
        player.moveProgress = 0;
        player.animFrame = 0;

        // Check for route exit
        if (z.tilemap[player.y]?.[player.x] === TILE.ROUTE_EXIT && !exitTriggeredRef.current) {
          exitTriggeredRef.current = true;
          onExit();
          return;
        }

        // Check for door (check tilemap OR buildings array defensively)
        const onDoorTile = z.tilemap[player.y]?.[player.x] === TILE.DOOR;
        const doorBuilding = z.buildings.find(b => b.doorX === player.x && b.doorY === player.y);
        if ((onDoorTile || doorBuilding) && !doorTriggeredRef.current) {
          const building = doorBuilding || z.buildings.find(b => b.doorX === player.x && b.doorY === player.y);
          if (building) {
            doorTriggeredRef.current = true;
            // Check for interior
            const interior = z.interiors?.find(i => i.buildingId === building.id);
            if (interior) {
              // Enter interior
              savedZonePlayerRef.current = { x: player.x, y: player.y };
              interiorPlayerRef.current = {
                x: 5, y: 6, targetX: 5, targetY: 6,
                direction: 'up' as Direction, isMoving: false, moveProgress: 0, animFrame: 0,
              };
              interiorNpcFacingRef.current.clear();
              interiorRef.current = {
                buildingId: interior.buildingId,
                backgroundImage: interior.backgroundImage,
                npcs: interior.npcs.map(n => ({ ...n, direction: n.direction as Direction })),
              };
            } else {
              dialogueRef.current = building.closedMessage || `The ${building.label} is closed.`;
              dialogueQueueRef.current = [];
              dialogueSpeakerRef.current = undefined;
            }
          }
        } else if (!onDoorTile && !doorBuilding) {
          doorTriggeredRef.current = false;
        }
      } else {
        player.moveProgress = newProgress;
        player.animFrame = newProgress < 0.33 ? 0 : newProgress < 0.66 ? 1 : 2;
      }
    } else if (isActive) {
      // ESC to exit
      if (consumeCancel()) {
        onExit();
        return;
      }

      // Space to interact
      if (consumeAction() && Date.now() > interactionCooldownRef.current) {
        const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
        const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
        const facingX = player.x + dxMap[player.direction];
        const facingY = player.y + dyMap[player.direction];

        let interacted = false;

        // Check NPC interaction
        const npc = z.npcs.find(n => {
          const ps = patrolStatesRef.current.get(n.id);
          const nx = ps ? ps.x : n.x;
          const ny = ps ? ps.y : n.y;
          return nx === facingX && ny === facingY;
        });
        if (npc && npc.dialogue.length > 0) {
          const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
          const faceDir = opposite[player.direction];
          const ps = patrolStatesRef.current.get(npc.id);
          if (ps && !ps.isMoving) {
            ps.direction = faceDir;
            ps.waitTimer = 0;
          }
          npcFacingOverrideRef.current.set(npc.id, faceDir);
          dialogueRef.current = npc.dialogue[0];
          dialogueQueueRef.current = [...npc.dialogue.slice(1)];
          dialogueSpeakerRef.current = npc.name;
          interacted = true;
        }

        // Check sign / grave interaction
        if (!interacted && facingX >= 0 && facingX < z.width && facingY >= 0 && facingY < z.height) {
          const facingTile = z.tilemap[facingY][facingX];
          if (facingTile === TILE.SIGN) {
            const text = getSignText(facingX, facingY);
            if (text && text.length > 0) {
              dialogueRef.current = text[0];
              dialogueQueueRef.current = [...text.slice(1)];
              dialogueSpeakerRef.current = undefined;
            }
          } else if (facingTile === TILE.GRAVE) {
            const text = getGraveText(facingX, facingY);
            if (text && text.length > 0) {
              dialogueRef.current = text[0];
              dialogueQueueRef.current = [...text.slice(1)];
              dialogueSpeakerRef.current = undefined;
            }
          }
        }
      }

      // Movement
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
    for (const npc of z.npcs) {
      if (!npc.patrol || npc.patrol.length === 0) continue;
      const ps = patrolStatesRef.current.get(npc.id);
      if (!ps) continue;
      if (isInDialogue) continue;

      const PATROL_SPEED = MOVE_DURATION * 1.8;
      if (ps.isMoving) {
        ps.moveProgress += delta / PATROL_SPEED;
        if (ps.moveProgress >= 1) {
          ps.x = ps.targetX;
          ps.y = ps.targetY;
          ps.isMoving = false;
          ps.moveProgress = 0;
          ps.patrolStep = (ps.patrolStep + 1) % npc.patrol.length;
          ps.waitTimer = 0;
        }
      }
      if (!ps.isMoving) {
        ps.waitTimer -= delta;
        if (ps.waitTimer <= 0) {
          const patrolDir = npc.patrol[ps.patrolStep];
          const dxMap: Record<Direction, number> = { left: -1, right: 1, up: 0, down: 0 };
          const dyMap: Record<Direction, number> = { left: 0, right: 0, up: -1, down: 1 };
          const nx = ps.x + dxMap[patrolDir];
          const ny = ps.y + dyMap[patrolDir];
          ps.direction = patrolDir;

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
    const startCol = Math.max(0, Math.floor(camera.x / SCALED_TILE) - 1);
    const startRow = Math.max(0, Math.floor(camera.y / SCALED_TILE) - 1);
    const endCol = Math.min(z.width, Math.ceil((camera.x + vw) / SCALED_TILE) + 1);
    const endRow = Math.min(z.height, Math.ceil((camera.y + vh) / SCALED_TILE) + 1);

    // Ground layer
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = z.tilemap[row]?.[col];
        if (tile === undefined) continue;
        const px = col * SCALED_TILE - camera.x;
        const py = row * SCALED_TILE - camera.y;

        // Grass base
        if (grassCacheRef.current) {
          ctx.drawImage(grassCacheRef.current, px, py);
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#73CDA4' : '#6BC59C';
          ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
        }

        // Tile-specific
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
    for (const building of z.buildings) {
      const bpx = building.x * SCALED_TILE - camera.x;
      const bpy = building.y * SCALED_TILE - camera.y;
      const bw = building.width * SCALED_TILE;
      const bh = building.height * SCALED_TILE;

      if (bpx + bw < -40 || bpx > vw + 40 || bpy + bh < -60 || bpy > vh + 40) continue;

      const spriteImg = getSprite(building.spriteFile, buildingSpritesRef.current);
      if (spriteImg) {
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
        // Fallback: colored building
        const roofH = Math.floor(bh * 0.35);
        ctx.fillStyle = '#B83020';
        ctx.fillRect(bpx - 4, bpy, bw + 8, roofH);
        ctx.fillStyle = '#E8D8A8';
        ctx.fillRect(bpx, bpy + roofH, bw, bh - roofH);
      }
    }

    // NPCs (Y-sorted for depth)
    const sortedNpcs = [...z.npcs].sort((a, b) => {
      const psA = patrolStatesRef.current.get(a.id);
      const psB = patrolStatesRef.current.get(b.id);
      const ay = psA ? psA.y : a.y;
      const by = psB ? psB.y : b.y;
      return ay - by;
    });

    for (const npc of sortedNpcs) {
      const ps = patrolStatesRef.current.get(npc.id);
      let npcDrawX: number, npcDrawY: number, npcDir: Direction, npcAnim: number;

      if (ps) {
        const interpX = ps.isMoving ? ps.x + (ps.targetX - ps.x) * ps.moveProgress : ps.x;
        const interpY = ps.isMoving ? ps.y + (ps.targetY - ps.y) * ps.moveProgress : ps.y;
        npcDrawX = interpX * SCALED_TILE - camera.x;
        npcDrawY = interpY * SCALED_TILE - camera.y;
        npcDir = ps.direction;
        npcAnim = ps.isMoving ? Math.floor(ps.moveProgress * 4) % 2 : 0;
      } else {
        npcDrawX = npc.x * SCALED_TILE - camera.x;
        npcDrawY = npc.y * SCALED_TILE - camera.y;
        npcDir = npc.direction;
        npcAnim = 0;
      }

      // Apply facing override
      const facingOverride = npcFacingOverrideRef.current.get(npc.id);
      if (facingOverride) npcDir = facingOverride;

      if (npcDrawX + SCALED_TILE < 0 || npcDrawX > vw || npcDrawY + SCALED_TILE < 0 || npcDrawY > vh) continue;

      ctx.imageSmoothingEnabled = false;

      // Sprite sheet NPC (4x4 grid, 128x192)
      const sprite = getSprite(npc.spritePath, npcSpritesRef.current);
      if (sprite) {
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
      } else {
        // Fallback: colored circle with first letter
        const cx = npcDrawX + SCALED_TILE / 2;
        const cy = npcDrawY + SCALED_TILE / 2;
        const r = SCALED_TILE * 0.35;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(npc.name.charAt(0).toUpperCase(), cx, cy);
      }
    }

    // Player
    renderPlayer(ctx, player, camera, assets);

    // Tree overlay (depth)
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (z.tilemap[row]?.[col] !== TILE.TREE) continue;
        const px = col * SCALED_TILE - camera.x;
        const py = row * SCALED_TILE - camera.y;
        drawTree(ctx, px, py, (col + row) % 3, assets);
      }
    }

    // Building labels
    for (const building of z.buildings) {
      const bpx = building.x * SCALED_TILE - camera.x;
      const bpy = building.y * SCALED_TILE - camera.y;
      const bw = building.width * SCALED_TILE;
      const bh = building.height * SCALED_TILE;
      if (bpx + bw < -40 || bpx > vw + 40 || bpy + bh < -60 || bpy > vh + 40) continue;
      drawBuildingLabel(ctx, bpx + bw / 2, bpy - 8, building.label);
    }

    // Zone name banner
    if (zoneNameTimerRef.current > 0) {
      const alpha = Math.min(1, zoneNameTimerRef.current / 1000);
      const bannerText = z.name.toUpperCase();
      ctx.font = 'bold 22px monospace';
      const textW = ctx.measureText(bannerText).width;
      const bannerW = textW + 40;
      const bannerH = 44;
      const bannerX = vw / 2 - bannerW / 2;
      const bannerY = 24;

      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(bannerText, vw / 2, bannerY + bannerH / 2);
    }

    // Dialogue box
    if (dialogueRef.current) {
      const speaker = dialogueSpeakerRef.current;
      const boxH = 110;
      const boxW = Math.min(vw - 32, 640);
      const boxX = (vw - boxW) / 2;
      const boxY = vh - boxH - 16;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(boxX + 4, boxY + 4, boxW, boxH, 8);
      ctx.fill();

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();

      // Border
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Speaker
      if (speaker) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(speaker.toUpperCase(), boxX + 16, boxY + 12);
      }

      // Text
      ctx.font = '18px monospace';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const dlgMaxW = boxW - 40;
      const dlgLines = wrapText(ctx, dialogueRef.current, dlgMaxW);
      const dlgStartY = boxY + (speaker ? 32 : 20);
      for (let i = 0; i < dlgLines.length; i++) {
        ctx.fillText(dlgLines[i], boxX + 16, dlgStartY + i * 20);
      }

      // Advance arrow
      ctx.font = '14px monospace';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'right';
      ctx.fillText('\u25BC', boxX + boxW - 16, boxY + boxH - 24);
    }

    // Fade overlay
    if (fadeRef.current > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeRef.current})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }, [assets, getKeys, consumeAction, consumeCancel, onExit, canMoveTo, calculateCamera, ensureGrassCache, ensureWaterCache, getSignText, getGraveText, getSprite]);

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

// ── Drawing helpers ─────────────────────────────────────────────────────────

function drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, variant: number, assets: GameAssets) {
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

let flowerImg: HTMLImageElement | null = null;
function drawFlower(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!flowerImg) { flowerImg = new Image(); flowerImg.src = '/pokemon/grass/flower.png'; }
  if (flowerImg.complete && flowerImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(flowerImg, px, py, SCALED_TILE, SCALED_TILE);
  }
}

let barrierImg: HTMLImageElement | null = null;
function drawFence(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!barrierImg) { barrierImg = new Image(); barrierImg.src = '/pokemon/grass/barrier.png'; }
  if (barrierImg.complete && barrierImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(barrierImg, px, py, SCALED_TILE, SCALED_TILE);
  }
}

let signImg: HTMLImageElement | null = null;
function drawSign(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!signImg) { signImg = new Image(); signImg.src = '/pokemon/grass/pancarte.png'; }
  if (signImg.complete && signImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(signImg, px, py, SCALED_TILE, SCALED_TILE);
  }
}

let graveImg: HTMLImageElement | null = null;
function drawGrave(ctx: CanvasRenderingContext2D, px: number, py: number) {
  if (!graveImg) { graveImg = new Image(); graveImg.src = '/pokemon/graveyard/stone.png'; }
  if (graveImg.complete && graveImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(graveImg, px, py, SCALED_TILE, SCALED_TILE);
  }
}

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
