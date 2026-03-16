'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { AgentTickItem, DisplayStatus } from '@/types/electron';
import TrayAgentItem from './TrayAgentItem';

type Tab = 'all' | 'working' | 'waiting' | 'ready' | 'idle';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'working', label: 'Working' },
  { key: 'waiting', label: 'Waiting for inputs' },
  { key: 'ready', label: 'Ready to work' },
  { key: 'idle', label: 'Idle' },
];

const IDLE_STATUSES: DisplayStatus[] = ['stopped', 'done', 'error'];

function matchesTab(tab: Tab, status: DisplayStatus): boolean {
  if (tab === 'all') return true;
  if (tab === 'idle') return IDLE_STATUSES.includes(status);
  return status === tab;
}

export default function TrayPanel() {
  const [agents, setAgents] = useState<AgentTickItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const prevWaitingCountRef = useRef(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  }, []);

  // Initial load from agent.list(), then tick takes over
  const fetchAgents = useCallback(async () => {
    if (!window.electronAPI?.agent?.list) return;
    try {
      const list = await window.electronAPI.agent.list();
      const mapped: AgentTickItem[] = list.map(a => ({
        id: a.id,
        name: a.name || `Agent ${a.id.slice(0, 6)}`,
        character: a.character || 'robot',
        status: a.status,
        displayStatus: deriveDisplayStatus(a),
        statusLine: a.statusLine || '',
        currentTask: a.currentTask || '',
        projectName: a.projectPath ? a.projectPath.split('/').pop() || '' : '',
        lastActivity: a.lastActivity,
        provider: a.provider || 'claude',
      }));
      setAgents(mapped);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Subscribe to agents:tick for live updates
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.agent?.onTick) return;

    const unsub = api.agent.onTick((tickAgents) => {
      setAgents(tickAgents);
    });

    return () => unsub();
  }, []);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { all: agents.length, working: 0, waiting: 0, ready: 0, idle: 0 };
    for (const a of agents) {
      if (a.displayStatus === 'working') counts.working++;
      else if (a.displayStatus === 'waiting') counts.waiting++;
      else if (a.displayStatus === 'ready') counts.ready++;
      else counts.idle++;
    }
    return counts;
  }, [agents]);

  // Auto-switch to Waiting tab when new agents enter waiting,
  // but NOT if the user has an expanded (active) terminal
  useEffect(() => {
    if (!expandedId && tabCounts.waiting > prevWaitingCountRef.current && tabCounts.waiting > 0) {
      setActiveTab('waiting');
    }
    prevWaitingCountRef.current = tabCounts.waiting;
  }, [tabCounts.waiting, expandedId]);

  // Filter + stable alphabetical sort.
  // Always include the expanded agent so interacting with it doesn't make it vanish.
  const filteredAgents = useMemo(() => {
    return agents
      .filter(a => a.id === expandedId || matchesTab(activeTab, a.displayStatus))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, activeTab, expandedId]);

  // Header summary
  const parts: string[] = [];
  if (tabCounts.working > 0) parts.push(`${tabCounts.working} working`);
  if (tabCounts.waiting > 0) parts.push(`${tabCounts.waiting} waiting`);
  if (parts.length === 0)
    parts.push(agents.length > 0 ? 'all idle' : 'no agents');

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-screen select-none bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="text-sm font-semibold text-foreground">Dorothy</div>
        <div className="text-xs text-muted-foreground mt-0.5">{parts.join(', ')}</div>
      </div>

      {/* Tabs */}
      {agents.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border flex-shrink-0">
          {TABS.map(tab => {
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] min-w-[16px] text-center px-1 rounded-full ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {agents.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No agents configured
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No {activeTab} agents
          </div>
        ) : (
          filteredAgents.map(agent => (
            <TrayAgentItem
              key={agent.id}
              agent={agent}
              expanded={expandedId === agent.id}
              onToggle={() => handleToggle(agent.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => window.electronAPI?.tray?.showMainWindow()}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Show Dorothy
        </button>
        <button
          onClick={() => window.electronAPI?.tray?.quit()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Quit
        </button>
      </div>
    </div>
  );
}

function deriveDisplayStatus(a: { status: string; ptyId?: string }): AgentTickItem['displayStatus'] {
  if (a.status === 'running') return 'working';
  if (a.status === 'waiting') return 'waiting';
  if (a.status === 'completed') return 'done';
  if (a.status === 'error') return 'error';
  if (a.status === 'idle' && a.ptyId) return 'ready';
  return 'stopped';
}
