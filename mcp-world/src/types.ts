export interface GenerativeZone {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  width: number;
  height: number;
  tilemap: number[][];

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
