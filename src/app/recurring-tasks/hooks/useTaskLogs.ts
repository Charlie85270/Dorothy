import { useState, useEffect, useRef } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { SelectedLogs } from '../types';

export function useTaskLogs() {
  const [selectedLogs, setSelectedLogs] = useState<SelectedLogs | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

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
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Auto-poll logs every 2s when modal is open and current run is still running
  useEffect(() => {
    if (!selectedLogs) return;
    const currentRun = selectedLogs.runs[selectedLogs.selectedRunIndex];
    if (currentRun?.completedAt) return;

    const interval = setInterval(async () => {
      try {
        const result = await window.electronAPI?.scheduler?.getLogs(selectedLogs.taskId);
        if (result) {
          const runs = result.runs || [];
          setSelectedLogs((prev) => {
            if (!prev) return null;
            const wasOnLatest = prev.selectedRunIndex === prev.runs.length - 1;
            return {
              ...prev,
              logs: result.logs,
              runs,
              selectedRunIndex: wasOnLatest ? Math.max(0, runs.length - 1) : prev.selectedRunIndex,
            };
          });
        }
      } catch {
        // silent
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedLogs?.taskId, selectedLogs?.selectedRunIndex, selectedLogs?.runs[selectedLogs?.selectedRunIndex ?? 0]?.completedAt]);

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
    logsContainerRef,
    handleViewLogs,
  };
}
