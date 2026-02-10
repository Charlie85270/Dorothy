'use client';

import {
  Play,
  Square,
  RotateCcw,
  Maximize2,
  Copy,
} from 'lucide-react';
import type { ContextMenuState } from '../types';
import type { AgentStatus } from '@/types/electron';

interface ContextMenuProps {
  state: ContextMenuState;
  agent: AgentStatus | null;
  onClose: () => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onClear: (agentId: string) => void;
  onFullscreen: (agentId: string) => void;
  onCopyOutput: (agentId: string) => void;
}

export default function ContextMenu({
  state,
  agent,
  onClose,
  onStart,
  onStop,
  onClear,
  onFullscreen,
  onCopyOutput,
}: ContextMenuProps) {
  if (!state.open || !state.agentId || !agent) return null;

  const agentId = state.agentId;
  const isRunning = agent.status === 'running' || agent.status === 'waiting';

  const items = [
    {
      icon: isRunning ? Square : Play,
      label: isRunning ? 'Stop Agent' : 'Start Agent',
      action: () => isRunning ? onStop(agentId) : onStart(agentId),
      danger: isRunning,
    },
    { icon: RotateCcw, label: 'Clear Terminal', action: () => onClear(agentId) },
    { icon: Maximize2, label: 'Fullscreen', action: () => onFullscreen(agentId) },
    { icon: Copy, label: 'Copy Output', action: () => onCopyOutput(agentId) },
  ];

  const x = Math.min(state.x, window.innerWidth - 200);
  const y = Math.min(state.y, window.innerHeight - items.length * 36 - 20);

  return (
    <div
      className="fixed z-[100] bg-card border border-border shadow-xl min-w-[180px] py-1"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className={`
            flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors
            ${item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }
          `}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
