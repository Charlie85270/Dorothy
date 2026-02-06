'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { KanbanTask, KanbanColumn, KanbanTaskCreate, KanbanTaskUpdate, KanbanMoveResult } from '@/types/kanban';
import { isElectron } from './useElectron';

/**
 * Hook for Kanban board management via Electron IPC
 */
export function useElectronKanban() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tasks
  const fetchTasks = useCallback(async () => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.kanban.list();
      if (result.error) {
        setError(result.error);
      } else {
        setTasks(result.tasks as KanbanTask[]);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch kanban tasks:', err);
      setError('Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new task
  // Note: State is updated via onTaskCreated event to avoid duplicates
  const createTask = useCallback(async (params: KanbanTaskCreate) => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.kanban.create(params);
    return result;
  }, []);

  // Update a task
  // Note: State is updated via onTaskUpdated event
  const updateTask = useCallback(async (params: KanbanTaskUpdate) => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.kanban.update(params);
    return result;
  }, []);

  // Move a task to a different column
  // Note: State is updated via onTaskUpdated event
  const moveTask = useCallback(async (
    id: string,
    column: KanbanColumn,
    order?: number
  ): Promise<KanbanMoveResult> => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.kanban.move({ id, column, order });
    return result as KanbanMoveResult;
  }, []);

  // Delete a task
  // Note: State is updated via onTaskDeleted event
  const deleteTask = useCallback(async (id: string) => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.kanban.delete(id);
    return result;
  }, []);

  // Reorder tasks within a column
  // Note: State is updated via onTaskUpdated events
  const reorderTasks = useCallback(async (taskIds: string[], column: KanbanColumn) => {
    if (!isElectron() || !window.electronAPI?.kanban) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.kanban.reorder({ taskIds, column });
    return result;
  }, []);

  // Get tasks by column
  const getTasksByColumn = useCallback((column: KanbanColumn): KanbanTask[] => {
    return tasks
      .filter(t => t.column === column)
      .sort((a, b) => a.order - b.order);
  }, [tasks]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.kanban) return;

    const unsubCreated = window.electronAPI.kanban.onTaskCreated((task) => {
      setTasks(prev => {
        // Check if task already exists (might have been added by our own action)
        if (prev.some(t => t.id === task.id)) {
          return prev;
        }
        return [...prev, task as KanbanTask];
      });
    });

    const unsubUpdated = window.electronAPI.kanban.onTaskUpdated((task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task as KanbanTask : t));
    });

    const unsubDeleted = window.electronAPI.kanban.onTaskDeleted((event: { id: string }) => {
      setTasks(prev => prev.filter(t => t.id !== event.id));
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    isElectron: isElectron(),
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    reorderTasks,
    getTasksByColumn,
    refresh: fetchTasks,
  };
}

/**
 * Hook to sync agent events with kanban tasks
 * Updates task progress and moves to "done" when agent completes
 */
export function useKanbanAgentSync(
  tasks: KanbanTask[],
  updateTask: (params: KanbanTaskUpdate) => Promise<unknown>,
  moveTask: (id: string, column: KanbanColumn) => Promise<unknown>
) {
  // Use ref to always have latest tasks without re-subscribing
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;

  const moveTaskRef = useRef(moveTask);
  moveTaskRef.current = moveTask;

  useEffect(() => {
    if (!isElectron()) return;

    console.log('[Kanban Sync] Setting up agent event listeners');

    // Listen to agent status changes - only for progress updates, NOT for completion
    // The detectAgentStatus patterns are too broad and trigger false "completed" states
    const unsubStatus = window.electronAPI?.agent.onStatus?.((event: {
      agentId: string;
      status: string;
      timestamp: string;
    }) => {
      // Find task assigned to this agent
      const task = tasksRef.current.find(t => t.assignedAgentId === event.agentId);
      if (!task || task.column !== 'ongoing') return;

      // Only update progress for running status, NOT for completion
      // Completion is handled by onComplete (PTY exit) which is more reliable
      if (event.status === 'running' && task.progress < 50) {
        updateTaskRef.current({ id: task.id, progress: 50 });
      }
    });

    // onComplete fires when PTY actually exits - this is the reliable completion signal
    const unsubComplete = window.electronAPI?.agent.onComplete(async (event) => {
      console.log(`[Kanban Sync] Received complete event:`, event);

      const task = tasksRef.current.find(t => t.assignedAgentId === event.agentId);
      if (!task) {
        console.log(`[Kanban Sync] No task found for agent ${event.agentId}`);
        return;
      }

      console.log(`[Kanban Sync] Agent ${event.agentId} completed with exit code: ${event.exitCode} for task "${task.title}"`);

      if (task.column === 'ongoing') {
        const isSuccess = event.exitCode === 0;
        console.log(`[Kanban Sync] Moving task ${task.id} to done (success: ${isSuccess})`);

        // Get agent output for completion summary
        let completionSummary = isSuccess ? 'Task completed successfully.' : 'Task completed with errors.';
        try {
          const agent = await window.electronAPI?.agent.get(event.agentId);
          if (agent?.output && agent.output.length > 0) {
            // Get last 50 lines of output as summary (or less if not available)
            const outputLines = agent.output.slice(-50);
            completionSummary = outputLines.join('');
          }
        } catch (err) {
          console.error('[Kanban Sync] Failed to get agent output:', err);
        }

        updateTaskRef.current({ id: task.id, progress: 100, completionSummary });
        moveTaskRef.current(task.id, 'done');
      }
    });

    return () => {
      unsubStatus?.();
      unsubComplete?.();
    };
  }, []); // Empty deps - we use refs to avoid re-subscribing
}
