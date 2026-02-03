import { useState, useMemo, useCallback } from 'react';
import type { AgentStatus, AgentCharacter } from '@/types/electron';
import { ORCHESTRATOR_PROMPT } from '@/app/agents/constants';

interface Project {
  path: string;
  name: string;
}

interface UseSuperAgentProps {
  agents: AgentStatus[];
  projects: Project[];
  createAgent: (params: {
    projectPath: string;
    skills: string[];
    character?: AgentCharacter;
    name?: string;
    skipPermissions?: boolean;
  }) => Promise<AgentStatus>;
  startAgent: (id: string, prompt: string) => Promise<void>;
  onAgentCreated?: (agentId: string) => void;
}

export function useSuperAgent({
  agents,
  projects,
  createAgent,
  startAgent,
  onAgentCreated,
}: UseSuperAgentProps) {
  const [isCreatingSuperAgent, setIsCreatingSuperAgent] = useState(false);

  const superAgent = useMemo(() => {
    return agents.find(a =>
      a.name?.toLowerCase().includes('super agent') ||
      a.name?.toLowerCase().includes('orchestrator')
    ) || null;
  }, [agents]);

  const handleSuperAgentClick = useCallback(async () => {
    // If super agent exists
    if (superAgent) {
      // If idle, restart it with the orchestrator prompt
      if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
        await startAgent(superAgent.id, ORCHESTRATOR_PROMPT);
      }
      onAgentCreated?.(superAgent.id);
      return;
    }

    // Check if orchestrator is configured
    if (!window.electronAPI?.orchestrator?.getStatus) {
      console.error('Orchestrator API not available');
      return;
    }

    const status = await window.electronAPI.orchestrator.getStatus();

    // If not configured, set it up first
    if (!status.configured && window.electronAPI?.orchestrator?.setup) {
      const setupResult = await window.electronAPI.orchestrator.setup();
      if (!setupResult.success) {
        console.error('Failed to setup orchestrator:', setupResult.error);
        return;
      }
    }

    // Create a new super agent
    setIsCreatingSuperAgent(true);
    try {
      // Use the first project path or a default
      const projectPath = projects[0]?.path || '/tmp';

      const agent = await createAgent({
        projectPath,
        skills: [],
        character: 'wizard',
        name: 'Super Agent (Orchestrator)',
        skipPermissions: true,
      });

      onAgentCreated?.(agent.id);

      // Start with orchestrator instructions
      setTimeout(async () => {
        await startAgent(agent.id, ORCHESTRATOR_PROMPT);
      }, 600);
    } catch (error) {
      console.error('Failed to create super agent:', error);
    } finally {
      setIsCreatingSuperAgent(false);
    }
  }, [superAgent, projects, createAgent, startAgent, onAgentCreated]);

  return {
    superAgent,
    isCreatingSuperAgent,
    handleSuperAgentClick,
  };
}
