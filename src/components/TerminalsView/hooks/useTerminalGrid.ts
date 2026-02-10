'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Layout, LayoutItem } from 'react-grid-layout';
import type { LayoutPreset, TerminalPanelState, GridDefinition } from '../types';
import { LAYOUT_PRESETS } from '../constants';

interface UseTerminalGridOptions {
  agentIds: string[];
  preset: LayoutPreset;   // from tab, not computed internally
  isEditable: boolean;    // false for project tabs
  tabId: string;          // for layout persistence key
}

// --- Storage helpers (per tab) ---

function layoutStorageKey(tabId: string): string {
  return `terminals-rgl-tab-${tabId}`;
}

function loadLayout(tabId: string): LayoutItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(layoutStorageKey(tabId));
    if (saved) return JSON.parse(saved) as LayoutItem[];
  } catch { /* ignore */ }
  return null;
}

function saveLayout(tabId: string, layout: Layout) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(layoutStorageKey(tabId), JSON.stringify(layout));
  } catch { /* ignore */ }
}

// --- Layout generation ---

function generateLayout(panelIds: string[], cols: number): LayoutItem[] {
  return panelIds.map((id, idx) => ({
    i: id,
    x: idx % cols,
    y: Math.floor(idx / cols),
    w: 1,
    h: 1,
  }));
}

/** Check if two layouts are structurally equal */
function layoutsEqual(a: readonly LayoutItem[], b: readonly LayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    if (ai.i !== bi.i || ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h) {
      return false;
    }
  }
  return true;
}

/** Check if a saved layout is compatible with the current grid cols */
function isLayoutCompatible(layout: LayoutItem[], cols: number): boolean {
  return layout.every(item => item.x >= 0 && item.x < cols && item.w <= cols);
}

export function useTerminalGrid({ agentIds, preset, isEditable, tabId }: UseTerminalGridOptions) {
  const [fullscreenPanelId, setFullscreenPanelId] = useState<string | null>(null);
  const [panels, setPanels] = useState<TerminalPanelState[]>([]);
  const [rglLayout, setRglLayout] = useState<LayoutItem[]>([]);

  // Time-based suppress: ignore all RGL onLayoutChange calls within this window.
  // This is more robust than a single-shot boolean — RGL can fire multiple times
  // (once on layout prop change, again on container width change).
  const suppressUntilRef = useRef<number>(0);

  // Keep a ref to the current layout so the reconcile effect can read it
  // without having it as a dependency (which would cause infinite loops).
  const rglLayoutRef = useRef<LayoutItem[]>([]);
  useEffect(() => { rglLayoutRef.current = rglLayout; }, [rglLayout]);

  // Track previous tabId and gridDefinition to detect meaningful changes
  const prevTabIdRef = useRef<string | null>(null);
  const prevGridDefRef = useRef<GridDefinition | null>(null);

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
      // Preserve order from agentIds
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
  useEffect(() => {
    if (fullscreenPanelId) return;

    const visibleIds = visiblePanels.map(p => p.agentId);
    if (visibleIds.length === 0) {
      if (rglLayoutRef.current.length > 0) {
        suppressUntilRef.current = Date.now() + 500;
        setRglLayout([]);
      }
      // Reset tracking so next time we get agents we reload from storage
      prevTabIdRef.current = tabId;
      prevGridDefRef.current = gridDefinition;
      return;
    }

    const cols = gridDefinition.cols;
    const tabChanged = prevTabIdRef.current !== tabId;
    const presetChanged = prevGridDefRef.current !== gridDefinition;
    prevTabIdRef.current = tabId;
    prevGridDefRef.current = gridDefinition;

    let newLayout: LayoutItem[];

    if (tabChanged) {
      // --- TAB CHANGED: load from localStorage or generate fresh ---
      if (isEditable) {
        const saved = loadLayout(tabId);
        if (saved && saved.length > 0 && isLayoutCompatible(saved, cols)) {
          const visibleIdSet = new Set(visibleIds);
          const validSaved = saved.filter(item => visibleIdSet.has(item.i));

          if (validSaved.length > 0) {
            // Add any new agents not in saved layout
            const savedIdSet = new Set(validSaved.map(item => item.i));
            const newIds = visibleIds.filter(id => !savedIdSet.has(id));
            let maxY = Math.max(0, ...validSaved.map(item => item.y + item.h));
            const newItems: LayoutItem[] = newIds.map((id, i) => ({
              i: id,
              x: (validSaved.length + i) % cols,
              y: maxY + Math.floor((validSaved.length + i) / cols),
              w: 1, h: 1,
            }));
            newLayout = [...validSaved, ...newItems];
          } else {
            newLayout = generateLayout(visibleIds, cols);
          }
        } else {
          newLayout = generateLayout(visibleIds, cols);
        }
      } else {
        // Project tabs: always generate fresh, all items static
        newLayout = generateLayout(visibleIds, cols).map(item => ({
          ...item, static: true,
        }));
      }
    } else if (presetChanged) {
      // --- PRESET CHANGED: regenerate layout with new cols ---
      newLayout = isEditable
        ? generateLayout(visibleIds, cols)
        : generateLayout(visibleIds, cols).map(item => ({ ...item, static: true }));
      // Save immediately so the new layout is persisted
      if (isEditable) saveLayout(tabId, newLayout);
    } else {
      // --- SAME TAB + SAME PRESET: reconcile agent additions/removals ---
      // Work off current state, NOT localStorage
      const current = rglLayoutRef.current;
      const currentIdSet = new Set(current.map(item => item.i));
      const visibleIdSet = new Set(visibleIds);

      const kept = current.filter(item => visibleIdSet.has(item.i));
      const newIds = visibleIds.filter(id => !currentIdSet.has(id));

      // No changes needed
      if (newIds.length === 0 && kept.length === current.length) return;

      let maxY = kept.length > 0 ? Math.max(...kept.map(item => item.y + item.h)) : 0;
      const newItems: LayoutItem[] = newIds.map((id, i) => ({
        i: id,
        x: (kept.length + i) % cols,
        y: maxY + Math.floor((kept.length + i) / cols),
        w: 1, h: 1,
      }));

      newLayout = isEditable
        ? [...kept, ...newItems]
        : [...kept, ...newItems].map(item => ({ ...item, static: true }));

      // Save updated layout
      if (isEditable) saveLayout(tabId, newLayout);
    }

    if (!layoutsEqual(rglLayoutRef.current, newLayout)) {
      suppressUntilRef.current = Date.now() + 500;
      setRglLayout(newLayout);
    }
  }, [visiblePanels, gridDefinition, fullscreenPanelId, tabId, isEditable]);

  // Handle layout changes from RGL (user drag only)
  const onLayoutChange = useCallback((newLayout: Layout) => {
    // Suppress RGL callbacks that fire after programmatic layout changes.
    // RGL can fire onLayoutChange multiple times (layout prop + width change),
    // so we use a time window instead of a single-shot flag.
    if (Date.now() < suppressUntilRef.current) return;
    if (!isEditable) return;
    const mutable = [...newLayout];
    setRglLayout(mutable);
    saveLayout(tabId, newLayout);
  }, [tabId, isEditable]);

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
    onLayoutChange,
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
