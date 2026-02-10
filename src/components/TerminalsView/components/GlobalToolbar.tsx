'use client';

import {
  Play,
  Square,
  Radio,
  Plus,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import type { LayoutPreset } from '../types';
import LayoutPresetSelector from './LayoutPresetSelector';
import AddAgentDropdown from './AddAgentDropdown';

interface GlobalToolbarProps {
  layout: LayoutPreset;
  onLayoutChange: (preset: LayoutPreset) => void;
  broadcastMode: boolean;
  onToggleBroadcast: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onNewAgent: () => void;
  runningCount: number;
  totalCount: number;
  fontSize: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  isViewFullscreen: boolean;
  onToggleViewFullscreen: () => void;
  isCustomTabActive: boolean;
  allAgents: AgentStatus[];
  currentTabAgentIds: string[];
  onAddAgentToTab: (agentId: string) => void;
  disabledPresets: LayoutPreset[];
}

export default function GlobalToolbar({
  layout,
  onLayoutChange,
  broadcastMode,
  onToggleBroadcast,
  searchQuery,
  onSearchChange,
  onStartAll,
  onStopAll,
  onNewAgent,
  runningCount,
  totalCount,
  fontSize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isViewFullscreen,
  onToggleViewFullscreen,
  isCustomTabActive,
  allAgents,
  currentTabAgentIds,
  onAddAgentToTab,
  disabledPresets,
}: GlobalToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-2">
        {/* Layout selector — only for custom tabs */}
        {isCustomTabActive && (
          <LayoutPresetSelector
            current={layout}
            onChange={onLayoutChange}
            disabledPresets={disabledPresets}
          />
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Batch actions */}
        <button
          onClick={onStartAll}
          disabled={runningCount === totalCount || totalCount === 0}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-30"
          title="Start all idle agents"
        >
          <Play className="w-3 h-3" />
          <span className="hidden sm:inline">Start All</span>
        </button>

        <button
          onClick={onStopAll}
          disabled={runningCount === 0}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
          title="Stop all running agents"
        >
          <Square className="w-3 h-3" />
          <span className="hidden sm:inline">Stop All</span>
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Zoom out (smaller text)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onZoomReset}
            className="px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors min-w-[32px] text-center"
            title="Reset zoom"
          >
            {fontSize}px
          </button>
          <button
            onClick={onZoomIn}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Zoom in (larger text)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search output..."
            className="pl-7 pr-2 py-1 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-white/30 w-[180px]"
          />
        </div>

        {/* Broadcast toggle */}
        <button
          onClick={onToggleBroadcast}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors
            ${broadcastMode
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }
          `}
          title="Toggle broadcast mode — send input to all terminals"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Broadcast</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleViewFullscreen}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors
            ${isViewFullscreen
              ? 'bg-white/10 text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }
          `}
          title={isViewFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >
          {isViewFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>

        {/* Add agent to tab dropdown — custom tabs only */}
        {isCustomTabActive && (
          <AddAgentDropdown
            allAgents={allAgents}
            currentTabAgentIds={currentTabAgentIds}
            onAddAgent={onAddAgentToTab}
          />
        )}

        {/* New Agent button — always visible */}
        <button
          onClick={onNewAgent}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Agent</span>
        </button>
      </div>
    </div>
  );
}
