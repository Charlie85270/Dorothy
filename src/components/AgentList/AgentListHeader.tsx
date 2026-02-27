'use client';

import { Plus, Crown, Loader2 } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';

interface AgentListHeaderProps {
  superAgent: AgentStatus | null;
  isCreatingSuperAgent: boolean;
  onSuperAgentClick: () => void;
  onNewAgentClick: () => void;
}

export function AgentListHeader({
  superAgent,
  isCreatingSuperAgent,
  onSuperAgentClick,
  onNewAgentClick,
}: AgentListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">AI Agents Control Center</h1>
        <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
          Dorothy is watching you AI Agents.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Super Agent Button */}
        <button
          onClick={onSuperAgentClick}
          disabled={isCreatingSuperAgent}
          className={`
            flex items-center justify-center gap-2 px-3 lg:px-4 py-2 font-medium rounded-none transition-all text-sm lg:text-base
            ${superAgent
              ? superAgent.status === 'running' || superAgent.status === 'waiting'
                ? 'bg-green-500/20 border border-green-500/50 text-green-700 hover:bg-green-500/30 shadow-lg shadow-green-500/20'
                : 'bg-bg-tertiary border border-green-500/30 text-green-600 hover:bg-green-500/10 hover:border-green-500/50'
              : 'bg-bg-tertiary border border-border-primary text-text-secondary hover:bg-bg-secondary hover:border-green-500/50 hover:text-green-600'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={superAgent ? `Super Agent (${superAgent.status})` : 'Create Super Agent'}
        >
          {isCreatingSuperAgent ? (
            <Loader2 className="w-4 h-4 animate-spin text-green-500" />
          ) : (
            <div className="relative">
              <Crown className={`w-4 h-4 ${superAgent ? 'text-amber-400' : ''}`} />
              {superAgent && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-tertiary ${superAgent.status === 'running' ? 'bg-green-400 animate-pulse' :
                  superAgent.status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                    superAgent.status === 'error' ? 'bg-red-400' :
                      superAgent.status === 'completed' ? 'bg-cyan-400' :
                        'bg-zinc-500'
                  }`} />
              )}
            </div>
          )}
          <span className="hidden sm:inline">
            {isCreatingSuperAgent ? 'Creating...' : 'Super Agent'}
          </span>
        </button>

        {/* New Agent Button */}
        <button
          onClick={onNewAgentClick}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors text-sm lg:text-base"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Agent</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>
    </div>
  );
}
