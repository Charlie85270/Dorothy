import { CalendarClock, Plus } from 'lucide-react';
import type { ScheduledTask } from '../types';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: ScheduledTask[];
  expandedTasks: Set<string>;
  onToggleExpand: (taskId: string) => void;
  runningTaskId: string | null;
  runningTasks: Set<string>;
  onRun: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (taskId: string) => void;
  onCreateNew: () => void;
}

export function TaskList({
  tasks,
  expandedTasks,
  onToggleExpand,
  runningTaskId,
  runningTasks,
  onRun,
  onViewLogs,
  onEdit,
  onDelete,
  onCreateNew,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No scheduled tasks</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first scheduled task to automate recurring work.
        </p>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isExpanded={expandedTasks.has(task.id)}
          onToggleExpand={() => onToggleExpand(task.id)}
          isRunning={runningTaskId === task.id}
          runningTaskId={runningTaskId}
          onRun={onRun}
          onViewLogs={onViewLogs}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
