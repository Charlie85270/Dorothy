import { useState, useCallback, useMemo } from 'react';
import type { AgentStatus } from '@/types/electron';

export function useTerminalDialog(electronAgents: AgentStatus[]) {
  const [terminalAgentId, setTerminalAgentId] = useState<string | null>(null);
  const [terminalInitialPanel, setTerminalInitialPanel] = useState<'settings' | undefined>(undefined);

  const handleOpenTerminal = useCallback((agentId: string) => {
    setTerminalAgentId(agentId);
    setTerminalInitialPanel(undefined);
  }, []);

  const handleEditAgent = useCallback((agentId: string) => {
    setTerminalAgentId(agentId);
    setTerminalInitialPanel('settings');
  }, []);

  const closeTerminal = useCallback(() => {
    setTerminalAgentId(null);
    setTerminalInitialPanel(undefined);
  }, []);

  const terminalAgent: AgentStatus | null = useMemo(() => {
    if (!terminalAgentId) return null;
    return electronAgents.find(a => a.id === terminalAgentId) || null;
  }, [terminalAgentId, electronAgents]);

  return {
    terminalAgentId,
    terminalInitialPanel,
    terminalAgent,
    handleOpenTerminal,
    handleEditAgent,
    closeTerminal,
    isOpen: !!terminalAgentId,
  };
}
