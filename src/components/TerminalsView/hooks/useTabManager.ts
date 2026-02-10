'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { CustomTab, ActiveTab, LayoutPreset } from '../types';
import { LAYOUT_PRESETS, getAutoLayout } from '../constants';
import { deleteTabLayouts } from './useGridLayoutStorage';

const STORAGE_KEY = 'terminals-tab-manager';
const MAX_TABS = 6;

interface TabManagerState {
  customTabs: CustomTab[];
  activeTab: ActiveTab;
}

function createDefaultState(): TabManagerState {
  const mainTab: CustomTab = {
    id: crypto.randomUUID(),
    name: 'Main',
    agentIds: [],
    layout: '2x2',
  };
  return {
    customTabs: [mainTab],
    activeTab: { type: 'custom', tabId: mainTab.id },
  };
}

function loadState(): TabManagerState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as TabManagerState;
      if (parsed.customTabs && parsed.activeTab) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return createDefaultState();
}

function saveState(state: TabManagerState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

interface UseTabManagerOptions {
  existingAgentIds: string[];
  isLoading: boolean;
}

export function useTabManager({ existingAgentIds, isLoading }: UseTabManagerOptions) {
  const [state, setState] = useState<TabManagerState>(loadState);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Sync stale agent IDs: remove agents that no longer exist from all tabs.
  // SKIP while loading — agents haven't been fetched yet, so the set would be
  // empty and wipe every board.
  useEffect(() => {
    if (isLoading) return;
    if (existingAgentIds.length === 0) return; // nothing loaded yet

    const validIds = new Set(existingAgentIds);
    setState(prev => {
      let changed = false;
      const updatedTabs = prev.customTabs.map(tab => {
        const filtered = tab.agentIds.filter(id => validIds.has(id));
        if (filtered.length !== tab.agentIds.length) {
          changed = true;
          return { ...tab, agentIds: filtered };
        }
        return tab;
      });
      if (!changed) return prev;
      return { ...prev, customTabs: updatedTabs };
    });
  }, [existingAgentIds, isLoading]);

  // --- Tab CRUD ---

  const createTab = useCallback((name: string) => {
    setState(prev => {
      if (prev.customTabs.length >= MAX_TABS) return prev;
      const newTab: CustomTab = {
        id: crypto.randomUUID(),
        name: name || `Tab ${prev.customTabs.length + 1}`,
        agentIds: [],
        layout: '2x2',
      };
      return {
        customTabs: [...prev.customTabs, newTab],
        activeTab: { type: 'custom', tabId: newTab.id },
      };
    });
  }, []);

  const deleteTab = useCallback((tabId: string) => {
    deleteTabLayouts(tabId);
    setState(prev => {
      const idx = prev.customTabs.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;
      const remaining = prev.customTabs.filter(t => t.id !== tabId);
      let activeTab = prev.activeTab;
      // If we're deleting the active tab, switch to next board or first project tab
      if (prev.activeTab.type === 'custom' && prev.activeTab.tabId === tabId) {
        if (remaining.length > 0) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          activeTab = { type: 'custom', tabId: remaining[nextIdx].id };
        } else {
          // No boards left — activeTab stays as-is, UI will show empty + create prompt
          activeTab = { type: 'custom', tabId: '' };
        }
      }
      return { customTabs: remaining, activeTab };
    });
  }, []);

  const renameTab = useCallback((tabId: string, name: string) => {
    setState(prev => ({
      ...prev,
      customTabs: prev.customTabs.map(t =>
        t.id === tabId ? { ...t, name: name || t.name } : t
      ),
    }));
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const tabs = [...prev.customTabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { ...prev, customTabs: tabs };
    });
  }, []);

  // --- Agent membership ---

  const addAgentToTab = useCallback((tabId: string, agentId: string) => {
    setState(prev => {
      const tab = prev.customTabs.find(t => t.id === tabId);
      if (!tab || tab.agentIds.includes(agentId)) return prev;

      const newAgentIds = [...tab.agentIds, agentId];
      // Auto-upgrade layout if agents exceed maxPanels
      let newLayout = tab.layout;
      const currentMax = LAYOUT_PRESETS[newLayout].maxPanels;
      if (newAgentIds.length > currentMax) {
        newLayout = getAutoLayout(newAgentIds.length);
      }

      return {
        ...prev,
        customTabs: prev.customTabs.map(t =>
          t.id === tabId ? { ...t, agentIds: newAgentIds, layout: newLayout } : t
        ),
      };
    });
  }, []);

  const removeAgentFromTab = useCallback((tabId: string, agentId: string) => {
    setState(prev => ({
      ...prev,
      customTabs: prev.customTabs.map(t =>
        t.id === tabId
          ? { ...t, agentIds: t.agentIds.filter(id => id !== agentId) }
          : t
      ),
    }));
  }, []);

  // --- Layout ---

  const setTabLayout = useCallback((tabId: string, preset: LayoutPreset) => {
    setState(prev => ({
      ...prev,
      customTabs: prev.customTabs.map(t =>
        t.id === tabId ? { ...t, layout: preset } : t
      ),
    }));
  }, []);

  // --- Active tab ---

  const setActiveTab = useCallback((tab: ActiveTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // --- Derived values ---

  const activeCustomTab = useMemo(() => {
    const tab = state.activeTab;
    if (tab.type !== 'custom') return null;
    return state.customTabs.find(t => t.id === tab.tabId) || null;
  }, [state.customTabs, state.activeTab]);

  const activeProjectPath = useMemo(() => {
    const tab = state.activeTab;
    if (tab.type !== 'project') return null;
    return tab.projectPath;
  }, [state.activeTab]);

  const isCustomTabActive = state.activeTab.type === 'custom';
  const isProjectTabActive = state.activeTab.type === 'project';
  const canCreateTab = state.customTabs.length < MAX_TABS;

  return {
    customTabs: state.customTabs,
    activeTab: state.activeTab,
    createTab,
    deleteTab,
    renameTab,
    reorderTabs,
    addAgentToTab,
    removeAgentFromTab,
    setTabLayout,
    setActiveTab,
    activeCustomTab,
    activeProjectPath,
    isCustomTabActive,
    isProjectTabActive,
    canCreateTab,
  };
}
