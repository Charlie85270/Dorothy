import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const WORLDS_DIR = path.join(os.homedir(), '.dorothy', 'worlds');

interface WorldHandlerDependencies {
  getMainWindow: () => BrowserWindow | null;
}

function ensureWorldsDir(): void {
  if (!fs.existsSync(WORLDS_DIR)) {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
  }
}

const VALID_TILE_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const VALID_DIRECTIONS = new Set(['down', 'up', 'left', 'right']);
const SPRITE_PATH_RE = /^\/pokemon\/[a-zA-Z0-9_\-\/]+\.(png|jpg)$/;
const DANGEROUS_PATTERNS = ['<script', 'javascript:', 'eval(', 'Function('];

function sanitizeString(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null;
  const trimmed = s.slice(0, maxLen);
  for (const pat of DANGEROUS_PATTERNS) {
    if (trimmed.toLowerCase().includes(pat.toLowerCase())) return null;
  }
  return trimmed;
}

function validateZoneForImport(data: Record<string, unknown>): { valid: boolean; error?: string; zone?: Record<string, any> } {
  // Format check
  if (data.format !== 'dorothy-world-v1') {
    return { valid: false, error: 'Invalid file format' };
  }
  if (!data.zone || typeof data.zone !== 'object') {
    return { valid: false, error: 'Missing zone data' };
  }

  const z = data.zone as Record<string, any>;

  // Validate name and description
  const name = sanitizeString(z.name, 100);
  if (!name) return { valid: false, error: 'Invalid or missing zone name' };

  const description = sanitizeString(z.description, 500);
  if (description === null) return { valid: false, error: 'Invalid zone description' };

  // Dimensions
  const width = z.width;
  const height = z.height;
  if (typeof width !== 'number' || typeof height !== 'number') {
    return { valid: false, error: 'Missing dimensions' };
  }
  if (width < 8 || width > 60 || height < 8 || height > 60) {
    return { valid: false, error: `Dimensions out of range: ${width}x${height} (must be 8-60)` };
  }
  if (width * height > 2500) {
    return { valid: false, error: `Zone too large: ${width}x${height} = ${width * height} tiles (max 2500)` };
  }

  // Tilemap
  if (!Array.isArray(z.tilemap) || z.tilemap.length !== height) {
    return { valid: false, error: `Tilemap must have exactly ${height} rows` };
  }
  for (let row = 0; row < height; row++) {
    if (!Array.isArray(z.tilemap[row]) || z.tilemap[row].length !== width) {
      return { valid: false, error: `Tilemap row ${row} must have exactly ${width} columns` };
    }
    for (let col = 0; col < width; col++) {
      if (!VALID_TILE_IDS.has(z.tilemap[row][col])) {
        return { valid: false, error: `Invalid tile ID ${z.tilemap[row][col]} at (${col}, ${row})` };
      }
    }
  }

  // Player start
  if (!z.playerStart || typeof z.playerStart.x !== 'number' || typeof z.playerStart.y !== 'number') {
    return { valid: false, error: 'Missing player start position' };
  }
  const ps = z.playerStart;
  if (ps.x < 0 || ps.x >= width || ps.y < 0 || ps.y >= height) {
    return { valid: false, error: 'Player start out of bounds' };
  }
  const solidTiles = new Set([1, 7, 9]); // TREE, FENCE, WATER
  if (solidTiles.has(z.tilemap[ps.y][ps.x])) {
    return { valid: false, error: 'Player start is on a solid tile' };
  }

  // Validate sprite paths
  const validateSpritePath = (p: unknown): boolean => {
    if (typeof p !== 'string') return false;
    return SPRITE_PATH_RE.test(p) && !p.includes('..');
  };

  // NPCs
  const npcs = Array.isArray(z.npcs) ? z.npcs : [];
  if (npcs.length > 20) {
    return { valid: false, error: `Too many NPCs: ${npcs.length} (max 20)` };
  }
  for (const npc of npcs) {
    if (typeof npc.x !== 'number' || typeof npc.y !== 'number' ||
        npc.x < 0 || npc.x >= width || npc.y < 0 || npc.y >= height) {
      return { valid: false, error: `NPC "${npc.name}" is out of bounds` };
    }
    if (!VALID_DIRECTIONS.has(npc.direction)) {
      return { valid: false, error: `NPC "${npc.name}" has invalid direction` };
    }
    if (!validateSpritePath(npc.spritePath)) {
      return { valid: false, error: `NPC "${npc.name}" has invalid sprite path` };
    }
    if (!Array.isArray(npc.dialogue) || npc.dialogue.length > 20) {
      return { valid: false, error: `NPC "${npc.name}" has invalid dialogue` };
    }
    for (const line of npc.dialogue) {
      if (typeof line !== 'string' || line.length > 300) {
        return { valid: false, error: `NPC "${npc.name}" has dialogue line exceeding 300 chars` };
      }
      const sanitized = sanitizeString(line, 300);
      if (sanitized === null) {
        return { valid: false, error: `NPC "${npc.name}" has dangerous content in dialogue` };
      }
    }
  }

  // Buildings
  const buildings = Array.isArray(z.buildings) ? z.buildings : [];
  if (buildings.length > 10) {
    return { valid: false, error: `Too many buildings: ${buildings.length} (max 10)` };
  }
  for (const b of buildings) {
    if (typeof b.doorX !== 'number' || typeof b.doorY !== 'number' ||
        b.doorX < 0 || b.doorX >= width || b.doorY < 0 || b.doorY >= height) {
      return { valid: false, error: `Building "${b.label}" has out-of-bounds door` };
    }
    if (typeof b.width !== 'number' || typeof b.height !== 'number' || b.width <= 0 || b.height <= 0) {
      return { valid: false, error: `Building "${b.label}" has invalid dimensions` };
    }
    if (typeof b.spriteFile === 'string' && b.spriteFile && !validateSpritePath(b.spriteFile)) {
      return { valid: false, error: `Building "${b.label}" has invalid sprite path` };
    }
  }

  // Interiors (optional)
  const interiors = Array.isArray(z.interiors) ? z.interiors : [];
  for (const interior of interiors) {
    if (typeof interior.backgroundImage === 'string' && interior.backgroundImage &&
        !validateSpritePath(interior.backgroundImage)) {
      return { valid: false, error: 'Interior has invalid background image path' };
    }
    const interiorNpcs = Array.isArray(interior.npcs) ? interior.npcs : [];
    if (interiorNpcs.length > 20) {
      return { valid: false, error: 'Interior has too many NPCs' };
    }
    for (const npc of interiorNpcs) {
      if (!VALID_DIRECTIONS.has(npc.direction)) {
        return { valid: false, error: `Interior NPC "${npc.name}" has invalid direction` };
      }
      if (!validateSpritePath(npc.spritePath)) {
        return { valid: false, error: `Interior NPC "${npc.name}" has invalid sprite path` };
      }
      if (Array.isArray(npc.dialogue)) {
        for (const line of npc.dialogue) {
          if (typeof line !== 'string' || line.length > 300) {
            return { valid: false, error: `Interior NPC "${npc.name}" has invalid dialogue` };
          }
          if (sanitizeString(line, 300) === null) {
            return { valid: false, error: `Interior NPC "${npc.name}" has dangerous content in dialogue` };
          }
        }
      }
    }
  }

  // Build sanitized zone (whitelist fields only)
  const sanitized: Record<string, any> = {
    id: z.id || crypto.randomUUID(),
    name,
    description: description || '',
    version: typeof z.version === 'number' ? z.version : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    width,
    height,
    tilemap: z.tilemap,
    playerStart: { x: ps.x, y: ps.y },
    signs: Array.isArray(z.signs) ? z.signs.map((s: any) => ({
      x: s.x, y: s.y, text: Array.isArray(s.text) ? s.text.map((t: any) => sanitizeString(t, 300) || '') : [],
    })) : [],
    graves: Array.isArray(z.graves) ? z.graves.map((g: any) => ({
      x: g.x, y: g.y,
      name: sanitizeString(g.name, 100) || '',
      epitaph: sanitizeString(g.epitaph, 300) || '',
    })) : [],
    npcs: npcs.map((n: any) => ({
      id: n.id || crypto.randomUUID(),
      name: sanitizeString(n.name, 100) || 'NPC',
      x: n.x, y: n.y,
      direction: n.direction,
      spritePath: n.spritePath,
      dialogue: n.dialogue.map((d: string) => sanitizeString(d, 300) || ''),
      ...(n.patrol ? { patrol: n.patrol.filter((d: string) => VALID_DIRECTIONS.has(d)) } : {}),
    })),
    buildings: buildings.map((b: any) => ({
      id: b.id || crypto.randomUUID(),
      label: sanitizeString(b.label, 100) || 'Building',
      x: b.x, y: b.y,
      width: b.width, height: b.height,
      doorX: b.doorX, doorY: b.doorY,
      spriteFile: b.spriteFile || '',
      ...(b.closedMessage ? { closedMessage: sanitizeString(b.closedMessage, 300) || undefined } : {}),
    })),
    ...(interiors.length > 0 ? {
      interiors: interiors.map((i: any) => ({
        buildingId: i.buildingId,
        backgroundImage: i.backgroundImage || '',
        npcs: (Array.isArray(i.npcs) ? i.npcs : []).map((n: any) => ({
          id: n.id || crypto.randomUUID(),
          name: sanitizeString(n.name, 100) || 'NPC',
          x: n.x, y: n.y,
          direction: n.direction,
          spritePath: n.spritePath,
          dialogue: Array.isArray(n.dialogue) ? n.dialogue.map((d: string) => sanitizeString(d, 300) || '') : [],
        })),
      })),
    } : {}),
  };

  return { valid: true, zone: sanitized };
}

export function registerWorldHandlers(deps: WorldHandlerDependencies): void {
  const { getMainWindow } = deps;

  // List all zones
  ipcMain.handle('world:listZones', async () => {
    try {
      ensureWorldsDir();
      const files = fs.readdirSync(WORLDS_DIR).filter(f => f.endsWith('.json'));
      const zones: unknown[] = [];

      for (const file of files) {
        try {
          const data = fs.readFileSync(path.join(WORLDS_DIR, file), 'utf-8');
          zones.push(JSON.parse(data));
        } catch {
          continue;
        }
      }

      return { zones };
    } catch (error) {
      return { zones: [], error: String(error) };
    }
  });

  // Get a single zone
  ipcMain.handle('world:getZone', async (_event, zoneId: string) => {
    try {
      const filePath = path.join(WORLDS_DIR, `${zoneId}.json`);
      if (!fs.existsSync(filePath)) {
        return { zone: null };
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return { zone: JSON.parse(data) };
    } catch (error) {
      return { zone: null, error: String(error) };
    }
  });

  // Export a zone as a .dorothy-world file
  ipcMain.handle('world:exportZone', async (_event, params: { zoneId: string; screenshot: string }) => {
    try {
      const { zoneId, screenshot } = params;
      const filePath = path.join(WORLDS_DIR, `${zoneId}.json`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Zone not found' };
      }
      const zoneData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const exportData = {
        format: 'dorothy-world-v1',
        exportedAt: new Date().toISOString(),
        zone: zoneData,
        screenshot,
      };

      const win = getMainWindow();
      if (!win) return { success: false, error: 'No window available' };

      const safeName = (zoneData.name || 'world').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const result = await dialog.showSaveDialog(win, {
        title: 'Export World',
        defaultPath: `${safeName}.dorothy-world`,
        filters: [{ name: 'Dorothy World', extensions: ['dorothy-world'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      fs.writeFileSync(result.filePath, JSON.stringify(exportData));
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Import a .dorothy-world file — returns preview data without saving
  ipcMain.handle('world:importZone', async () => {
    try {
      const win = getMainWindow();
      if (!win) return { success: false, error: 'No window available' };

      const result = await dialog.showOpenDialog(win, {
        title: 'Import World',
        filters: [{ name: 'Dorothy World', extensions: ['dorothy-world'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Import cancelled' };
      }

      const filePath = result.filePaths[0];
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) {
        return { success: false, error: 'File too large (max 5MB)' };
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      const validation = validateZoneForImport(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const zone = validation.zone!;
      const screenshot = typeof data.screenshot === 'string' && data.screenshot.startsWith('data:image/png;base64,')
        ? data.screenshot
        : '';

      const preview = {
        name: zone.name,
        description: zone.description,
        width: zone.width,
        height: zone.height,
        npcCount: zone.npcs?.length || 0,
        buildingCount: zone.buildings?.length || 0,
        screenshot,
      };

      return { success: true, preview, zone };
    } catch (error) {
      return { success: false, error: `Invalid file: ${String(error)}` };
    }
  });

  // Confirm import — re-validate, assign new ID, save to worlds dir
  ipcMain.handle('world:confirmImport', async (_event, zone: Record<string, unknown>) => {
    try {
      // Re-validate (defense in depth)
      const wrapper = { format: 'dorothy-world-v1', zone, screenshot: 'data:image/png;base64,' };
      const validation = validateZoneForImport(wrapper);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const sanitized = validation.zone!;

      // Generate new ID and reset timestamps
      const newId = crypto.randomUUID();
      sanitized.id = newId;
      const now = new Date().toISOString();
      sanitized.createdAt = now;
      sanitized.updatedAt = now;

      // Remap building/interior cross-references with new IDs
      const buildingIdMap = new Map<string, string>();
      if (sanitized.buildings) {
        for (const building of sanitized.buildings) {
          const oldId = building.id;
          const newBuildingId = crypto.randomUUID();
          buildingIdMap.set(oldId, newBuildingId);
          building.id = newBuildingId;
        }
      }
      if (sanitized.interiors) {
        for (const interior of sanitized.interiors) {
          const mapped = buildingIdMap.get(interior.buildingId);
          if (mapped) interior.buildingId = mapped;
        }
      }

      // Reassign NPC IDs
      if (sanitized.npcs) {
        for (const npc of sanitized.npcs) {
          npc.id = crypto.randomUUID();
        }
      }
      if (sanitized.interiors) {
        for (const interior of sanitized.interiors) {
          if (interior.npcs) {
            for (const npc of interior.npcs) {
              npc.id = crypto.randomUUID();
            }
          }
        }
      }

      ensureWorldsDir();
      const filePath = path.join(WORLDS_DIR, `${newId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2));

      return { success: true, zoneId: newId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Delete a zone
  ipcMain.handle('world:deleteZone', async (_event, zoneId: string) => {
    try {
      if (!zoneId || typeof zoneId !== 'string') {
        return { success: false, error: 'Invalid zone ID' };
      }
      // Sanitize: only allow UUID-shaped IDs to prevent path traversal
      if (!/^[a-f0-9\-]+$/i.test(zoneId)) {
        return { success: false, error: 'Invalid zone ID format' };
      }
      const filePath = path.join(WORLDS_DIR, `${zoneId}.json`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Zone not found' };
      }
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Watch for file changes in the worlds directory
  ensureWorldsDir();

  let debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  const watcher = fs.watch(WORLDS_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.json')) return;

    // Debounce rapid file changes (e.g. multiple writes)
    const existing = debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      const filePath = path.join(WORLDS_DIR, filename);
      const win = getMainWindow();
      if (!win) return;

      if (fs.existsSync(filePath)) {
        try {
          const data = fs.readFileSync(filePath, 'utf-8');
          const zone = JSON.parse(data);
          win.webContents.send('world:zoneUpdated', zone);
        } catch {
          // Ignore parse errors (file may be partially written)
        }
      } else {
        // File was deleted
        const zoneId = filename.replace('.json', '');
        win.webContents.send('world:zoneDeleted', { id: zoneId });
      }
    }, 200));
  });

  // Clean up watcher when app closes
  app.on('will-quit', () => {
    watcher.close();
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
  });
}
