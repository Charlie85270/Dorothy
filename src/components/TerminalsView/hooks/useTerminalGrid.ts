'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Layout, LayoutItem, GridLayoutProps } from 'react-grid-layout';
import type { LayoutPreset, TerminalPanelState } from '../types';
import { LAYOUT_PRESETS } from '../constants';
import { generateLayout, layoutsEqual, mergeLayoutWithPanels } from '../utils/gridLayout';
import { getLayout, saveLayout } from './useGridLayoutStorage';

interface UseTerminalGridOptions {
  agentIds: string[];
  preset: LayoutPreset;   // from tab, not computed internally
  isEditable: boolean;    // false for project tabs
  tabId: string;          // for layout persistence key
}

export function useTerminalGrid({ agentIds, preset, isEditable, tabId }: UseTerminalGridOptions) {
  const [fullscreenPanelId, setFullscreenPanelId] = useState<string | null>(null);
  const [panels, setPanels] = useState<TerminalPanelState[]>([]);
  const [rglLayout, setRglLayout] = useState<LayoutItem[]>([]);

  // Keep a ref to the current layout so the reconcile effect can read it
  // without having it as a dependency (which would cause infinite loops).
  const rglLayoutRef = useRef<LayoutItem[]>([]);
  useEffect(() => { rglLayoutRef.current = rglLayout; }, [rglLayout]);

  // Track the last tab+preset combo we actually processed with visible panels.
  const processedKeyRef = useRef<string | null>(null);

  const gridDefinition = LAYOUT_PRESETS[fullscreenPanelId ? 'single' : preset];

  // Sync panels with agent IDs
  useEffect(() => {
    setPanels(prev => {
      const existingIds = new Set(prev.map(p => p.agentId));
      const newIds = new Set(agentIds);
      const kept = prev.filter(p => newIds.has(p.agentId));
      const added = agentIds
        .filter(id => !existingIds.has(id))
        .map(id => ({ agentId: id, isFullscreen: false, isFocused: false }));
      if (added.length === 0 && kept.length === prev.length) return prev;
      const panelMap = new Map([...kept, ...added].map(p => [p.agentId, p]));
      return agentIds.map(id => panelMap.get(id)!).filter(Boolean);
    });
  }, [agentIds]);

  // Visible panels — capped at maxPanels for the current preset
  const maxPanels = gridDefinition.maxPanels;
  const visiblePanels = useMemo(() => {
    if (fullscreenPanelId) {
      return panels.filter(p => p.agentId === fullscreenPanelId);
    }
    return panels.slice(0, maxPanels);
  }, [panels, fullscreenPanelId, maxPanels]);

  // --- Generate / reconcile RGL layout ---
  // This is the ONLY place layout state is set programmatically.
  // onLayoutChange is intentionally a no-op (see below).
  useEffect(() => {
    if (fullscreenPanelId) return;

    const visibleIds = visiblePanels.map(p => p.agentId);
    if (visibleIds.length === 0) {
      if (rglLayoutRef.current.length > 0) {
        setRglLayout([]);
      }
      return;
    }

    const cols = gridDefinition.cols;
    const rows = gridDefinition.rows;
    const currentKey = `${tabId}::${preset}`;
    const needsFreshLoad =
      processedKeyRef.current !== currentKey ||
      rglLayoutRef.current.length === 0;
    processedKeyRef.current = currentKey;

    let newLayout: LayoutItem[];

    if (needsFreshLoad) {
      if (isEditable) {
        const saved = getLayout(tabId, preset, cols, rows);
        newLayout = mergeLayoutWithPanels(saved, visibleIds, cols, rows);
      } else {
        newLayout = generateLayout(visibleIds, cols).map(item => ({
          ...item, static: true,
        }));
      }
    } else {
      // Reconcile agent additions/removals within the same tab+preset
      const current = rglLayoutRef.current;
      const currentIdSet = new Set(current.map(item => item.i));
      const visibleIdSet = new Set(visibleIds);

      const kept = current.filter(item => visibleIdSet.has(item.i));
      const addedIds = visibleIds.filter(id => !currentIdSet.has(id));

      if (addedIds.length === 0 && kept.length === current.length) return;

      const maxY = kept.length > 0 ? Math.max(...kept.map(item => item.y + item.h)) : 0;
      const newItems: LayoutItem[] = addedIds.map((id, i) => ({
        i: id,
        x: (kept.length + i) % cols,
        y: maxY + Math.floor((kept.length + i) / cols),
        w: 1, h: 1,
      }));

      newLayout = isEditable
        ? [...kept, ...newItems]
        : [...kept, ...newItems].map(item => ({ ...item, static: true }));
    }

    if (!layoutsEqual(rglLayoutRef.current, newLayout)) {
      setRglLayout(newLayout);
    }
  }, [visiblePanels, gridDefinition, fullscreenPanelId, tabId, preset, isEditable]);

  // onDragStop — the ONLY callback that updates layout state from user interaction.
  // RGL 2.x handles drag visuals internally via CSS transforms, so we don't need
  // onLayoutChange to update state during drag. This completely eliminates the
  // mount/resize cascade bug where onLayoutChange would overwrite saved positions.
  const onDragStop: NonNullable<GridLayoutProps['onDragStop']> = useCallback((layout) => {
    setRglLayout([...layout] as LayoutItem[]);
    if (isEditable) {
      saveLayout(tabId, preset, layout as LayoutItem[]);
    }
  }, [tabId, preset, isEditable]);

  // Fullscreen controls
  const fullscreenPanel = useCallback((agentId: string) => setFullscreenPanelId(agentId), []);
  const exitFullscreen = useCallback(() => setFullscreenPanelId(null), []);
  const toggleFullscreen = useCallback((agentId?: string) => {
    if (fullscreenPanelId) setFullscreenPanelId(null);
    else if (agentId) setFullscreenPanelId(agentId);
  }, [fullscreenPanelId]);

  return {
    layout: preset,
    rglLayout: rglLayout as Layout,
    onDragStop,
    cols: gridDefinition.cols,
    gridDefinition,
    panels,
    visiblePanels,
    fullscreenPanelId,
    fullscreenPanel,
    exitFullscreen,
    toggleFullscreen,
  };
}
