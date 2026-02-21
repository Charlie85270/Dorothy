'use client';

import { Loader2, AlertTriangle, GitBranch, Pencil, Crown } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { STATUS_COLORS, CHARACTER_FACES, getProjectColor, isSuperAgentCheck } from '@/app/agents/constants';

interface AgentCardProps {
  agent: AgentStatus;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

export function AgentCard({ agent, isSelected, onSelect, onEdit }: AgentCardProps) {
  const statusConfig = STATUS_COLORS[agent.status];
  const StatusIcon = statusConfig.icon;
  const projectName = agent.projectPath.split('/').pop() || 'Unknown';
  const projectColor = getProjectColor(projectName);
  const isSuper = isSuperAgentCheck(agent);

  return (
    <div
      onClick={onSelect}
      className={`
        p-4 cursor-pointer transition-all relative
        ${isSuper
          ? 'bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-l-2 border-l-amber-500/50 border-b border-amber-500/20'
          : 'border-b border-border-primary/50'}
        ${isSelected ? 'bg-accent-blue/10' : isSuper ? '' : 'hover:bg-bg-tertiary/50'}
      `}
    >
      {/* Subtle gold shimmer for Super Agent */}
      {isSuper && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 to-transparent pointer-events-none" />
      )}
      <div className="flex items-start gap-3 relative">
        <div className={`w-10 h-10 rounded-none flex items-center justify-center shrink-0 relative ${
          isSuper
            ? 'bg-gradient-to-br from-amber-500/30 to-yellow-600/20 ring-1 ring-amber-500/30'
            : agent.name?.toLowerCase() === 'bitwonka'
              ? 'bg-accent-green/20'
              : statusConfig.bg
        }`}>
          {isSuper ? (
            <span className="text-xl">👑</span>
          ) : agent.name?.toLowerCase() === 'bitwonka' ? (
            <span className="text-xl">🐸</span>
          ) : agent.character ? (
            <span className="text-xl">{CHARACTER_FACES[agent.character] || '🤖'}</span>
          ) : agent.status === 'running' ? (
            <Loader2 className={`w-5 h-5 ${statusConfig.text} animate-spin`} />
          ) : (
            <StatusIcon className={`w-5 h-5 ${statusConfig.text}`} />
          )}
          {agent.status === 'running' && (agent.character || agent.name?.toLowerCase() === 'bitwonka' || isSuper) && (
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse ${isSuper ? 'bg-amber-400' : 'bg-accent-blue'}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`font-medium text-sm truncate flex items-center gap-1.5 ${isSuper ? 'text-foreground' : ''}`}>
              {isSuper && <Crown className="w-3.5 h-3.5 text-amber-600" />}
              {agent.name || 'Unnamed Agent'}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                title="Edit agent"
              >
                <Pencil className="w-3.5 h-3.5 text-text-muted hover:text-accent-blue" />
              </button>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isSuper && agent.status === 'running'
                  ? 'bg-amber-500/20 text-amber-400'
                  : `${statusConfig.bg} ${statusConfig.text}`
              }`}>
                {agent.status}
              </span>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-1 truncate">
            {agent.pathMissing ? (
              <span className="text-accent-amber flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Path not found
              </span>
            ) : (
              agent.currentTask || 'Waiting for task...'
            )}
          </p>
          {/* Project badge and branch */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[100px] ${projectColor.bg} ${projectColor.text}`}
              title={agent.projectPath}
            >
              {projectName}
            </span>
            {agent.provider === 'local' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-accent-green/20 text-accent-green">
                {agent.localModel || 'Local'}
              </span>
            )}
            {agent.provider === 'codex' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-500/20 text-orange-500">
                {agent.codexModel || 'Codex'}
              </span>
            )}
            {agent.branchName && (
              <span className="flex items-center gap-1 text-[10px] text-accent-purple">
                <GitBranch className="w-3 h-3" />
                <span className="font-mono truncate max-w-[80px]">{agent.branchName}</span>
              </span>
            )}
          </div>
          {agent.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {agent.skills.slice(0, 2).map((skill) => (
                <span
                  key={skill}
                  className="px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple text-[10px] truncate max-w-[70px]"
                  title={skill}
                >
                  {skill}
                </span>
              ))}
              {agent.skills.length > 2 && (
                <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted text-[10px]">
                  +{agent.skills.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
