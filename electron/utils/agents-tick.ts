import * as path from 'path';
import { agents } from '../core/agent-manager';
import { broadcastToAllWindows } from './broadcast';
import { extractStatusLine } from './ansi';
import { ptyProcesses } from '../core/pty-manager';
import type { AgentStatus } from '../types';

export type DisplayStatus = 'working' | 'waiting' | 'done' | 'ready' | 'stopped' | 'error';

export interface AgentTickItem {
  id: string;
  name: string;
  character: string;
  status: AgentStatus['status'];
  displayStatus: DisplayStatus;
  statusLine: string;
  currentTask: string;
  projectName: string;
  lastActivity: string;
  provider: string;
}

let tickTimer: ReturnType<typeof setTimeout> | null = null;

// Callback set by tray-manager for attention badge updates
let trayAttentionCallback: ((hasWaiting: boolean) => void) | null = null;

export function setTrayAttentionCallback(cb: (hasWaiting: boolean) => void): void {
  trayAttentionCallback = cb;
}

export function scheduleTick(): void {
  if (tickTimer) return;
  tickTimer = setTimeout(() => {
    tickTimer = null;
    const payload = buildTickPayload();
    const statuses = payload.map(a => `${a.name}:${a.displayStatus}`).join(', ');
    console.log(`[tick] Broadcasting ${payload.length} agents: ${statuses}`);
    broadcastToAllWindows('agents:tick', payload);

    // Update tray attention badge
    if (trayAttentionCallback) {
      const hasWaiting = payload.some(a => a.displayStatus === 'waiting');
      trayAttentionCallback(hasWaiting);
    }
  }, 500);
}

function deriveDisplayStatus(a: AgentStatus): DisplayStatus {
  if (a.status === 'running') return 'working';
  if (a.status === 'waiting') return 'waiting';
  if (a.status === 'completed') return 'done';
  if (a.status === 'error') return 'error';
  // idle: check if PTY exists
  if (a.ptyId && ptyProcesses.has(a.ptyId)) return 'ready';
  return 'stopped';
}

function buildTickPayload(): AgentTickItem[] {
  return Array.from(agents.values())
    .map(a => ({
      id: a.id,
      name: a.name || `Agent ${a.id.slice(0, 6)}`,
      character: a.character || 'robot',
      status: a.status,
      displayStatus: deriveDisplayStatus(a),
      statusLine: (a as AgentStatus & { statusLine?: string }).statusLine || '',
      currentTask: a.currentTask || '',
      projectName: a.projectPath ? path.basename(a.projectPath) : '',
      lastActivity: a.lastActivity,
      provider: a.provider || 'claude',
    }))
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}
