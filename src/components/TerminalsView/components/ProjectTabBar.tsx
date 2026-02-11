'use client';

import { useMemo } from 'react';
import { FolderOpen, List } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import type { ActiveTab } from '../types';

interface ProjectTabBarProps {
  agents: AgentStatus[];
  activeTab: ActiveTab;
  onSelectProject: (projectPath: string) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export default function ProjectTabBar({
  agents,
  activeTab,
  onSelectProject,
  panelOpen,
  onTogglePanel,
}: ProjectTabBarProps) {
  const projects = useMemo(() => {
    const grouped = new Map<string, { running: number; total: number }>();
    for (const agent of agents) {
      const key = agent.projectPath;
      const existing = grouped.get(key) || { running: 0, total: 0 };
      existing.total++;
      if (agent.status === 'running' || agent.status === 'waiting') existing.running++;
      grouped.set(key, existing);
    }
    return Array.from(grouped.entries()).map(([path, stats]) => ({
      path,
      name: path.split('/').pop() || path,
      ...stats,
    }));
  }, [agents]);

  const running = agents.filter(a => a.status === 'running' || a.status === 'waiting').length;
  const isActive = (path: string) =>
    activeTab.type === 'project' && activeTab.projectPath === path;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-secondary border-t border-border !rounded-none">
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
        {projects.map(project => (
          <button
            key={project.path}
            onClick={() => onSelectProject(project.path)}
            className={`
              flex items-center gap-1.5 px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors shrink-0
              ${isActive(project.path)
                ? 'bg-primary/15 text-primary border-t-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
              }
            `}
          >
            <FolderOpen className="w-3 h-3" />
            {project.name}
            <span className="flex items-center gap-1 text-[10px] opacity-60">
              {project.total}
              {project.running > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              )}
            </span>
          </button>
        ))}

        {projects.length === 0 && (
          <span className="text-xs text-muted-foreground px-2">No projects</span>
        )}
      </div>

      {/* Panel toggle button */}
      <button
        onClick={onTogglePanel}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 ml-2 shrink-0 text-xs font-medium transition-all
          ${panelOpen
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
          }
        `}
        title="Agents, skills & projects"
      >
        <List className="w-3.5 h-3.5" />
        {running > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>
    </div>
  );
}
