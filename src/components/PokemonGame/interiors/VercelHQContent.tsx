'use client';
import { useMemo } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import PokemonMenu from '../overlays/PokemonMenu';

const VERCEL_RULES: { name: string; description: string; category: string; priority: string }[] = [
  { name: 'Eliminating Waterfalls', description: 'Defer await, use Promise.all(), Suspense boundaries', category: 'async', priority: 'CRITICAL' },
  { name: 'Bundle Size Optimization', description: 'Avoid barrel imports, dynamic imports, defer third-party', category: 'bundle', priority: 'CRITICAL' },
  { name: 'Server-Side Performance', description: 'Auth actions, React.cache(), LRU cache, parallel fetching', category: 'server', priority: 'HIGH' },
  { name: 'Client-Side Data Fetching', description: 'SWR dedup, passive listeners, localStorage schema', category: 'client', priority: 'MEDIUM-HIGH' },
  { name: 'Re-render Optimization', description: 'Defer reads, memo, derived state, functional setState', category: 'rerender', priority: 'MEDIUM' },
  { name: 'Rendering Performance', description: 'content-visibility, hoist JSX, SVG precision, Activity', category: 'rendering', priority: 'MEDIUM' },
  { name: 'JavaScript Performance', description: 'Batch DOM, index maps, Set/Map lookups, early exit', category: 'js', priority: 'LOW-MEDIUM' },
  { name: 'Advanced Patterns', description: 'Event handler refs, init once, useLatest', category: 'advanced', priority: 'LOW' },
];

export default function VercelHQContent({ onExit }: InteriorContentProps) {
  const items: PokemonMenuItem[] = useMemo(() => {
    return VERCEL_RULES.map((rule, i) => ({
      id: `rule-${i}`,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      badge: rule.priority,
      badgeColor: rule.priority === 'CRITICAL' ? '#dc2626' : rule.priority === 'HIGH' ? '#ea580c' : rule.priority.startsWith('MEDIUM') ? '#ca8a04' : '#6b7280',
    }));
  }, []);

  const actions = [
    { id: 'leave', label: 'LEAVE' },
  ];

  const handleAction = (actionId: string) => {
    if (actionId === 'leave') {
      onExit();
    }
  };

  const leftPanel = (
    <div className="text-center">
      <div style={{
        width: 64,
        height: 64,
        margin: '0 auto',
        borderRadius: '50%',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>V</span>
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        marginTop: '4px',
      }}>
        Vercel HQ
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
      title="BEST PRACTICES"
    />
  );
}
