export interface GenerativeZone {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  width: number;   // 8-60 (width*height <= 2500)
  height: number;  // 8-60 (width*height <= 2500)
  tilemap: number[][]; // [row][col], tile IDs:
  //   0=GRASS, 1=TREE(solid), 2=PATH, 3=TALL_GRASS, 6=FLOWER,
  //   7=FENCE(solid), 8=SIGN, 9=WATER(solid), 10=ROUTE_EXIT, 11=GRAVE

  playerStart: { x: number; y: number };

  signs: Array<{ x: number; y: number; text: string[] }>;
  graves: Array<{ x: number; y: number; name: string; epitaph: string }>;

  npcs: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    direction: 'down' | 'up' | 'left' | 'right';
    spritePath: string;
    dialogue: string[];
    patrol?: Array<'down' | 'up' | 'left' | 'right'>;
  }>;

  buildings: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    doorX: number;
    doorY: number;
    spriteFile: string;
    closedMessage?: string;
  }>;

  interiors?: Array<{
    buildingId: string;
    backgroundImage: string;
    npcs: Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      direction: 'down' | 'up' | 'left' | 'right';
      spritePath: string;
      dialogue: string[];
    }>;
  }>;
}
