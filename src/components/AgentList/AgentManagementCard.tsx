'use client';

import { Play, Square, Pencil, Trash2, AlertTriangle, Crown, Clock } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  CHARACTER_FACES,
  isSuperAgentCheck,
} from '@/app/agents/constants';

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AgentManagementCardProps {
  agent: AgentStatus;
  onClick: () => void;
  onEdit: () => void;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
}

export function AgentManagementCard({ agent, onClick, onEdit, onStart, onStop, onRemove }: AgentManagementCardProps) {
  const statusConfig = STATUS_COLORS[agent.status];
  const isSuper = isSuperAgentCheck(agent);
  const isRunning = agent.status === 'running' || agent.status === 'waiting';
  const isError = agent.status === 'error';

  // Show the user's last prompt, not terminal output
  const lastPrompt = agent.currentTask || null;

  return (
    <div
      onClick={onClick}
      className={`
        group relative cursor-pointer transition-all border border-border bg-card hover:bg-accent/10
        ${isSuper ? 'border-l-[3px] border-l-amber-500/60' : ''}
        ${isRunning && !isSuper ? 'border-l-[3px] border-l-primary/60' : ''}
        ${isError ? 'border-l-[3px] border-l-red-500/60' : ''}
      `}
    >
      <div className="p-3">
        {/* Row 1: Avatar + Name + Status (top-right) */}
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 flex items-center justify-center shrink-0 text-base ${
            isSuper ? 'bg-gradient-to-br from-amber-500/30 to-yellow-600/20' : statusConfig.bg
          }`}>
            {isSuper ? '👑' : agent.character ? (CHARACTER_FACES[agent.character] || '🤖') : '🤖'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isSuper && <Crown className="w-3 h-3 text-amber-600 shrink-0" />}
              <span className="font-medium text-sm truncate text-foreground">
                {agent.name || 'Unnamed Agent'}
              </span>
            </div>
          </div>

          {/* Status pill — top right */}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
            isSuper && isRunning
              ? 'bg-amber-500/20 text-amber-400'
              : `${statusConfig.bg} ${statusConfig.text}`
          }`}>
            {STATUS_LABELS[agent.status]}
          </span>
        </div>

        {/* Row 2: Project path */}
        <p className="text-[11px] text-muted-foreground mt-2 truncate font-mono" title={agent.projectPath}>
          {agent.projectPath}
        </p>

        {/* Row 3: Last user prompt */}
        {agent.pathMissing ? (
          <p className="text-xs text-amber-500 flex items-center gap-1 mt-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Path not found
          </p>
        ) : lastPrompt ? (
          <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2 leading-relaxed">
            {lastPrompt}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40 mt-1.5 italic">No task assigned</p>
        )}

        {/* Skills */}
        {agent.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {agent.skills.map((skill) => (
              <span
                key={skill}
                className="px-1.5 py-0.5 rounded bg-accent-purple/15 text-accent-purple text-[10px] truncate max-w-[100px]"
                title={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: timestamp + actions */}
      <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(agent.lastActivity)}
        </span>

        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {isRunning ? (
            <button
              onClick={onStop}
              className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
              title="Stop agent"
            >
              <Square className="w-3.5 h-3.5 text-red-400" />
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={agent.pathMissing}
              className="p-1.5 hover:bg-primary/10 rounded transition-colors disabled:opacity-30"
              title="Start agent"
            >
              <Play className="w-3.5 h-3.5 text-primary" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="Edit agent"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
            title="Remove agent"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
