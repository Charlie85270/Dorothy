'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { AgentStatus } from '@/types/electron';
import TerminalPanelHeader from './TerminalPanelHeader';

interface TerminalPanelProps {
  agent: AgentStatus;
  isFullscreen: boolean;
  isBroadcasting: boolean;
  isFocused: boolean;
  tabType: 'custom' | 'project';
  onRegisterContainer: (agentId: string, container: HTMLDivElement | null) => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onRemove: (agentId: string) => void;
  onClear: (agentId: string) => void;
  onFullscreen: (agentId: string) => void;
  onExitFullscreen: () => void;
  onFocus: (agentId: string) => void;
  onContextMenu: (e: React.MouseEvent, agentId: string) => void;
}

export default function TerminalPanel({
  agent,
  isFullscreen,
  isBroadcasting,
  isFocused,
  tabType,
  onRegisterContainer,
  onStart,
  onStop,
  onRemove,
  onClear,
  onFullscreen,
  onExitFullscreen,
  onFocus,
  onContextMenu,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registeredRef = useRef(false);

  // Make this panel a drop target for skills
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `panel-${agent.id}`,
    data: { type: 'terminal-panel', agentId: agent.id },
  });

  // Register container for xterm mounting
  useEffect(() => {
    if (containerRef.current && !registeredRef.current) {
      registeredRef.current = true;
      onRegisterContainer(agent.id, containerRef.current);
    }
    return () => {
      registeredRef.current = false;
    };
  }, [agent.id, onRegisterContainer]);

  const handleClick = useCallback(() => {
    onFocus(agent.id);
  }, [agent.id, onFocus]);

  const handleStart = useCallback(() => onStart(agent.id), [agent.id, onStart]);
  const handleStop = useCallback(() => onStop(agent.id), [agent.id, onStop]);
  const handleRemove = useCallback(() => onRemove(agent.id), [agent.id, onRemove]);
  const handleClear = useCallback(() => onClear(agent.id), [agent.id, onClear]);
  const handleFullscreen = useCallback(() => onFullscreen(agent.id), [agent.id, onFullscreen]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => onContextMenu(e, agent.id), [agent.id, onContextMenu]);

  return (
    <div
      ref={setDropRef}
      className={`
        flex flex-col overflow-hidden border h-full
        ${isOver ? 'border-purple-500/70 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : isFocused ? 'border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]' : 'border-white/10'}
        ${isFullscreen ? 'fixed inset-0 z-50' : ''}
      `}
      style={{ backgroundColor: '#1a1a2e' }}
      onClick={handleClick}
    >
      {/* Header */}
      <TerminalPanelHeader
        agent={agent}
        isFullscreen={isFullscreen}
        isBroadcasting={isBroadcasting}
        tabType={tabType}
        onStart={handleStart}
        onStop={handleStop}
        onFullscreen={handleFullscreen}
        onExitFullscreen={onExitFullscreen}
        onClear={handleClear}
        onRemove={handleRemove}
        onContextMenu={handleContextMenu}
      />

      {/* Terminal body */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden relative"
        style={{ backgroundColor: '#1a1a2e' }}
      />
    </div>
  );
}
