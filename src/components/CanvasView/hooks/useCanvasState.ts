import { useState, useCallback, useMemo, useEffect } from 'react';
import { CANVAS_STATE_KEY } from '../constants';
import type { CanvasState } from '../types';

function loadSavedState(): Partial<CanvasState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(CANVAS_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load canvas state:', e);
  }
  return null;
}

export function useCanvasState() {
  const savedState = useMemo(() => loadSavedState(), []);

  const [agentPositions, setAgentPositions] = useState<Record<string, { x: number; y: number }>>(
    savedState?.agentPositions || {}
  );
  const [projectPositions, setProjectPositions] = useState<Record<string, { x: number; y: number }>>(
    savedState?.projectPositions || {}
  );
  const [zoom, setZoom] = useState(savedState?.zoom || 1);
  const [panOffset, setPanOffset] = useState(savedState?.panOffset || { x: 0, y: 0 });
  const [notificationPanelCollapsed, setNotificationPanelCollapsed] = useState(
    savedState?.notificationPanelCollapsed ?? false
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stateToSave: CanvasState = {
      agentPositions,
      projectPositions,
      panOffset,
      zoom,
      notificationPanelCollapsed,
    };
    try {
      localStorage.setItem(CANVAS_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save canvas state:', e);
    }
  }, [agentPositions, projectPositions, panOffset, zoom, notificationPanelCollapsed]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNodeId(null);
  }, []);

  const fullReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setAgentPositions({});
    setProjectPositions({});
    setSelectedNodeId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CANVAS_STATE_KEY);
    }
  }, []);

  const updateAgentPosition = useCallback((id: string, delta: { x: number; y: number }, currentPos?: { x: number; y: number }) => {
    setAgentPositions((prev) => {
      const current = prev[id] || currentPos || { x: 0, y: 0 };
      return {
        ...prev,
        [id]: { x: current.x + delta.x, y: current.y + delta.y },
      };
    });
  }, []);

  const updateProjectPosition = useCallback((id: string, delta: { x: number; y: number }, currentPos?: { x: number; y: number }) => {
    setProjectPositions((prev) => {
      const current = prev[id] || currentPos || { x: 0, y: 0 };
      return {
        ...prev,
        [id]: { x: current.x + delta.x, y: current.y + delta.y },
      };
    });
  }, []);

  return {
    // State
    agentPositions,
    projectPositions,
    zoom,
    panOffset,
    notificationPanelCollapsed,
    selectedNodeId,
    // Setters
    setZoom,
    setPanOffset,
    setNotificationPanelCollapsed,
    setSelectedNodeId,
    // Actions
    updateAgentPosition,
    updateProjectPosition,
    resetView,
    fullReset,
  };
}

export type CanvasStateHook = ReturnType<typeof useCanvasState>;
