import { useState, useMemo, useCallback } from 'react';
import type { AgentStatus } from '@/types/electron';
import { ORCHESTRATOR_PROMPT } from '@/app/agents/constants';

interface UseSuperAgentProps {
  agents: AgentStatus[];
  startAgent: (id: string, prompt: string) => Promise<void>;
  onAgentCreated?: (agentId: string) => void;
  onCreateNew?: () => void;
}

export function useSuperAgent({
  agents,
  startAgent,
  onAgentCreated,
  onCreateNew,
}: UseSuperAgentProps) {
  const [isCreatingSuperAgent, setIsCreatingSuperAgent] = useState(false);

  const superAgent = useMemo(() => {
    return agents.find(a =>
      a.name?.toLowerCase().includes('super agent') ||
      a.name?.toLowerCase().includes('orchestrator')
    ) || null;
  }, [agents]);

  const handleSuperAgentClick = useCallback(async () => {
    // If super agent exists, just open its edit modal — don't auto-start it
    if (superAgent) {
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

    // Open the create agent modal so the user can select a project
    onCreateNew?.();
  }, [superAgent, startAgent, onAgentCreated, onCreateNew]);

  return {
    superAgent,
    isCreatingSuperAgent,
    handleSuperAgentClick,
  };
}
