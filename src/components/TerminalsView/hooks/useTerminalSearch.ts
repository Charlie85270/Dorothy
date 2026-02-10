'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AgentStatus } from '@/types/electron';

interface SearchResult {
  agentId: string;
  agentName: string;
  lineIndex: number;
  line: string;
  matchStart: number;
  matchEnd: number;
}

export function useTerminalSearch(agents: AgentStatus[]) {
  const [searchQuery, setSearchQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase();
    const matches: SearchResult[] = [];

    for (const agent of agents) {
      const name = agent.name || `Agent ${agent.id.slice(0, 6)}`;
      for (let i = 0; i < agent.output.length; i++) {
        // Strip ANSI escape codes for searching
        const clean = agent.output[i].replace(/\x1b\[[0-9;]*m/g, '');
        const lower = clean.toLowerCase();
        const idx = lower.indexOf(query);
        if (idx !== -1) {
          matches.push({
            agentId: agent.id,
            agentName: name,
            lineIndex: i,
            line: clean.slice(Math.max(0, idx - 40), idx + query.length + 40),
            matchStart: idx - Math.max(0, idx - 40),
            matchEnd: idx - Math.max(0, idx - 40) + query.length,
          });
        }
      }
    }

    return matches.slice(0, 100); // Cap results
  }, [searchQuery, agents]);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  return {
    searchQuery,
    setSearchQuery,
    results,
    clearSearch,
    hasResults: results.length > 0,
  };
}
