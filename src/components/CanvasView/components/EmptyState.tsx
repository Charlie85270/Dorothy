'use client';

import React from 'react';
import { Bot } from 'lucide-react';

interface EmptyStateProps {
  onNavigateToAgents: () => void;
}

export function EmptyState({ onNavigateToAgents }: EmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 p-4">
      <div className="text-center p-4 lg:p-8 rounded-none bg-zinc-900/80 border border-zinc-700 max-w-[280px] lg:max-w-md">
        <Bot className="w-8 h-8 lg:w-12 lg:h-12 text-zinc-600 mx-auto mb-3 lg:mb-4" />
        <h3 className="text-base lg:text-lg font-medium text-zinc-300 mb-1.5 lg:mb-2">No agents yet</h3>
        <p className="text-xs lg:text-sm text-zinc-500 mb-3 lg:mb-4">
          Create an agent from the Agents page to see them here.
        </p>
        <button
          onClick={onNavigateToAgents}
          className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-none bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-xs lg:text-sm"
        >
          Go to Agents
        </button>
      </div>
    </div>
  );
}
