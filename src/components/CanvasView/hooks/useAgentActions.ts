import { useState, useCallback } from 'react';
import type { AgentCharacter, AgentStatus } from '@/types/electron';

interface CreateAgentConfig {
  projectPath: string;
  skills: string[];
  worktree?: { enabled: boolean; branchName: string };
  character?: AgentCharacter;
  name?: string;
  secondaryProjectPath?: string;
  skipPermissions?: boolean;
}

interface UseAgentActionsProps {
  stopAgent: (id: string) => void;
  startAgent: (id: string, prompt: string, options?: { model?: string }) => Promise<void>;
  createAgent: (config: CreateAgentConfig) => Promise<AgentStatus>;
  projects: { path: string; name: string }[];
  superAgent: AgentStatus | null;
  setTerminalAgentId: (id: string | null) => void;
}

export function useAgentActions({
  stopAgent,
  startAgent,
  createAgent,
  projects,
  superAgent,
  setTerminalAgentId,
}: UseAgentActionsProps) {
  const [isCreatingSuperAgent, setIsCreatingSuperAgent] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [createAgentProjectPath, setCreateAgentProjectPath] = useState<string | null>(null);

  const handleToggleAgent = useCallback(async (agentId: string, isRunning: boolean) => {
    if (isRunning) {
      stopAgent(agentId);
    } else {
      try {
        await startAgent(agentId, 'Hello');
        setTerminalAgentId(agentId);
      } catch (error) {
        console.error('Failed to start agent:', error);
      }
    }
  }, [stopAgent, startAgent, setTerminalAgentId]);

  const handleStartAgent = useCallback(async (agentId: string, prompt: string) => {
    try {
      await startAgent(agentId, prompt);
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  }, [startAgent]);

  const handleStopAgent = useCallback((agentId: string) => {
    stopAgent(agentId);
  }, [stopAgent]);

  const handleAddAgentToProject = useCallback((projectPath: string) => {
    setCreateAgentProjectPath(projectPath);
    setShowCreateAgentModal(true);
  }, []);

  const handleCreateAgent = useCallback(async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean
  ) => {
    try {
      const agent = await createAgent({ projectPath, skills, worktree, character, name, secondaryProjectPath, skipPermissions });
      setShowCreateAgentModal(false);
      setCreateAgentProjectPath(null);

      if (prompt) {
        setTimeout(async () => {
          await startAgent(agent.id, prompt, { model });
          setTerminalAgentId(agent.id);
        }, 600);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  }, [createAgent, startAgent, setTerminalAgentId]);

  const orchestratorPrompt = `Hello! Please list the current agents using list_agents.`;

  const handleSuperAgentClick = useCallback(async () => {
    if (superAgent) {
      if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
        await startAgent(superAgent.id, orchestratorPrompt);
      }
      setTerminalAgentId(superAgent.id);
      return;
    }

    if (!window.electronAPI?.orchestrator?.getStatus) {
      console.error('Orchestrator API not available');
      return;
    }

    const status = await window.electronAPI.orchestrator.getStatus();

    if (!status.configured && window.electronAPI?.orchestrator?.setup) {
      const setupResult = await window.electronAPI.orchestrator.setup();
      if (!setupResult.success) {
        console.error('Failed to setup orchestrator:', setupResult.error);
        return;
      }
    }

    setIsCreatingSuperAgent(true);
    try {
      const projectPath = projects[0]?.path || '/tmp';

      const agent = await createAgent({
        projectPath,
        skills: [],
        character: 'wizard',
        name: 'Super Agent (Orchestrator)',
        skipPermissions: true,
      });

      await startAgent(agent.id, orchestratorPrompt);
      setTerminalAgentId(agent.id);
    } catch (error) {
      console.error('Failed to create super agent:', error);
    } finally {
      setIsCreatingSuperAgent(false);
    }
  }, [superAgent, projects, createAgent, startAgent, setTerminalAgentId]);

  const closeCreateAgentModal = useCallback(() => {
    setShowCreateAgentModal(false);
    setCreateAgentProjectPath(null);
  }, []);

  return {
    isCreatingSuperAgent,
    showCreateAgentModal,
    createAgentProjectPath,
    handleToggleAgent,
    handleStartAgent,
    handleStopAgent,
    handleAddAgentToProject,
    handleCreateAgent,
    handleSuperAgentClick,
    closeCreateAgentModal,
  };
}
