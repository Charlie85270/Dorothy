'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import { isElectron } from '@/hooks/useElectron';
import PokemonMenu from '../overlays/PokemonMenu';

interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string;
  scheduleHuman: string;
  projectPath: string;
  agentName?: string;
  autonomous: boolean;
  notifications: { telegram: boolean; slack: boolean };
  lastRun?: string;
  lastRunStatus?: 'success' | 'error';
  nextRun?: string;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  SUCCESS: '#22c55e',
  FAILED: '#ef4444',
  PENDING: '#6b7280',
};

function formatNextRun(nextRun: string | undefined): string | null {
  if (!nextRun) return null;
  const now = new Date();
  const next = new Date(nextRun);
  const diffMs = next.getTime() - now.getTime();
  if (diffMs < 0) return null;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return '< 1 min';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export default function SchedulerContent({ onExit }: InteriorContentProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!isElectron() || !window.electronAPI?.scheduler) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await window.electronAPI.scheduler.listTasks();
      if (result?.tasks) {
        setTasks(result.tasks as ScheduledTask[]);
      }
    } catch (err) {
      console.error('Failed to load scheduled tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const items: PokemonMenuItem[] = useMemo(() => {
    if (isLoading) {
      return [{ id: 'loading', name: 'Loading tasks...' }];
    }
    if (tasks.length === 0) {
      return [{ id: 'empty', name: 'No scheduled tasks' }];
    }
    return tasks.map(task => {
      const status = task.lastRunStatus
        ? task.lastRunStatus === 'success' ? 'SUCCESS' : 'FAILED'
        : 'PENDING';
      const next = formatNextRun(task.nextRun);
      const schedule = task.scheduleHuman || task.schedule;
      const project = task.projectPath.split('/').pop() || task.projectPath;
      const agent = task.agentName ? ` | Agent: ${task.agentName}` : '';

      return {
        id: task.id,
        name: task.prompt.length > 40 ? task.prompt.substring(0, 37) + '...' : task.prompt,
        description: `${task.prompt}\n\nSchedule: ${schedule}${agent} | Project: ${project}${next ? ` | Next: ${next}` : ''}${task.lastRun ? ` | Last: ${new Date(task.lastRun).toLocaleString()}` : ''}`,
        badge: status,
        badgeColor: STATUS_BADGE_COLORS[status],
        installs: next ? `~${next}` : '',
      };
    });
  }, [tasks, isLoading]);

  const actions = [
    { id: 'view', label: 'VIEW' },
    { id: 'leave', label: 'LEAVE' },
  ];

  const handleAction = (actionId: string, _item: PokemonMenuItem) => {
    if (actionId === 'leave') {
      onExit();
    }
  };

  // Summary counts
  const counts = useMemo(() => {
    let success = 0, failed = 0, pending = 0;
    for (const t of tasks) {
      if (t.lastRunStatus === 'success') success++;
      else if (t.lastRunStatus === 'error') failed++;
      else pending++;
    }
    return { total: tasks.length, success, failed, pending };
  }, [tasks]);

  const leftPanel = (
    <div className="text-center" style={{ padding: '8px' }}>
      {/* Clock icon */}
      <div style={{
        width: 56,
        height: 56,
        margin: '0 auto 8px',
        border: '3px solid #584830',
        borderRadius: '50%',
        background: '#f0e8d0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 2, height: 16,
          background: '#484848',
          position: 'absolute',
          bottom: '50%',
          transformOrigin: 'bottom',
          transform: 'rotate(-30deg)',
        }} />
        <div style={{
          width: 2, height: 12,
          background: '#484848',
          position: 'absolute',
          bottom: '50%',
          transformOrigin: 'bottom',
          transform: 'rotate(60deg)',
        }} />
        <div style={{
          width: 4, height: 4,
          background: '#484848',
          borderRadius: '50%',
          position: 'absolute',
        }} />
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        marginBottom: '12px',
      }}>
        Scheduler
      </div>
      {/* Status counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
          <span style={{ width: '60px', textAlign: 'left' }}>TOTAL</span>
          <span style={{ opacity: 0.7 }}>x{counts.total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
          <span style={{ width: '60px', textAlign: 'left' }}>SUCCESS</span>
          <span style={{ opacity: 0.7 }}>x{counts.success}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
          <span style={{ width: '60px', textAlign: 'left' }}>FAILED</span>
          <span style={{ opacity: 0.7 }}>x{counts.failed}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6b7280', flexShrink: 0 }} />
          <span style={{ width: '60px', textAlign: 'left' }}>PENDING</span>
          <span style={{ opacity: 0.7 }}>x{counts.pending}</span>
        </div>
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
      title="SCHEDULED TASKS"
    />
  );
}
