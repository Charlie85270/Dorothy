'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface AgentEntry {
  id: string;
  name?: string;
  status: string;
  currentTask?: string;
  projectPath: string;
  error?: string;
  lastActivity: string;
}

interface AgentContextProviderProps {
  isActive: boolean;
  sendContextualUpdateRef: React.MutableRefObject<((text: string) => void) | null>;
}

function formatAgentSummary(agents: AgentEntry[]): string {
  if (agents.length === 0) return 'No agents are currently configured.';

  const parts: string[] = [];

  for (const a of agents) {
    const name = a.name || a.id.slice(0, 8);
    switch (a.status) {
      case 'running':
        parts.push(`"${name}" is RUNNING${a.currentTask ? ` - task: ${a.currentTask}` : ''} in ${a.projectPath}`);
        break;
      case 'waiting':
        parts.push(`"${name}" is WAITING for user input in ${a.projectPath}`);
        break;
      case 'completed':
        parts.push(`"${name}" has COMPLETED its task in ${a.projectPath}`);
        break;
      case 'error':
        parts.push(`"${name}" has an ERROR: ${a.error || 'unknown'} in ${a.projectPath}`);
        break;
      case 'idle':
        parts.push(`"${name}" is IDLE in ${a.projectPath}`);
        break;
    }
  }

  return `Total agents: ${agents.length}. ${parts.join('. ')}`;
}

export default function AgentContextProvider({
  isActive,
  sendContextualUpdateRef,
}: AgentContextProviderProps) {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const prevAgentsRef = useRef<AgentEntry[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch agents via Electron IPC (secure, no CORS needed)
  const fetchAgents = useCallback(async () => {
    try {
      if (!window.electronAPI?.agent?.list) return;
      const agents = await window.electronAPI.agent.list();
      setAgents(agents || []);
    } catch {
      // Electron API not available
    }
  }, []);

  // Poll agents every 5s
  useEffect(() => {
    if (!isActive) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    fetchAgents();
    pollRef.current = setInterval(fetchAgents, 5000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isActive, fetchAgents]);

  const sendUpdate = useCallback((text: string) => {
    const fn = sendContextualUpdateRef.current;
    if (fn) fn(text);
  }, [sendContextualUpdateRef]);

  // Detect status changes and send updates
  const checkForChanges = useCallback(() => {
    if (!isActive || !sendContextualUpdateRef.current) return;

    const prevAgents = prevAgentsRef.current;
    const changes: string[] = [];

    for (const agent of agents) {
      const prev = prevAgents.find((a) => a.id === agent.id);

      if (!prev) {
        changes.push(`New agent "${agent.name || agent.id}" appeared with status: ${agent.status}`);
        continue;
      }

      if (prev.status !== agent.status) {
        const name = agent.name || agent.id;
        switch (agent.status) {
          case 'running':
            changes.push(`Agent "${name}" started running${agent.currentTask ? `: ${agent.currentTask}` : ''}`);
            break;
          case 'completed':
            changes.push(`Agent "${name}" completed its task`);
            break;
          case 'error':
            changes.push(`Agent "${name}" encountered an error: ${agent.error || 'unknown'}`);
            break;
          case 'waiting':
            changes.push(`Agent "${name}" is waiting for user input`);
            break;
          case 'idle':
            changes.push(`Agent "${name}" is now idle`);
            break;
        }
      }
    }

    for (const prev of prevAgents) {
      if (!agents.find((a) => a.id === prev.id)) {
        changes.push(`Agent "${prev.name || prev.id}" was removed`);
      }
    }

    if (changes.length > 0) {
      sendUpdate(`Agent status update: ${changes.join('. ')}. Current overview: ${formatAgentSummary(agents)}`);
    }

    prevAgentsRef.current = [...agents];
  }, [agents, isActive, sendContextualUpdateRef, sendUpdate]);

  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // Periodic full context update every 15s
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (sendContextualUpdateRef.current && agents.length > 0) {
        sendUpdate(`Periodic status update: ${formatAgentSummary(agents)}`);
      }
    }, 15000);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isActive, agents, sendContextualUpdateRef, sendUpdate]);

  // Send initial context when conversation starts
  useEffect(() => {
    if (isActive && sendContextualUpdateRef.current && agents.length > 0) {
      // Small delay to ensure WebSocket is ready
      const timer = setTimeout(() => {
        sendUpdate(`Initial agent overview: ${formatAgentSummary(agents)}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
