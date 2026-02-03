import { useMemo } from 'react';
import type { AgentStatus } from '@/types/electron';
import { isSuperAgentCheck, getStatusPriority } from '@/app/agents/constants';

interface UseAgentFilteringProps {
  agents: AgentStatus[];
  projectFilter: string | null;
}

interface UniqueProject {
  path: string;
  name: string;
}

export function useAgentFiltering({ agents, projectFilter }: UseAgentFilteringProps) {
  const uniqueProjects = useMemo(() => {
    const projectSet = new Map<string, string>();
    agents.forEach((agent) => {
      const projectName = agent.projectPath.split('/').pop() || 'Unknown';
      projectSet.set(agent.projectPath, projectName);
    });
    return Array.from(projectSet.entries()).map(([path, name]) => ({ path, name }));
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let filtered = projectFilter ? agents.filter(a => a.projectPath === projectFilter) : agents;

    // Sort: Super Agent first, then by status (running > waiting > idle)
    return [...filtered].sort((a, b) => {
      const aIsSuper = isSuperAgentCheck(a);
      const bIsSuper = isSuperAgentCheck(b);

      // Super Agent always first
      if (aIsSuper && !bIsSuper) return -1;
      if (!aIsSuper && bIsSuper) return 1;

      // Then sort by status priority
      const aPriority = getStatusPriority(a.status);
      const bPriority = getStatusPriority(b.status);
      return aPriority - bPriority;
    });
  }, [agents, projectFilter]);

  return {
    filteredAgents,
    uniqueProjects,
  };
}
