'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Sparkles, FolderKanban, X } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import SidebarAgentList from './SidebarAgentList';
import SidebarSkillsPalette from './SidebarSkillsPalette';
import SidebarProjectBrowser from './SidebarProjectBrowser';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  agents: AgentStatus[];
  focusedPanelId: string | null;
  onFocusPanel: (agentId: string) => void;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  installedSkills: string[];
}

type SidebarTab = 'agents' | 'skills' | 'projects';

export default function Sidebar({
  open,
  onClose,
  agents,
  focusedPanelId,
  onFocusPanel,
  onStartAgent,
  onStopAgent,
  installedSkills,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('agents');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing on the same click that opened it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, x: 10, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute top-0 right-0 z-50 flex flex-col bg-card border border-border shadow-2xl overflow-hidden"
          style={{ width: 300, maxHeight: 'calc(100% - 32px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-foreground">Panel</span>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tab buttons */}
          <div className="flex border-b border-border">
            {([
              { id: 'agents' as const, icon: Users, label: 'Agents' },
              { id: 'skills' as const, icon: Sparkles, label: 'Skills' },
              { id: 'projects' as const, icon: FolderKanban, label: 'Projects' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium transition-colors
                  ${tab === t.id
                    ? 'text-foreground border-b-2 border-white'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'agents' && (
              <SidebarAgentList
                agents={agents}
                focusedPanelId={focusedPanelId}
                onFocusPanel={(id) => { onFocusPanel(id); onClose(); }}
                onStartAgent={onStartAgent}
                onStopAgent={onStopAgent}
              />
            )}
            {tab === 'skills' && (
              <SidebarSkillsPalette installedSkills={installedSkills} />
            )}
            {tab === 'projects' && (
              <SidebarProjectBrowser agents={agents} onFocusPanel={(id) => { onFocusPanel(id); onClose(); }} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
