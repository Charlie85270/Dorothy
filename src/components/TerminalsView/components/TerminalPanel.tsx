'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { AgentStatus } from '@/types/electron';
import TerminalPanelHeader from './TerminalPanelHeader';
import FileEditorPanel from './FileEditorPanel';

export interface OpenedFile {
  filePath: string;
  filename: string;
  content: string;
}

interface TerminalPanelProps {
  agent: AgentStatus;
  isFullscreen: boolean;
  isBroadcasting: boolean;
  isFocused: boolean;
  tabType: 'custom' | 'project';
  openedFile?: OpenedFile | null;
  onRegisterContainer: (agentId: string, container: HTMLDivElement | null) => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onRemove: (agentId: string) => void;
  onClear: (agentId: string) => void;
  onFullscreen: (agentId: string) => void;
  onExitFullscreen: () => void;
  onFocus: (agentId: string) => void;
  onContextMenu: (e: React.MouseEvent, agentId: string) => void;
  onOpenFile: (agentId: string) => void;
  onCloseFile: (agentId: string) => void;
  onSaveFile: (agentId: string, content: string) => void;
}

export default function TerminalPanel({
  agent,
  isFullscreen,
  isBroadcasting,
  isFocused,
  tabType,
  openedFile,
  onRegisterContainer,
  onStart,
  onStop,
  onRemove,
  onClear,
  onFullscreen,
  onExitFullscreen,
  onFocus,
  onContextMenu,
  onOpenFile,
  onCloseFile,
  onSaveFile,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onRegisterRef = useRef(onRegisterContainer);
  onRegisterRef.current = onRegisterContainer;

  // Make this panel a drop target for skills
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `panel-${agent.id}`,
    data: { type: 'terminal-panel', agentId: agent.id },
  });

  // Register container for xterm mounting — only on mount or agent ID change.
  // Uses a ref for the callback to avoid re-registering when the parent
  // re-creates the callback (e.g. on agents poll or font size change).
  useEffect(() => {
    if (containerRef.current) {
      onRegisterRef.current(agent.id, containerRef.current);
    }
  }, [agent.id]);

  const handleClick = useCallback(() => {
    onFocus(agent.id);
  }, [agent.id, onFocus]);

  const handleStart = useCallback(() => onStart(agent.id), [agent.id, onStart]);
  const handleStop = useCallback(() => onStop(agent.id), [agent.id, onStop]);
  const handleRemove = useCallback(() => onRemove(agent.id), [agent.id, onRemove]);
  const handleClear = useCallback(() => onClear(agent.id), [agent.id, onClear]);
  const handleFullscreen = useCallback(() => onFullscreen(agent.id), [agent.id, onFullscreen]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => onContextMenu(e, agent.id), [agent.id, onContextMenu]);
  const handleOpenFile = useCallback(() => onOpenFile(agent.id), [agent.id, onOpenFile]);
  const handleCloseFile = useCallback(() => onCloseFile(agent.id), [agent.id, onCloseFile]);
  const handleSaveFile = useCallback((content: string) => onSaveFile(agent.id, content), [agent.id, onSaveFile]);

  return (
    <div
      ref={setDropRef}
      className={`
        flex flex-col overflow-hidden h-full
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
        hasOpenFile={!!openedFile}
        onStart={handleStart}
        onStop={handleStop}
        onFullscreen={handleFullscreen}
        onExitFullscreen={onExitFullscreen}
        onClear={handleClear}
        onRemove={handleRemove}
        onContextMenu={handleContextMenu}
        onOpenFile={handleOpenFile}
      />

      {/* Terminal body + optional file editor — vertical stack */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {openedFile && (
          <div className="h-1/2 min-h-0 overflow-hidden">
            <FileEditorPanel
              filePath={openedFile.filePath}
              filename={openedFile.filename}
              content={openedFile.content}
              onSave={handleSaveFile}
              onClose={handleCloseFile}
            />
          </div>
        )}
        <div
          ref={containerRef}
          className={`min-h-0 overflow-hidden relative ${openedFile ? 'h-1/2' : 'flex-1'}`}
          style={{ backgroundColor: '#1a1a2e' }}
        />
      </div>
    </div>
  );
}
