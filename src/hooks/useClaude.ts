'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ClaudeSettings,
  ClaudeStats,
  ClaudeProject,
  ClaudePlugin,
  ClaudeSkill,
  HistoryEntry,
  ClaudeMessage,
} from '@/lib/claude-code';

interface ClaudeData {
  settings: ClaudeSettings | null;
  stats: ClaudeStats | null;
  projects: ClaudeProject[];
  plugins: ClaudePlugin[];
  skills: ClaudeSkill[];
  history: HistoryEntry[];
  activeSessions: string[];
}

export function useClaude() {
  const [data, setData] = useState<ClaudeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/claude');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 5 seconds for live updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

export function useProjects() {
  const [projects, setProjects] = useState<ClaudeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/claude/projects');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setProjects(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refresh: fetchProjects };
}

export function useSessionMessages(projectId: string | null, sessionId: string | null) {
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!projectId || !sessionId) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/claude/sessions/${projectId}/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setMessages(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId, sessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return { messages, loading, error, refresh: fetchMessages };
}
