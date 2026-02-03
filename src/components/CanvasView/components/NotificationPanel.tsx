'use client';

import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Bot,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Bell,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { CHARACTER_EMOJIS } from '../constants';
import type { AgentNode } from '../types';

interface NotificationPanelProps {
  agents: AgentNode[];
  isCollapsed: boolean;
  onToggle: () => void;
  onOpenTerminal: (agentId: string) => void;
}

function AgentItem({
  agent,
  showAction = false,
  onOpenTerminal,
}: {
  agent: AgentNode;
  showAction?: boolean;
  onOpenTerminal: (agentId: string) => void;
}) {
  return (
    <motion.div
      layoutId={`notification-agent-${agent.id}`}
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`p-3 rounded-none border transition-colors cursor-pointer hover:bg-zinc-800/50 ${agent.status === 'waiting'
        ? 'bg-amber-500/5 border-amber-500/30'
        : agent.status === 'running'
          ? 'bg-cyan-500/5 border-cyan-500/20'
          : agent.status === 'completed'
            ? 'bg-green-500/5 border-green-500/20'
            : agent.status === 'error'
              ? 'bg-red-500/5 border-red-500/20'
              : 'bg-zinc-800/30 border-zinc-700/50'
        }`}
      onClick={() => onOpenTerminal(agent.id)}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{CHARACTER_EMOJIS[agent.character] || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-200 truncate">{agent.name}</span>
            {agent.status === 'waiting' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
                <AlertCircle className="w-3 h-3" />
                Input needed
              </span>
            )}
            {agent.status === 'running' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Working
              </span>
            )}
            {agent.status === 'completed' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Done
              </span>
            )}
            {agent.status === 'error' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400">
                <XCircle className="w-3 h-3" />
                Error
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {agent.projectPath.split('/').pop()}
          </p>
          {showAction && agent.status === 'waiting' && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenTerminal(agent.id); }}
              className="mt-2 flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Respond
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function NotificationPanel({
  agents,
  isCollapsed,
  onToggle,
  onOpenTerminal,
}: NotificationPanelProps) {
  const waitingAgents = agents.filter(a => a.status === 'waiting');
  const runningAgents = agents.filter(a => a.status === 'running');
  const completedAgents = agents.filter(a => a.status === 'completed');
  const errorAgents = agents.filter(a => a.status === 'error');

  return (
    <motion.div
      className="absolute top-4 bottom-4 right-4 z-50 flex"
      initial={false}
      animate={{ width: isCollapsed ? 48 : 320 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-8 h-12 my-auto -mr-1 rounded-none bg-zinc-900/95 border border-r-0 border-zinc-700 hover:bg-zinc-800 transition-colors z-10"
      >
        {isCollapsed ? (
          <div className="relative">
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
            {waitingAgents.length > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {waitingAgents.length}
              </span>
            )}
          </div>
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Panel content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 bg-zinc-900/95 border border-zinc-700 rounded-none overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-sm text-zinc-200">Activity</span>
                {waitingAgents.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-bold">
                    {waitingAgents.length}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <LayoutGroup>
                {/* Waiting agents */}
                {waitingAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                        Needs Attention
                      </span>
                    </div>
                    <div className="space-y-2">
                      {waitingAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} showAction onOpenTerminal={onOpenTerminal} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Running agents */}
                {runningAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
                        Working
                      </span>
                    </div>
                    <div className="space-y-2">
                      {runningAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} onOpenTerminal={onOpenTerminal} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed agents */}
                {completedAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                        Completed
                      </span>
                    </div>
                    <div className="space-y-2">
                      {completedAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} onOpenTerminal={onOpenTerminal} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Error agents */}
                {errorAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                        Errors
                      </span>
                    </div>
                    <div className="space-y-2">
                      {errorAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} onOpenTerminal={onOpenTerminal} />
                      ))}
                    </div>
                  </div>
                )}
              </LayoutGroup>

              {/* Empty state */}
              {agents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot className="w-10 h-10 text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-500">No agents yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Create an agent to see activity</p>
                </div>
              )}

              {/* All idle state */}
              {agents.length > 0 && waitingAgents.length === 0 && runningAgents.length === 0 && completedAgents.length === 0 && errorAgents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                    <Bot className="w-5 h-5 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-500">All agents idle</p>
                  <p className="text-xs text-zinc-600 mt-1">Start an agent to see activity</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
