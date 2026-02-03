import { useMemo } from 'react';
import type { AgentStatus } from '@/types/electron';
import type { AgentNode, ProjectNode, ConnectionData } from '../types';

export function isSuperAgent(agent: { name?: string }): boolean {
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
}

export function useCanvasNodes(
  electronAgents: AgentStatus[],
  agentPositions: Record<string, { x: number; y: number }>,
  projectPositions: Record<string, { x: number; y: number }>,
  filter: 'all' | 'running' | 'idle' | 'stopped',
  projectFilter: string,
  searchQuery: string
) {
  // Build agent nodes from real data (excluding super agent)
  const agentNodes: AgentNode[] = useMemo(() => {
    return electronAgents
      .filter(agent => !isSuperAgent(agent))
      .map((agent, index) => {
        const defaultPos = { x: 100 + (index % 3) * 320, y: 80 + Math.floor(index / 3) * 200 };
        const pos = agentPositions[agent.id] || defaultPos;

        return {
          id: agent.id,
          type: 'agent' as const,
          name: agent.name || `Agent ${agent.id.slice(0, 6)}`,
          character: agent.character || 'robot',
          status: agent.status as AgentNode['status'],
          skills: agent.skills || [],
          projectPath: agent.projectPath,
          position: pos,
        };
      });
  }, [electronAgents, agentPositions]);

  // Build project nodes from agents' projects only
  const projectNodes: ProjectNode[] = useMemo(() => {
    const projectMap = new Map<string, ProjectNode>();

    electronAgents
      .filter(agent => !isSuperAgent(agent))
      .forEach((agent) => {
        const projectPath = agent.projectPath;
        const projectName = projectPath.split('/').pop() || projectPath;

        if (!projectMap.has(projectPath)) {
          projectMap.set(projectPath, {
            id: projectPath,
            type: 'project',
            name: projectName,
            path: projectPath,
            branch: agent.branchName || undefined,
            position: projectPositions[projectPath] || { x: 0, y: 0 },
            agentIds: [],
          });
        }
        projectMap.get(projectPath)!.agentIds.push(agent.id);
      });

    const projects = Array.from(projectMap.values());
    projects.forEach((project, index) => {
      if (project.position.x === 0 && project.position.y === 0) {
        project.position = projectPositions[project.id] || {
          x: 150 + (index % 4) * 280,
          y: 420 + Math.floor(index / 4) * 150
        };
      }
    });

    return projects;
  }, [electronAgents, projectPositions]);

  // Get unique projects for filter dropdown
  const uniqueProjects = useMemo(() => {
    const projectMap = new Map<string, { path: string; name: string }>();
    electronAgents.forEach((agent) => {
      if (!projectMap.has(agent.projectPath)) {
        projectMap.set(agent.projectPath, {
          path: agent.projectPath,
          name: agent.projectPath.split('/').pop() || agent.projectPath,
        });
      }
    });
    return Array.from(projectMap.values());
  }, [electronAgents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agentNodes.filter((agent) => {
      const statusMatch = filter === 'all' ||
        (filter === 'running' && (agent.status === 'running' || agent.status === 'waiting')) ||
        (filter === 'idle' && agent.status === 'idle') ||
        (filter === 'stopped' && (agent.status === 'stopped' || agent.status === 'completed' || agent.status === 'error'));
      const searchMatch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.projectPath.toLowerCase().includes(searchQuery.toLowerCase());
      const projectMatch = projectFilter === 'all' || agent.projectPath === projectFilter;
      return statusMatch && searchMatch && projectMatch;
    });
  }, [agentNodes, filter, searchQuery, projectFilter]);

  // Filter projects based on project filter
  const filteredProjects = useMemo(() => {
    if (projectFilter === 'all') {
      return projectNodes;
    }
    return projectNodes.filter((project) => project.path === projectFilter);
  }, [projectNodes, projectFilter]);

  // Get connection lines
  const connections: ConnectionData[] = useMemo(() => {
    const lines: ConnectionData[] = [];

    filteredAgents.forEach((agent) => {
      const project = filteredProjects.find((p) => p.id === agent.projectPath);
      if (project) {
        lines.push({
          from: { x: agent.position.x + 144, y: agent.position.y + 170 },
          to: { x: project.position.x + 112, y: project.position.y },
          isActive: agent.status === 'running' || agent.status === 'waiting',
        });
      }
    });

    return lines;
  }, [filteredAgents, filteredProjects]);

  // Find existing super agent
  const superAgent: AgentStatus | null = useMemo(() => {
    return electronAgents.find(a => isSuperAgent(a)) || null;
  }, [electronAgents]);

  const runningCount = filteredAgents.filter(a => a.status === 'running').length;
  const waitingCount = filteredAgents.filter(a => a.status === 'waiting').length;

  return {
    agentNodes,
    projectNodes,
    filteredAgents,
    filteredProjects,
    uniqueProjects,
    connections,
    superAgent,
    runningCount,
    waitingCount,
  };
}
