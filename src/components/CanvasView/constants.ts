export const CANVAS_STATE_KEY = 'canvas-board-state';

export const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  waiting: 'bg-amber-500',
  idle: 'bg-zinc-500',
  stopped: 'bg-zinc-600',
  error: 'bg-red-500',
  completed: 'bg-cyan-500',
};

export const CHARACTER_EMOJIS: Record<string, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  alien: '👽',
  cat: '🐱',
  dog: '🐕',
  frog: '🐸',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  viking: '🛡️',
};

export const SUPER_AGENT_STATUS_COLORS: Record<string, { dot: string; pulse: boolean }> = {
  running: { dot: 'bg-green-400', pulse: true },
  waiting: { dot: 'bg-amber-400', pulse: true },
  idle: { dot: 'bg-zinc-500', pulse: false },
  completed: { dot: 'bg-cyan-400', pulse: false },
  error: { dot: 'bg-red-400', pulse: false },
};

export const DRAG_THRESHOLD = 5;
