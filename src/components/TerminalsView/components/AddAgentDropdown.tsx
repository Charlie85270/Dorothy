'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { CHARACTER_FACES, STATUS_COLORS } from '../constants';

interface AddAgentDropdownProps {
  allAgents: AgentStatus[];
  currentTabAgentIds: string[];
  onAddAgent: (agentId: string) => void;
  onCreateAgent: () => void;
}

export default function AddAgentDropdown({
  allAgents,
  currentTabAgentIds,
  onAddAgent,
  onCreateAgent,
}: AddAgentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset the query and focus the search field when the dropdown opens
  useEffect(() => {
    if (open) {
      setQuery('');
      searchRef.current?.focus();
    }
  }, [open]);

  // Agents not on current tab, grouped by project, filtered by search query
  const groups = useMemo(() => {
    const tabSet = new Set(currentTabAgentIds);
    const q = query.trim().toLowerCase();
    const available = allAgents.filter(a => {
      if (tabSet.has(a.id)) return false;
      if (!q) return true;
      const name = (a.name || `Agent ${a.id.slice(0, 6)}`).toLowerCase();
      const project = (a.projectPath.split('/').pop() || a.projectPath).toLowerCase();
      return name.includes(q) || project.includes(q);
    });

    const byProject = new Map<string, AgentStatus[]>();
    for (const agent of available) {
      const key = agent.projectPath;
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(agent);
    }

    return Array.from(byProject.entries()).map(([path, agents]) => ({
      projectName: path.split('/').pop() || path,
      projectPath: path,
      agents,
    }));
  }, [allAgents, currentTabAgentIds, query]);

  const totalAvailable = groups.reduce((sum, g) => sum + g.agents.length, 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
        style={{ borderRadius: 7 }}
        title="Add existing agent to this board"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Add agent to board</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-card border border-border shadow-xl z-50 min-w-[220px] max-h-[320px] overflow-y-auto">
          {/* Search input */}
          <div className="sticky top-0 z-10 bg-card border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search agents..."
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-primary/5 text-foreground placeholder:text-muted-foreground border border-transparent focus:border-border focus:outline-none rounded"
              />
            </div>
          </div>

          {totalAvailable === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {query.trim() ? 'No matching agents' : 'All agents are on this board'}
            </div>
          ) : (
            groups.map(group => (
              <div key={group.projectPath}>
                {/* Project header */}
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-primary/5 font-medium">
                  {group.projectName}
                </div>

                {/* Agent rows */}
                {group.agents.map(agent => {
                  const emoji = agent.name?.toLowerCase() === 'bitwonka'
                    ? '🐸'
                    : CHARACTER_FACES[agent.character || 'robot'] || '🤖';
                  const name = agent.name || `Agent ${agent.id.slice(0, 6)}`;
                  const status = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;

                  return (
                    <button
                      key={agent.id}
                      onClick={() => { onAddAgent(agent.id); setOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors"
                    >
                      <span>{emoji}</span>
                      <span className="truncate flex-1 text-left">{name}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {/* Create new agent entry */}
          <div className="border-t border-border">
            <button
              onClick={() => { setOpen(false); onCreateAgent(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create a new agent</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
