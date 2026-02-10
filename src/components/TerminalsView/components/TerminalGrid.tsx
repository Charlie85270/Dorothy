'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactGridLayout, { verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { Loader2 } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import type { TerminalPanelState } from '../types';
import TerminalPanel from './TerminalPanel';

interface TerminalGridProps {
  agents: AgentStatus[];
  visiblePanels: TerminalPanelState[];
  rglLayout: Layout;
  cols: number;
  rows: number;
  onLayoutChange: (layout: Layout) => void;
  broadcastMode: boolean;
  focusedPanelId: string | null;
  fullscreenPanelId: string | null;
  isLoading: boolean;
  isEditable: boolean;
  tabType: 'custom' | 'project';
  onRegisterContainer: (agentId: string, container: HTMLDivElement | null) => void;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onRemoveAgent: (agentId: string) => void;
  onClearTerminal: (agentId: string) => void;
  onFullscreenPanel: (agentId: string) => void;
  onExitFullscreen: () => void;
  onFocusPanel: (agentId: string) => void;
  onContextMenu: (e: React.MouseEvent, agentId: string) => void;
  onFitAll: () => void;
}

export default function TerminalGrid({
  agents,
  visiblePanels,
  rglLayout,
  cols,
  rows,
  onLayoutChange,
  broadcastMode,
  focusedPanelId,
  fullscreenPanelId,
  isLoading,
  isEditable,
  tabType,
  onRegisterContainer,
  onStartAgent,
  onStopAgent,
  onRemoveAgent,
  onClearTerminal,
  onFullscreenPanel,
  onExitFullscreen,
  onFocusPanel,
  onContextMenu,
  onFitAll,
}: TerminalGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) setContainerWidth(width);
        if (height > 0) setContainerHeight(height);
      }
    });
    observer.observe(el);

    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setContainerWidth(rect.width);
    if (rect.height > 0) setContainerHeight(rect.height);

    return () => observer.disconnect();
  }, []);

  // Compute row height — use the preset's defined rows, not item count
  const expectedRows = Math.max(1, rows);
  const MARGIN: readonly [number, number] = [2, 2];
  const CONTAINER_PADDING: readonly [number, number] = [0, 0];
  const rowHeight = Math.max(80, (containerHeight - MARGIN[1] * (expectedRows + 1)) / expectedRows);

  const gridConfig = useMemo(() => ({
    cols,
    rowHeight,
    margin: MARGIN,
    containerPadding: CONTAINER_PADDING,
    maxRows: expectedRows,
  }), [cols, rowHeight, expectedRows]);

  const dragConfig = useMemo(() => ({
    enabled: isEditable,
    handle: '.terminal-drag-handle',
  }), [isEditable]);

  const resizeConfig = useMemo(() => ({
    enabled: false,
  }), []);

  // Debounced fit after layout changes
  const handleLayoutChange = useCallback((newLayout: Layout) => {
    onLayoutChange(newLayout);
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(onFitAll, 150);
  }, [onLayoutChange, onFitAll]);

  // Re-fit on visible panels change
  useEffect(() => {
    const timer = setTimeout(onFitAll, 100);
    return () => clearTimeout(timer);
  }, [visiblePanels.length, onFitAll]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-foreground" />
            <p className="text-sm">Loading agents...</p>
          </div>
        </div>
      );
    }

    // Empty states
    if (visiblePanels.length === 0 && !fullscreenPanelId) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">
              {tabType === 'custom'
                ? 'Add agents using the toolbar'
                : 'No agents for this project'
              }
            </p>
          </div>
        </div>
      );
    }

    // Fullscreen mode
    if (fullscreenPanelId) {
      const panel = visiblePanels[0];
      if (!panel) return null;
      const agent = agents.find(a => a.id === panel.agentId);
      if (!agent) return null;

      return (
        <div className="h-full w-full">
          <TerminalPanel
            key={panel.agentId}
            agent={agent}
            isFullscreen={true}
            isBroadcasting={broadcastMode}
            isFocused={true}
            tabType={tabType}
            onRegisterContainer={onRegisterContainer}
            onStart={onStartAgent}
            onStop={onStopAgent}
            onRemove={onRemoveAgent}
            onClear={onClearTerminal}
            onFullscreen={onFullscreenPanel}
            onExitFullscreen={onExitFullscreen}
            onFocus={onFocusPanel}
            onContextMenu={onContextMenu}
          />
        </div>
      );
    }

    if (containerWidth <= 0) return null;

    return (
      <ReactGridLayout
        layout={rglLayout}
        width={containerWidth}
        gridConfig={gridConfig}
        dragConfig={dragConfig}
        resizeConfig={resizeConfig}
        compactor={verticalCompactor}
        onLayoutChange={handleLayoutChange}
        autoSize={false}
        style={{ height: containerHeight }}
      >
        {visiblePanels.map(panel => {
          const agent = agents.find(a => a.id === panel.agentId);
          if (!agent) return null;

          return (
            <div key={panel.agentId} className="h-full overflow-hidden">
              <TerminalPanel
                agent={agent}
                isFullscreen={false}
                isBroadcasting={broadcastMode}
                isFocused={focusedPanelId === panel.agentId}
                tabType={tabType}
                onRegisterContainer={onRegisterContainer}
                onStart={onStartAgent}
                onStop={onStopAgent}
                onRemove={onRemoveAgent}
                onClear={onClearTerminal}
                onFullscreen={onFullscreenPanel}
                onExitFullscreen={onExitFullscreen}
                onFocus={onFocusPanel}
                onContextMenu={onContextMenu}
              />
            </div>
          );
        })}
      </ReactGridLayout>
    );
  };

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      {renderContent()}
    </div>
  );
}
