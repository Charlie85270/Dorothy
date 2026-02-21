import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { GenerativeZone } from "../types.js";

const WORLDS_DIR = path.join(os.homedir(), ".dorothy", "worlds");

// Tile IDs
const TILE = {
  GRASS: 0, TREE: 1, PATH: 2, TALL_GRASS: 3, BUILDING: 4,
  DOOR: 5, FLOWER: 6, FENCE: 7, SIGN: 8, WATER: 9,
  ROUTE_EXIT: 10, GRAVE: 11,
} as const;

function ensureWorldsDir(): void {
  if (!fs.existsSync(WORLDS_DIR)) {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
  }
}

function loadZone(zoneId: string): GenerativeZone | null {
  const filePath = path.join(WORLDS_DIR, `${zoneId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function saveZone(zone: GenerativeZone): void {
  ensureWorldsDir();
  fs.writeFileSync(
    path.join(WORLDS_DIR, `${zone.id}.json`),
    JSON.stringify(zone, null, 2)
  );
}

/**
 * Auto-stamp object tiles into the tilemap based on structured arrays.
 * The LLM only needs to set terrain tiles; buildings, signs, graves, and doors
 * are stamped automatically from the structured data.
 */
function stampObjectTiles(zone: GenerativeZone): void {
  // Stamp buildings
  for (const b of zone.buildings) {
    for (let row = b.y; row < b.y + b.height; row++) {
      for (let col = b.x; col < b.x + b.width; col++) {
        if (row >= 0 && row < zone.height && col >= 0 && col < zone.width) {
          zone.tilemap[row][col] = TILE.BUILDING;
        }
      }
    }
    // Stamp door
    if (b.doorY >= 0 && b.doorY < zone.height && b.doorX >= 0 && b.doorX < zone.width) {
      zone.tilemap[b.doorY][b.doorX] = TILE.DOOR;
    }
  }

  // Stamp signs
  for (const s of zone.signs) {
    if (s.y >= 0 && s.y < zone.height && s.x >= 0 && s.x < zone.width) {
      zone.tilemap[s.y][s.x] = TILE.SIGN;
    }
  }

  // Stamp graves
  for (const g of zone.graves) {
    if (g.y >= 0 && g.y < zone.height && g.x >= 0 && g.x < zone.width) {
      zone.tilemap[g.y][g.x] = TILE.GRAVE;
    }
  }
}

function validateZone(zone: GenerativeZone): string | null {
  if (zone.width < 8 || zone.width > 60) return `Width must be 8-60, got ${zone.width}`;
  if (zone.height < 8 || zone.height > 60) return `Height must be 8-60, got ${zone.height}`;
  if (zone.width * zone.height > 2500) return `Total tiles (${zone.width * zone.height}) exceeds 2500 limit for performance`;
  if (zone.tilemap.length !== zone.height) return `Tilemap has ${zone.tilemap.length} rows, expected ${zone.height}`;
  for (let r = 0; r < zone.tilemap.length; r++) {
    if (zone.tilemap[r].length !== zone.width) {
      return `Tilemap row ${r} has ${zone.tilemap[r].length} cols, expected ${zone.width}`;
    }
  }

  // Verify playerStart is within bounds and not on a solid tile
  const { x, y } = zone.playerStart;
  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) {
    return `playerStart (${x},${y}) is out of bounds`;
  }

  // Check at least one ROUTE_EXIT exists
  let hasExit = false;
  for (let r = 0; r < zone.height; r++) {
    for (let c = 0; c < zone.width; c++) {
      if (zone.tilemap[r][c] === TILE.ROUTE_EXIT) {
        hasExit = true;
        break;
      }
    }
    if (hasExit) break;
  }
  if (!hasExit) return "Zone must have at least one ROUTE_EXIT (tile 10) so the player can leave";

  return null;
}

// Load the sprite catalog from the app's public directory
function loadSpriteCatalog(): Record<string, unknown> | null {
  // Try multiple paths to find sprites.json
  const resourcesPath = (process as unknown as Record<string, string>).resourcesPath || "";
  const candidates = [
    path.join(resourcesPath, "app.asar.unpacked", "out", "pokemon", "sprites.json"),
    path.join(process.cwd(), "public", "pokemon", "sprites.json"),
    path.join(os.homedir(), ".dorothy", "sprites.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    } catch {
      continue;
    }
  }
  return null;
}

const npcSchema = z.object({
  id: z.string().describe("Unique NPC identifier"),
  name: z.string().describe("Display name shown in dialogue"),
  x: z.number().int().describe("Tile X position"),
  y: z.number().int().describe("Tile Y position"),
  direction: z.enum(["down", "up", "left", "right"]).describe("Facing direction"),
  spritePath: z.string().describe("Sprite path, e.g. /pokemon/pnj/vibe-coder.png"),
  dialogue: z.array(z.string()).describe("Array of dialogue lines shown when interacted"),
  patrol: z.array(z.enum(["down", "up", "left", "right"])).optional().describe("Repeating patrol pattern"),
});

const buildingSchema = z.object({
  id: z.string().describe("Unique building identifier"),
  label: z.string().describe("Display label above the building"),
  x: z.number().int().describe("Top-left tile X"),
  y: z.number().int().describe("Top-left tile Y"),
  width: z.number().int().min(2).max(6).describe("Width in tiles"),
  height: z.number().int().min(2).max(5).describe("Height in tiles"),
  doorX: z.number().int().describe("Door tile X (must be within or adjacent to building)"),
  doorY: z.number().int().describe("Door tile Y (typically building.y + building.height)"),
  spriteFile: z.string().describe("Building sprite path, e.g. /pokemon/house/sprite_3.png"),
  closedMessage: z.string().optional().describe("Message when player tries to enter"),
});

const signSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  text: z.array(z.string()).describe("Lines of text shown when reading the sign"),
});

const graveSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  name: z.string().describe("Name on the gravestone"),
  epitaph: z.string().describe("Epitaph text"),
});

const interiorNpcSchema = z.object({
  id: z.string().describe("Unique NPC identifier within the interior"),
  name: z.string().describe("Display name shown in dialogue"),
  x: z.number().int().min(0).max(9).describe("X position (0-9) within 10-wide room"),
  y: z.number().int().min(0).max(6).describe("Y position (0-6) within room (row 7 is exit)"),
  direction: z.enum(["down", "up", "left", "right"]).describe("Facing direction"),
  spritePath: z.string().describe("Sprite path, e.g. /pokemon/pnj/trainer_SAGE.png"),
  dialogue: z.array(z.string()).describe("Dialogue lines shown when interacted"),
});

const interiorSchema = z.object({
  buildingId: z.string().describe("Must match a building ID from the buildings array"),
  backgroundImage: z.string().describe("Background image path, e.g. /pokemon/interior/sprite_3.png"),
  npcs: z.array(interiorNpcSchema).optional().describe("NPCs inside the building"),
});

export function registerZoneTools(server: McpServer): void {
  // ── create_zone ──────────────────────────────────────────────────────────
  server.tool(
    "create_zone",
    `Create or replace a full game zone. The zone appears in Dorothy's Pokemon-style game world.

TILE LEGEND (use these numbers in the tilemap):
  0=GRASS (walkable), 1=TREE (solid border/obstacle), 2=PATH (walkable),
  3=TALL_GRASS (walkable, visual effect), 6=FLOWER (walkable decoration),
  7=FENCE (solid barrier), 9=WATER (impassable), 10=ROUTE_EXIT (player leaves zone)

DO NOT place tile 4 (BUILDING), 5 (DOOR), 8 (SIGN), or 11 (GRAVE) in the tilemap — these are auto-stamped from the buildings/signs/graves arrays.

IMPORTANT: Place ROUTE_EXIT (10) tiles at map edges so the player can leave.

Recommended map size: 24x20 (width x height).

IMPORTANT: All sprite paths must have NO SPACES and NO PARENTHESES. Call list_sprites to get exact paths.

AVAILABLE NPC SPRITES (128x192 sprite sheets, 4-direction):
  Named: /pokemon/pnj/prof.png, sailor.png, vibe-coder.png, explorer.png, officier.png,
    rocker.png, twin.png, girld.png, boy.png, draco.png, leader.png, coinbase-brian.png
  Trainers: /pokemon/pnj/trainer_SAGE.png, trainer_SCIENTIST.png, trainer_GENTLEMAN.png,
    trainer_HIKER.png, trainer_BURGLAR.png, trainer_MEDIUM.png, trainer_BEAUTY.png,
    trainer_FISHERMAN.png, trainer_SUPERNERD.png, trainer_PSYCHIC_M.png, + 30 more
  Anime: /pokemon/pnj/anime-brock.png, anime-misty.png, anime-npc-01.png through anime-npc-47.png
  Generic: /pokemon/pnj/NPC_Shopkeeper.png, NPC_YoungMan.png, NPC_Nurse.png, + more

AVAILABLE BUILDING SPRITES:
  /pokemon/house/sprite_1.png (small), /pokemon/house/sprite_3.png (medium),
  /pokemon/house/sprite_4.png (large), /pokemon/house/stone.png (stone),
  /pokemon/house/vercel.png (modern tech)

BUILDING INTERIORS (optional):
  Each building can have an enterable interior via the "interiors" array.
  Interiors are 10x8 rooms with a background image and optional NPCs.
  The player exits by walking to the bottom row (y=7).
  NPC positions: x 0-9, y 0-6 (y 7 is the exit row).
  Available interior backgrounds: /pokemon/interior/sprite_3.png, sprite_7.png, etc.`,
    {
      id: z.string().regex(/^[a-z0-9-]+$/).describe("Zone ID (lowercase, hyphens only)"),
      name: z.string().describe("Display name, e.g. 'Crypto Crash City'"),
      description: z.string().describe("Description shown on zone entry"),
      width: z.number().int().min(8).max(60).describe("Map width in tiles (8-60). Total width*height must be <= 2500."),
      height: z.number().int().min(8).max(60).describe("Map height in tiles (8-60). Total width*height must be <= 2500."),
      tilemap: z.array(z.array(z.number().int().min(0).max(11)))
        .describe("2D array [row][col] of tile IDs. Must match height x width. Only use terrain tiles (0,1,2,3,6,7,9,10)."),
      playerStart: z.object({ x: z.number().int(), y: z.number().int() })
        .describe("Player spawn position"),
      npcs: z.array(npcSchema).optional().describe("NPCs in the zone"),
      buildings: z.array(buildingSchema).optional().describe("Buildings in the zone"),
      signs: z.array(signSchema).optional().describe("Signs in the zone"),
      graves: z.array(graveSchema).optional().describe("Graves in the zone"),
      interiors: z.array(interiorSchema).optional().describe("Building interiors (10x8 rooms). Each must reference a building ID."),
    },
    async (input) => {
      try {
        const now = new Date().toISOString();
        const existing = loadZone(input.id);

        const zone: GenerativeZone = {
          id: input.id,
          name: input.name,
          description: input.description,
          version: existing ? existing.version + 1 : 1,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          width: input.width,
          height: input.height,
          tilemap: input.tilemap,
          playerStart: input.playerStart,
          npcs: input.npcs || [],
          buildings: input.buildings || [],
          signs: input.signs || [],
          graves: input.graves || [],
          interiors: input.interiors?.map(i => ({
            ...i,
            npcs: i.npcs || [],
          })),
        };

        // Auto-stamp object tiles
        stampObjectTiles(zone);

        // Validate
        const error = validateZone(zone);
        if (error) {
          return {
            content: [{ type: "text" as const, text: `Validation error: ${error}` }],
            isError: true,
          };
        }

        saveZone(zone);

        return {
          content: [{
            type: "text" as const,
            text: `Zone "${zone.name}" (${zone.id}) ${existing ? 'updated to v' + zone.version : 'created'}. ${zone.width}x${zone.height} tiles, ${zone.npcs.length} NPCs, ${zone.buildings.length} buildings, ${zone.signs.length} signs, ${zone.graves.length} graves.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── update_zone_npcs ─────────────────────────────────────────────────────
  server.tool(
    "update_zone_npcs",
    "Hot-swap the NPC list in an existing zone. Player position is preserved. Use this to update dialogue or add/remove NPCs without recreating the entire zone.",
    {
      zone_id: z.string().describe("The zone ID to update"),
      npcs: z.array(npcSchema).describe("Complete replacement NPC list"),
    },
    async (input) => {
      try {
        const zone = loadZone(input.zone_id);
        if (!zone) {
          return {
            content: [{ type: "text" as const, text: `Zone "${input.zone_id}" not found` }],
            isError: true,
          };
        }

        zone.npcs = input.npcs;
        zone.version += 1;
        zone.updatedAt = new Date().toISOString();
        saveZone(zone);

        return {
          content: [{
            type: "text" as const,
            text: `Updated NPCs in "${zone.name}": ${zone.npcs.length} NPCs (v${zone.version})`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── update_zone_signs ────────────────────────────────────────────────────
  server.tool(
    "update_zone_signs",
    "Hot-swap signs and graves in an existing zone without recreating it.",
    {
      zone_id: z.string().describe("The zone ID to update"),
      signs: z.array(signSchema).optional().describe("Replacement signs list"),
      graves: z.array(graveSchema).optional().describe("Replacement graves list"),
    },
    async (input) => {
      try {
        const zone = loadZone(input.zone_id);
        if (!zone) {
          return {
            content: [{ type: "text" as const, text: `Zone "${input.zone_id}" not found` }],
            isError: true,
          };
        }

        if (input.signs !== undefined) zone.signs = input.signs;
        if (input.graves !== undefined) zone.graves = input.graves;

        // Re-stamp object tiles (signs/graves changed)
        // First clear old sign/grave tiles back to grass
        for (let r = 0; r < zone.height; r++) {
          for (let c = 0; c < zone.width; c++) {
            if (zone.tilemap[r][c] === TILE.SIGN || zone.tilemap[r][c] === TILE.GRAVE) {
              zone.tilemap[r][c] = TILE.GRASS;
            }
          }
        }
        stampObjectTiles(zone);

        zone.version += 1;
        zone.updatedAt = new Date().toISOString();
        saveZone(zone);

        return {
          content: [{
            type: "text" as const,
            text: `Updated signs/graves in "${zone.name}": ${zone.signs.length} signs, ${zone.graves.length} graves (v${zone.version})`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── list_zones ───────────────────────────────────────────────────────────
  server.tool(
    "list_zones",
    "List all available game zones with their ID, name, and last update time.",
    {},
    async () => {
      try {
        ensureWorldsDir();
        const files = fs.readdirSync(WORLDS_DIR).filter(f => f.endsWith(".json"));
        const zones: Array<{ id: string; name: string; updatedAt: string; version: number }> = [];

        for (const file of files) {
          try {
            const zone: GenerativeZone = JSON.parse(
              fs.readFileSync(path.join(WORLDS_DIR, file), "utf-8")
            );
            zones.push({
              id: zone.id,
              name: zone.name,
              updatedAt: zone.updatedAt,
              version: zone.version,
            });
          } catch {
            continue;
          }
        }

        if (zones.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No zones found. Use create_zone to create one." }],
          };
        }

        const list = zones
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map(z => `- ${z.name} (${z.id}) v${z.version} — updated ${z.updatedAt}`)
          .join("\n");

        return {
          content: [{ type: "text" as const, text: `${zones.length} zone(s):\n${list}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── delete_zone ──────────────────────────────────────────────────────────
  server.tool(
    "delete_zone",
    "Delete a game zone by its ID.",
    {
      zone_id: z.string().describe("The zone ID to delete"),
    },
    async (input) => {
      try {
        const filePath = path.join(WORLDS_DIR, `${input.zone_id}.json`);
        if (!fs.existsSync(filePath)) {
          return {
            content: [{ type: "text" as const, text: `Zone "${input.zone_id}" not found` }],
            isError: true,
          };
        }

        fs.unlinkSync(filePath);

        return {
          content: [{ type: "text" as const, text: `Zone "${input.zone_id}" deleted.` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── list_sprites ─────────────────────────────────────────────────────────
  server.tool(
    "list_sprites",
    "Return the full sprite catalog organized by category (npcs, buildings, trees, decorations, pokemon). Use this to discover available sprites before building a zone.",
    {},
    async () => {
      try {
        const catalog = loadSpriteCatalog();
        if (catalog) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(catalog, null, 2) }],
          };
        }

        // Fallback: return embedded catalog
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              npcs: [
                { id: "prof", path: "/pokemon/pnj/prof.png" },
                { id: "sailor", path: "/pokemon/pnj/sailor.png" },
                { id: "vibe-coder", path: "/pokemon/pnj/vibe-coder.png" },
                { id: "explorer", path: "/pokemon/pnj/explorer.png" },
                { id: "officier", path: "/pokemon/pnj/officier.png" },
                { id: "rocker", path: "/pokemon/pnj/rocker.png" },
                { id: "twin", path: "/pokemon/pnj/twin.png" },
                { id: "girld", path: "/pokemon/pnj/girld.png" },
                { id: "boy", path: "/pokemon/pnj/boy.png" },
                { id: "draco", path: "/pokemon/pnj/draco.png" },
                { id: "leader", path: "/pokemon/pnj/leader.png" },
                { id: "coinbase-brian", path: "/pokemon/pnj/coinbase-brian.png" },
              ],
              buildings: [
                { id: "house-1", path: "/pokemon/house/sprite_1.png" },
                { id: "house-2", path: "/pokemon/house/sprite_3.png" },
                { id: "house-3", path: "/pokemon/house/sprite_4.png" },
                { id: "house-stone", path: "/pokemon/house/stone.png" },
                { id: "house-vercel", path: "/pokemon/house/vercel.png" },
              ],
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
