'use client';

import { Layers, FolderOpen } from 'lucide-react';

interface UniqueProject {
  path: string;
  name: string;
}

interface ProjectFilterTabsProps {
  uniqueProjects: UniqueProject[];
  projectFilter: string | null;
  totalAgentCount: number;
  agentCountByProject: (path: string) => number;
  onFilterChange: (path: string | null) => void;
}

export function ProjectFilterTabs({
  uniqueProjects,
  projectFilter,
  totalAgentCount,
  agentCountByProject,
  onFilterChange,
}: ProjectFilterTabsProps) {
  if (uniqueProjects.length === 0) return null;

  return (
    <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
      {/* All tab */}
      <button
        onClick={() => onFilterChange(null)}
        className={`
          flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-all whitespace-nowrap
          ${projectFilter === null
            ? 'bg-foreground text-background'
            : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
          }
        `}
      >
        <Layers className="w-3 h-3" />
        All Projects
        <span className={`px-1 py-px text-[10px] ${
          projectFilter === null ? 'bg-black/10' : 'bg-white/10'
        }`}>
          {totalAgentCount}
        </span>
      </button>

      {/* Project tabs */}
      {uniqueProjects.map(({ path, name }) => {
        const agentCount = agentCountByProject(path);
        const isActive = projectFilter === path;

        return (
          <button
            key={path}
            onClick={() => onFilterChange(path)}
            className={`
              flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-all whitespace-nowrap
              ${isActive
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
              }
            `}
            title={path}
          >
            <FolderOpen className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{name}</span>
            <span className={`px-1 py-px text-[10px] ${
              isActive ? 'bg-black/10' : 'bg-white/10'
            }`}>
              {agentCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
