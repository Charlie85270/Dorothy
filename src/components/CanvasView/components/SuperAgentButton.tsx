'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Loader2 } from 'lucide-react';
import { SUPER_AGENT_STATUS_COLORS } from '../constants';

interface SuperAgentButtonProps {
  superAgent: { id: string; status: string } | null;
  isCreating: boolean;
  onClick: () => void;
}

export function SuperAgentButton({ superAgent, isCreating, onClick }: SuperAgentButtonProps) {
  const statusColor = superAgent ? SUPER_AGENT_STATUS_COLORS[superAgent.status] || SUPER_AGENT_STATUS_COLORS.idle : null;

  return (
    <motion.button
      onClick={onClick}
      disabled={isCreating}
      className={`
        flex items-center gap-2 px-3 py-2
        rounded-none border backdrop-blur-sm
        transition-all duration-200
        ${superAgent
          ? superAgent.status === 'running' || superAgent.status === 'waiting'
            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30 shadow-lg shadow-purple-500/20'
            : 'bg-zinc-900/90 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50'
          : 'bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-purple-500/50'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      title={superAgent ? `Super Agent (${superAgent.status})` : 'Create Super Agent'}
    >
      {isCreating ? (
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      ) : (
        <div className="relative">
          <Crown className={`w-4 h-4 ${superAgent ? 'text-amber-400' : 'text-zinc-400'}`} />
          {superAgent && statusColor && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusColor.dot} ${statusColor.pulse ? 'animate-pulse' : ''} border border-zinc-900`} />
          )}
        </div>
      )}
      <span className="text-xs font-medium hidden sm:inline">
        {isCreating ? 'Creating...' : 'Super Agent'}
      </span>
    </motion.button>
  );
}
