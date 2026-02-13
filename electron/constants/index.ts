import * as path from 'path';
import * as os from 'os';

export const API_PORT = 31415;

export const OLD_DATA_DIR = path.join(os.homedir(), '.claude-manager');
export const DATA_DIR = path.join(os.homedir(), '.dorothy');
export const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
export const APP_SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');
export const KANBAN_FILE = path.join(DATA_DIR, 'kanban-tasks.json');
export const TELEGRAM_DOWNLOADS_DIR = path.join(DATA_DIR, 'telegram-downloads');

export const GITHUB_REPO = 'Charlie85270/dorothy';

export const MIME_TYPES: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

export const TG_CHARACTER_FACES: Record<string, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

export const SLACK_CHARACTER_FACES: Record<string, string> = {
  'robot': ':robot_face:',
  'ninja': ':ninja:',
  'wizard': ':mage:',
  'astronaut': ':astronaut:',
  'knight': ':crossed_swords:',
  'pirate': ':pirate_flag:',
  'alien': ':alien:',
  'viking': ':axe:',
};
