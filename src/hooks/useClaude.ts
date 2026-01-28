'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ClaudeSettings,
  ClaudeStats,
  ClaudeProject,
  ClaudePlugin,
  ClaudeSkill,
  ClaudeSession,
  HistoryEntry,
  ClaudeMessage,
} from '@/lib/claude-code';
import { isElectron } from './useElectron';

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

      // Use IPC in Electron, API in browser
      if (isElectron() && window.electronAPI?.claude?.getData) {
        const result = await window.electronAPI.claude.getData();
        if (result) {
          // Transform the result to match expected types
          // Electron returns lastAccessed as number (ms timestamp), frontend expects lastActivity as Date
          interface ElectronProject {
            id: string;
            path: string;
            name: string;
            sessions: Array<{ id: string; timestamp: number }>;
            lastAccessed: number;
          }

          const rawProjects = (result.projects || []) as ElectronProject[];
          const transformedProjects = rawProjects.map((p) => ({
            id: p.id,
            name: p.name,
            path: p.path,
            sessions: (p.sessions || []).map(s => ({
              id: s.id,
              projectPath: p.path,
              messages: [] as ClaudeMessage[],
              startTime: new Date(s.timestamp),
              lastActivity: new Date(s.timestamp),
            })),
            lastActivity: new Date(p.lastAccessed),
          }));

          setData({
            settings: result.settings as ClaudeSettings | null,
            stats: result.stats as ClaudeStats | null,
            projects: transformedProjects,
            plugins: (result.plugins || []) as ClaudePlugin[],
            skills: (result.skills || []) as ClaudeSkill[],
            history: (result.history || []) as HistoryEntry[],
            activeSessions: (result.activeSessions || []) as string[],
          });
          setError(null);
        } else {
          throw new Error('Failed to get Claude data from Electron');
        }
      } else {
        const response = await fetch('/api/claude');
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 10 seconds to reduce CPU usage
    const interval = setInterval(fetchData, 10000);
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
