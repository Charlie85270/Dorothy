'use client';
import { useMemo } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import { useElectronKanban } from '@/hooks/useElectronKanban';
import { COLUMN_CONFIG, COLUMN_ORDER, type KanbanColumn } from '@/types/kanban';
import PokemonMenu from '../overlays/PokemonMenu';

const COLUMN_BADGE_COLORS: Record<KanbanColumn, string> = {
  backlog: '#6b7280',
  planned: '#3b82f6',
  ongoing: '#f59e0b',
  done: '#22c55e',
};

const PRIORITY_SYMBOLS: Record<string, string> = {
  high: '!!!',
  medium: '!!',
  low: '!',
};

export default function KanbanCenterContent({ onExit }: InteriorContentProps) {
  const { tasks, isLoading } = useElectronKanban();

  const items: PokemonMenuItem[] = useMemo(() => {
    if (isLoading) {
      return [{ id: 'loading', name: 'Loading tasks...' }];
    }
    if (tasks.length === 0) {
      return [{ id: 'empty', name: 'No tasks yet' }];
    }
    // Sort by column order, then by order within column
    const sorted = [...tasks].sort((a, b) => {
      const colA = COLUMN_ORDER.indexOf(a.column);
      const colB = COLUMN_ORDER.indexOf(b.column);
      if (colA !== colB) return colA - colB;
      return a.order - b.order;
    });
    return sorted.map(task => ({
      id: task.id,
      name: task.title,
      description: task.description
        || `${COLUMN_CONFIG[task.column].title} | Priority: ${task.priority} | Progress: ${task.progress}%`,
      category: COLUMN_CONFIG[task.column].title,
      badge: COLUMN_CONFIG[task.column].title.toUpperCase(),
      badgeColor: COLUMN_BADGE_COLORS[task.column],
      installs: PRIORITY_SYMBOLS[task.priority] || '',
    }));
  }, [tasks, isLoading]);

  const actions = [
    { id: 'view', label: 'VIEW' },
    { id: 'leave', label: 'LEAVE' },
  ];

  const handleAction = (actionId: string, item: PokemonMenuItem) => {
    if (actionId === 'leave') {
      onExit();
    }
    // 'view' just shows the description in the bottom panel (already visible)
  };

  // Summary counts for the left panel
  const columnCounts = useMemo(() => {
    const counts: Record<KanbanColumn, number> = { backlog: 0, planned: 0, ongoing: 0, done: 0 };
    for (const task of tasks) {
      counts[task.column]++;
    }
    return counts;
  }, [tasks]);

  const leftPanel = (
    <div className="text-center" style={{ padding: '8px' }}>
      <div style={{
        fontSize: '24px',
        lineHeight: 1,
        marginBottom: '8px',
      }}>
        {/* Board icon using pixel art style */}
        <div style={{
          width: 64,
          height: 48,
          margin: '0 auto 8px',
          border: '3px solid #584830',
          borderRadius: '4px',
          background: '#3c3c5c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          padding: '4px',
        }}>
          {COLUMN_ORDER.map(col => (
            <div key={col} style={{
              flex: 1,
              height: '100%',
              background: COLUMN_BADGE_COLORS[col],
              borderRadius: '2px',
              opacity: 0.8,
            }} />
          ))}
        </div>
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        marginBottom: '12px',
      }}>
        Task Board
      </div>
      {/* Column counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
        {COLUMN_ORDER.map(col => (
          <div key={col} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '9px',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
          }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: COLUMN_BADGE_COLORS[col],
              flexShrink: 0,
            }} />
            <span style={{ width: '60px', textAlign: 'left' }}>
              {COLUMN_CONFIG[col].title.toUpperCase()}
            </span>
            <span style={{ opacity: 0.7 }}>
              x{columnCounts[col]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <PokemonMenu
      items={items}
      actions={actions}
      onAction={handleAction}
      onBack={onExit}
      leftPanelContent={leftPanel}
      title="KANBAN BOARD"
    />
  );
}
