import { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { SelectedLogs } from '../types';

export function useTaskLogs() {
  const [selectedLogs, setSelectedLogs] = useState<SelectedLogs | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const watchingTaskId = useRef<string | null>(null);

  const handleViewLogs = async (taskId: string) => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI?.scheduler?.getLogs(taskId);
      if (result) {
        const runs = result.runs || [];
        setSelectedLogs({
          taskId,
          logs: result.logs,
          runs,
          selectedRunIndex: runs.length > 0 ? runs.length - 1 : 0,
        });

        // Start watching for new log data
        watchingTaskId.current = taskId;
        window.electronAPI?.scheduler?.watchLogs(taskId);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Listen for streamed log data
  useEffect(() => {
    if (!isElectron() || !selectedLogs) return;

    const cleanup = window.electronAPI?.scheduler?.onLogData((event: { taskId: string; data: string }) => {
      if (event.taskId !== selectedLogs.taskId) return;

      setSelectedLogs((prev) => {
        if (!prev) return null;
        const runs = [...prev.runs];
        if (runs.length === 0) return prev;

        // Append new data to the last run's content
        const lastIdx = runs.length - 1;
        runs[lastIdx] = {
          ...runs[lastIdx],
          content: runs[lastIdx].content + event.data,
        };

        // Check if the data contains a completion marker
        if (event.data.includes('=== Task completed at')) {
          const match = event.data.match(/=== Task completed at (.+?) ===/);
          if (match) {
            runs[lastIdx] = { ...runs[lastIdx], completedAt: match[1] };
          }
        }

        // Check if a new run started in the streamed data
        if (event.data.includes('=== Task started at')) {
          const match = event.data.match(/=== Task started at (.+?) ===/);
          if (match) {
            runs.push({ startedAt: match[1], content: '' });
          }
        }

        return {
          ...prev,
          logs: prev.logs + event.data,
          runs,
          selectedRunIndex: prev.selectedRunIndex === lastIdx ? Math.max(0, runs.length - 1) : prev.selectedRunIndex,
        };
      });
    });

    return () => {
      cleanup?.();
    };
  }, [selectedLogs?.taskId]);

  // Clean up watcher when modal closes
  const closeHandler = useCallback(() => {
    if (watchingTaskId.current) {
      window.electronAPI?.scheduler?.unwatchLogs(watchingTaskId.current);
      watchingTaskId.current = null;
    }
    setSelectedLogs(null);
  }, []);

  // Also clean up on unmount
  useEffect(() => {
    return () => {
      if (watchingTaskId.current) {
        window.electronAPI?.scheduler?.unwatchLogs(watchingTaskId.current);
        watchingTaskId.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom when log content updates
  useEffect(() => {
    const el = logsContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [selectedLogs?.runs]);

  return {
    selectedLogs,
    setSelectedLogs,
    closeLogs: closeHandler,
    logsContainerRef,
    handleViewLogs,
  };
}
