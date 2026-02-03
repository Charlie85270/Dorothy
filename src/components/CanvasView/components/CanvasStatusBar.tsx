'use client';

import React from 'react';
import { Bot, FolderGit2 } from 'lucide-react';

interface CanvasStatusBarProps {
  agentCount: number;
  runningCount: number;
  projectCount: number;
  waitingCount: number;
}

export function CanvasStatusBar({ agentCount, runningCount, projectCount, waitingCount }: CanvasStatusBarProps) {
  return (
    <div className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 flex items-center gap-3 lg:gap-6 px-3 lg:px-4 py-2 rounded-none bg-zinc-900/90 border border-zinc-700 text-[10px] lg:text-xs text-zinc-400 z-40">
      <div className="flex items-center gap-1.5 lg:gap-2">
        <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-cyan-400" />
        <span>{agentCount}</span>
        {runningCount > 0 && <span className="text-green-400 hidden sm:inline">({runningCount} run)</span>}
        {waitingCount > 0 && <span className="text-amber-400">({waitingCount} wait)</span>}
      </div>
      <div className="flex items-center gap-1.5 lg:gap-2 hidden sm:flex">
        <FolderGit2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-400" />
        <span>{projectCount}</span>
      </div>
    </div>
  );
}
