'use client';

import React from 'react';
import {
  FolderGit2,
  Filter,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { SuperAgentButton } from './SuperAgentButton';

interface CanvasToolbarProps {
  filter: 'all' | 'running' | 'idle' | 'stopped';
  setFilter: (filter: 'all' | 'running' | 'idle' | 'stopped') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectFilter: string;
  setProjectFilter: (project: string) => void;
  projects: { path: string; name: string }[];
  onResetView: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  superAgent: { id: string; status: string } | null;
  isCreatingSuperAgent: boolean;
  onSuperAgentClick: () => void;
  showSuperAgentButton: boolean;
}

export function CanvasToolbar({
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  projectFilter,
  setProjectFilter,
  projects,
  onResetView,
  zoom,
  setZoom,
  superAgent,
  isCreatingSuperAgent,
  onSuperAgentClick,
  showSuperAgentButton,
}: CanvasToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 lg:top-4 lg:left-4 lg:right-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 z-40">
      {/* Left side - Search & Filter */}
      <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto">
        {/* Search - hidden on mobile */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-none bg-zinc-900/90 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 w-40"
          />
        </div>

        {/* Project filter dropdown */}
        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="pl-3 pr-8 py-2 rounded-none bg-zinc-900/90 border border-zinc-700 text-xs lg:text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[100px] lg:min-w-[140px]"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </select>
          <FolderGit2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-0.5 lg:gap-1 p-1 rounded-none bg-zinc-900/90 border border-zinc-700">
          <Filter className="w-4 h-4 text-zinc-500 ml-1 lg:ml-2 hidden sm:block" />
          {(['all', 'running', 'idle', 'stopped'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 lg:px-3 py-1.5 rounded-none text-[10px] lg:text-xs font-medium transition-all ${filter === f
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {f === 'all' ? 'All' : f === 'running' ? 'Run' : f === 'idle' ? 'Idle' : 'Stop'}
            </button>
          ))}
        </div>
      </div>

      {/* Right side - View controls */}
      <div className="flex items-center gap-2 justify-end">
        {showSuperAgentButton && (
          <SuperAgentButton
            superAgent={superAgent}
            isCreating={isCreatingSuperAgent}
            onClick={onSuperAgentClick}
          />
        )}
        <div className="flex items-center gap-1 p-1 rounded-none bg-zinc-900/90 border border-zinc-700">
          <button
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
            className="p-1.5 rounded-none text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-1.5 lg:px-2 text-[10px] lg:text-xs text-zinc-400 min-w-[2.5rem] lg:min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 rounded-none text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onResetView}
          className="p-2 rounded-none bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
