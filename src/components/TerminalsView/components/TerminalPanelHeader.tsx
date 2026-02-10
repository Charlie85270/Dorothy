'use client';

import {
  Play,
  Square,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  GripVertical,
  ShieldOff,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { CHARACTER_FACES, STATUS_COLORS } from '../constants';

interface TerminalPanelHeaderProps {
  agent: AgentStatus;
  isFullscreen: boolean;
  isBroadcasting: boolean;
  tabType: 'custom' | 'project';
  onStart: () => void;
  onStop: () => void;
  onFullscreen: () => void;
  onExitFullscreen: () => void;
  onClear: () => void;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function TerminalPanelHeader({
  agent,
  isFullscreen,
  isBroadcasting,
  tabType,
  onStart,
  onStop,
  onFullscreen,
  onExitFullscreen,
  onClear,
  onRemove,
  onContextMenu,
}: TerminalPanelHeaderProps) {
  const emoji = agent.name?.toLowerCase() === 'bitwonka'
    ? '🐸'
    : CHARACTER_FACES[agent.character || 'robot'] || '🤖';
  const name = agent.name || `Agent ${agent.id.slice(0, 6)}`;
  const projectName = agent.projectPath.split('/').pop() || '';
  const status = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;

  const showDragHandle = tabType === 'custom';
  const showRemoveButton = tabType === 'custom';

  return (
    <div
      className={`${showDragHandle ? 'terminal-drag-handle' : ''} flex items-center gap-2 px-3 py-1.5 bg-[#12121e] border-b border-white/10 select-none`}
      onContextMenu={onContextMenu}
    >
      {/* Drag handle grip — custom tabs only */}
      {showDragHandle && (
        <GripVertical className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
      )}

      {/* Agent identity */}
      <span className="text-base">{emoji}</span>
      <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{name}</span>

      {/* Status badge */}
      <span className={`text-[10px] px-1.5 py-0.5 font-medium ${status.bg} ${status.text}`}>
        {agent.status}
      </span>

      {/* Project name */}
      <span className="text-[10px] text-muted-foreground truncate max-w-[100px] hidden lg:inline">
        {projectName}
      </span>

      {/* Broadcast indicator */}
      {isBroadcasting && (
        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 font-medium animate-pulse">
          BROADCAST
        </span>
      )}

      {/* Skip permissions indicator */}
      {agent.skipPermissions && (
        <span title="Bypass permissions enabled">
          <ShieldOff className="w-3 h-3 text-yellow-400" />
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session ID (truncated) */}
      <span className="text-[10px] text-muted-foreground font-mono hidden xl:inline">
        {agent.id.slice(0, 8)}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5" onMouseDown={e => e.stopPropagation()}>
        {agent.status === 'running' || agent.status === 'waiting' ? (
          <button
            onClick={onStop}
            className="p-1 hover:bg-white/10 transition-colors text-red-400 hover:text-red-300"
            title="Stop agent"
          >
            <Square className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={onStart}
            className="p-1 hover:bg-white/10 transition-colors text-green-400 hover:text-green-300"
            title="Start agent"
          >
            <Play className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={onClear}
          className="p-1 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          title="Clear terminal"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        <button
          onClick={isFullscreen ? onExitFullscreen : onFullscreen}
          className="p-1 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>

        {/* Remove button — custom tabs only */}
        {showRemoveButton && !isFullscreen && (
          <button
            onClick={onRemove}
            className="p-1 hover:bg-white/10 transition-colors text-muted-foreground hover:text-red-400"
            title="Remove from tab"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
