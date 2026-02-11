import type { KanbanColumn } from '@/types/kanban';

export const COLUMN_CONFIG: Record<KanbanColumn, {
  title: string;
  accentColor: string;
  emptyText: string;
}> = {
  backlog: {
    title: 'TODO',
    accentColor: 'bg-zinc-500',
    emptyText: 'No tasks yet',
  },
  planned: {
    title: 'PLANNED',
    accentColor: 'bg-blue-500',
    emptyText: 'Drop tasks here',
  },
  ongoing: {
    title: 'IN WORK',
    accentColor: 'bg-amber-500',
    emptyText: 'No tasks in progress',
  },
  done: {
    title: 'COMPLETED',
    accentColor: 'bg-green-500',
    emptyText: 'No completed tasks',
  },
};

export const COLUMN_ORDER: KanbanColumn[] = ['backlog', 'planned', 'ongoing', 'done'];

export const PRIORITY_CONFIG: Record<string, {
  label: string;
  textColor: string;
  bgColor: string;
}> = {
  low: {
    label: 'Low',
    textColor: 'text-zinc-600 dark:text-zinc-400',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
  },
  medium: {
    label: 'Medium',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
  },
  high: {
    label: 'High',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
  },
};

export const LABEL_COLORS = [
  { bg: 'bg-purple-600/15', text: 'text-purple-700' },
  { bg: 'bg-blue-600/15', text: 'text-blue-700' },
  { bg: 'bg-primary/15', text: 'text-primary' },
  { bg: 'bg-orange-600/15', text: 'text-orange-700' },
  { bg: 'bg-rose-600/15', text: 'text-rose-700' },
  { bg: 'bg-cyan-600/15', text: 'text-cyan-700' },
];

export function getLabelColor(label: string) {
  // Generate consistent color based on label string
  const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return LABEL_COLORS[hash % LABEL_COLORS.length];
}
