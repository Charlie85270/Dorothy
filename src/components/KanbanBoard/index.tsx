'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, RefreshCw, Search } from 'lucide-react';
import { useElectronKanban, useKanbanAgentSync } from '@/hooks/useElectronKanban';
import { isElectron as checkIsElectron } from '@/hooks/useElectron';
import type { KanbanTask, KanbanColumn as KanbanColumnType, KanbanTaskCreate } from '@/types/kanban';
import type { AgentStatus } from '@/types/electron';
import { KanbanColumn } from './components/KanbanColumn';
import { KanbanCard } from './components/KanbanCard';
import { NewTaskModal } from './components/NewTaskModal';
import { KanbanCardDetail } from './components/KanbanCardDetail';
import { KanbanDoneSummary } from './components/KanbanDoneSummary';
import { COLUMN_ORDER } from './constants';

// Lazy load the terminal dialog
const AgentTerminalDialog = dynamic(
  () => import('@/components/AgentWorld/AgentTerminalDialog'),
  { ssr: false }
);

export default function KanbanBoard() {
  const {
    tasks,
    isLoading,
    error,
    isElectron,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    reorderTasks,
    getTasksByColumn,
    refresh,
  } = useElectronKanban();

  // Enable agent sync
  useKanbanAgentSync(tasks, updateTask, moveTask);

  // Modal states
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  // Terminal dialog state
  const [terminalAgentId, setTerminalAgentId] = useState<string | null>(null);
  const [terminalAgent, setTerminalAgent] = useState<AgentStatus | null>(null);

  // Fetch agent when terminal is opened
  useEffect(() => {
    if (!terminalAgentId || !checkIsElectron()) {
      setTerminalAgent(null);
      return;
    }

    const fetchAgent = async () => {
      try {
        const agent = await window.electronAPI?.agent?.get(terminalAgentId);
        setTerminalAgent(agent || null);
      } catch (err) {
        console.error('Failed to fetch agent:', err);
        setTerminalAgent(null);
      }
    };

    fetchAgent();
  }, [terminalAgentId]);

  // Handle opening terminal for an agent
  const handleOpenTerminal = useCallback((agentId: string) => {
    setTerminalAgentId(agentId);
  }, []);

  // Handle closing terminal
  const handleCloseTerminal = useCallback(() => {
    setTerminalAgentId(null);
    setTerminalAgent(null);
  }, []);

  // Agent start/stop handlers for terminal dialog
  const handleAgentStart = useCallback(async (agentId: string, prompt: string) => {
    if (checkIsElectron() && window.electronAPI?.agent?.start) {
      await window.electronAPI.agent.start({ id: agentId, prompt });
      // Refresh agent state
      const agent = await window.electronAPI?.agent?.get(agentId);
      setTerminalAgent(agent || null);
    }
  }, []);

  const handleAgentStop = useCallback(async (agentId: string) => {
    if (checkIsElectron() && window.electronAPI?.agent?.stop) {
      await window.electronAPI.agent.stop(agentId);
      // Refresh agent state
      const agent = await window.electronAPI?.agent?.get(agentId);
      setTerminalAgent(agent || null);
    }
  }, []);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string | null>(null);

  // Drag state
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.labels.some((l) => l.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Project filter
      if (filterProject && task.projectId !== filterProject) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, filterProject]);

  // Get filtered tasks by column
  const getFilteredTasksByColumn = useCallback(
    (column: KanbanColumnType) => {
      return filteredTasks
        .filter((t) => t.column === column)
        .sort((a, b) => a.order - b.order);
    },
    [filteredTasks]
  );

  // Get unique projects for filter
  const projects = useMemo(() => {
    const uniqueProjects = new Map<string, string>();
    tasks.forEach((task) => {
      if (!uniqueProjects.has(task.projectId)) {
        uniqueProjects.set(task.projectId, task.projectPath.split('/').pop() || task.projectId);
      }
    });
    return Array.from(uniqueProjects.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could add visual feedback here
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if dropped on a column
    const overColumn = COLUMN_ORDER.find((c) => c === overId);
    if (overColumn) {
      // Moving to a different column
      if (activeTask.column !== overColumn) {
        console.log(`Moving task to column: ${overColumn}`);
        const result = await moveTask(activeId, overColumn);
        if (result.agentSpawned) {
          console.log(`Agent ${result.agentId} spawned for task`);
        }
      }
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      if (activeTask.column === overTask.column) {
        // Reorder within same column
        const columnTasks = getFilteredTasksByColumn(activeTask.column);
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);

        if (oldIndex !== newIndex) {
          const newOrder = [...columnTasks];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);
          await reorderTasks(
            newOrder.map((t) => t.id),
            activeTask.column
          );
        }
      } else {
        // Move to different column at specific position
        await moveTask(activeId, overTask.column, overTask.order);
      }
    }
  }, [tasks, moveTask, reorderTasks, getFilteredTasksByColumn]);

  // Task handlers
  const handleCreateTask = async (data: KanbanTaskCreate) => {
    await createTask(data);
    setShowNewTaskModal(false);
  };

  const handleEditTask = (task: KanbanTask) => {
    setEditingTask(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId);
    }
  };

  const handleUpdateTask = async (data: Partial<KanbanTask>) => {
    if (editingTask) {
      await updateTask({ id: editingTask.id, ...data });
      setEditingTask(null);
    }
  };

  // Non-Electron fallback
  if (!isElectron) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Kanban board is only available in the desktop app</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Task Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag to Planned to auto-assign agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            />
          </div>

          {/* Project filter */}
          {projects.length > 1 && (
            <select
              value={filterProject || ''}
              onChange={(e) => setFilterProject(e.target.value || null)}
              className="px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Refresh button */}
          <button
            onClick={refresh}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Add task button */}
          <button
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
          >
            New Task
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full w-full">
            {COLUMN_ORDER.map((column) => (
              <KanbanColumn
                key={column}
                column={column}
                tasks={getFilteredTasksByColumn(column)}
                onAddTask={column === 'backlog' ? () => setShowNewTaskModal(true) : undefined}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onStartTask={moveTask}
                onOpenTerminal={handleOpenTerminal}
                activeTaskId={activeTask?.id}
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTask && (
              <div className="w-[280px]">
                <KanbanCard task={activeTask} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* New task modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <NewTaskModal
            onClose={() => setShowNewTaskModal(false)}
            onCreate={handleCreateTask}
          />
        )}
      </AnimatePresence>

      {/* Edit task modal (for backlog/planned tasks only) */}
      <AnimatePresence>
        {editingTask && editingTask.column !== 'done' && editingTask.column !== 'ongoing' && (
          <KanbanCardDetail
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onUpdate={handleUpdateTask}
            onDelete={() => {
              handleDeleteTask(editingTask.id);
              setEditingTask(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Done task summary modal */}
      <AnimatePresence>
        {editingTask && editingTask.column === 'done' && (
          <KanbanDoneSummary
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onDelete={() => {
              handleDeleteTask(editingTask.id);
              setEditingTask(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Agent Terminal Dialog - skip historical output to avoid display issues */}
      {terminalAgentId && terminalAgent && (
        <AgentTerminalDialog
          agent={terminalAgent}
          open={!!terminalAgentId}
          onClose={handleCloseTerminal}
          onStart={handleAgentStart}
          onStop={handleAgentStop}
          skipHistoricalOutput={true}
        />
      )}
    </div>
  );
}
