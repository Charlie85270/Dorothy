'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { AgentStatus } from '@/types/electron';
import TerminalPanelHeader from './TerminalPanelHeader';
import FileEditorPanel from './FileEditorPanel';
import type { DockPosition } from './FileEditorPanel';

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

  // Resizable split: file editor ratio (0..1, percentage of container for the editor)
  const [editorRatio, setEditorRatio] = useState(0.5);
  const [dockPosition, setDockPosition] = useState<DockPosition>('top');
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const isVertical = dockPosition === 'top' || dockPosition === 'bottom';

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      let ratio: number;
      if (isVertical) {
        const y = ev.clientY - rect.top;
        ratio = y / rect.height;
      } else {
        const x = ev.clientX - rect.left;
        ratio = x / rect.width;
      }
      // For bottom/right, we invert since editor comes after terminal
      if (dockPosition === 'bottom' || dockPosition === 'right') {
        ratio = 1 - ratio;
      }
      setEditorRatio(Math.min(0.8, Math.max(0.2, ratio)));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isVertical, dockPosition]);

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

      {/* Terminal body + optional file editor — resizable split */}
      <div
        ref={splitContainerRef}
        className={`flex-1 min-h-0 flex overflow-hidden ${openedFile && isVertical ? 'flex-col' : openedFile ? 'flex-row' : 'flex-col'}`}
      >
        {/* Editor before terminal (top or left) */}
        {openedFile && (dockPosition === 'top' || dockPosition === 'left') && (
          <>
            <div
              className="min-h-0 min-w-0 overflow-hidden"
              style={isVertical ? { height: `${editorRatio * 100}%` } : { width: `${editorRatio * 100}%` }}
            >
              <FileEditorPanel
                filePath={openedFile.filePath}
                filename={openedFile.filename}
                content={openedFile.content}
                position={dockPosition}
                onSave={handleSaveFile}
                onClose={handleCloseFile}
                onPositionChange={setDockPosition}
              />
            </div>
            <div
              className={`${isVertical ? 'h-1.5 cursor-row-resize' : 'w-1.5 cursor-col-resize'} bg-border hover:bg-primary/50 flex items-center justify-center shrink-0 transition-colors`}
              onMouseDown={handleResizeStart}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`${isVertical ? 'w-8 h-0.5' : 'h-8 w-0.5'} bg-muted-foreground/30 rounded-full`} />
            </div>
          </>
        )}

        {/* Terminal */}
        <div
          ref={containerRef}
          className="min-h-0 min-w-0 overflow-hidden relative flex-1"
          style={{ backgroundColor: '#1a1a2e' }}
        />

        {/* Editor after terminal (bottom or right) */}
        {openedFile && (dockPosition === 'bottom' || dockPosition === 'right') && (
          <>
            <div
              className={`${isVertical ? 'h-1.5 cursor-row-resize' : 'w-1.5 cursor-col-resize'} bg-border hover:bg-primary/50 flex items-center justify-center shrink-0 transition-colors`}
              onMouseDown={handleResizeStart}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`${isVertical ? 'w-8 h-0.5' : 'h-8 w-0.5'} bg-muted-foreground/30 rounded-full`} />
            </div>
            <div
              className="min-h-0 min-w-0 overflow-hidden"
              style={isVertical ? { height: `${editorRatio * 100}%` } : { width: `${editorRatio * 100}%` }}
            >
              <FileEditorPanel
                filePath={openedFile.filePath}
                filename={openedFile.filename}
                content={openedFile.content}
                position={dockPosition}
                onSave={handleSaveFile}
                onClose={handleCloseFile}
                onPositionChange={setDockPosition}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
