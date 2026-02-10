'use client';

import { useMemo } from 'react';
import { FolderOpen } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { STATUS_COLORS, CHARACTER_FACES } from '../constants';

interface SidebarProjectBrowserProps {
  agents: AgentStatus[];
  onFocusPanel: (agentId: string) => void;
}

export default function SidebarProjectBrowser({ agents, onFocusPanel }: SidebarProjectBrowserProps) {
  // Group agents by project path
  const projects = useMemo(() => {
    const grouped = new Map<string, AgentStatus[]>();
    for (const agent of agents) {
      const key = agent.projectPath;
      const existing = grouped.get(key) || [];
      existing.push(agent);
      grouped.set(key, existing);
    }
    return Array.from(grouped.entries()).map(([path, projectAgents]) => ({
      path,
      name: path.split('/').pop() || path,
      agents: projectAgents,
    }));
  }, [agents]);

  if (projects.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-xs">
        No projects with agents
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {projects.map(project => (
        <div key={project.path}>
          {/* Project header */}
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground truncate">{project.name}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {project.agents.length} agent{project.agents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Agents in project */}
          <div className="ml-4 space-y-0.5">
            {project.agents.map(agent => {
              const emoji = agent.name?.toLowerCase() === 'bitwonka'
                ? '🐸'
                : CHARACTER_FACES[agent.character || 'robot'] || '🤖';
              const name = agent.name || `Agent ${agent.id.slice(0, 6)}`;
              const status = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;

              return (
                <button
                  key={agent.id}
                  onClick={() => onFocusPanel(agent.id)}
                  className="flex items-center gap-2 w-full px-2 py-1 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-xs">{emoji}</span>
                  <span className="text-[11px] text-foreground truncate flex-1">{name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
