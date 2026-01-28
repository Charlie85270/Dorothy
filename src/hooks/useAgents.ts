'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentStatus, AgentEvent } from '@/types/agent';

export function useAgents() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    // Poll every 10 seconds to reduce CPU usage
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const createAgent = async (projectPath: string, skills: string[], prompt?: string, model?: string) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, skills, prompt, model }),
    });
    if (!res.ok) throw new Error('Failed to create agent');
    const data = await res.json();
    await fetchAgents();
    return data.agent as AgentStatus;
  };

  const startAgent = async (id: string, prompt: string, model?: string) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', prompt, model }),
    });
    if (!res.ok) throw new Error('Failed to start agent');
    await fetchAgents();
  };

  const stopAgent = async (id: string) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    if (!res.ok) throw new Error('Failed to stop agent');
    await fetchAgents();
  };

  const removeAgent = async (id: string) => {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to remove agent');
    await fetchAgents();
  };

  const sendInput = async (id: string, input: string) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'input', input }),
    });
    if (!res.ok) throw new Error('Failed to send input');
  };

  return {
    agents,
    loading,
    error,
    createAgent,
    startAgent,
    stopAgent,
    removeAgent,
    sendInput,
    refresh: fetchAgents,
  };
}

export function useAgentStream(agentId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!agentId) {
      setEvents([]);
      setConnected(false);
      return;
    }

    const eventSource = new EventSource(`/api/agents/${agentId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev.slice(-500), data]); // Keep last 500 events
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [agentId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connected, clearEvents };
}
