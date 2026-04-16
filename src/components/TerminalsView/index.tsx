'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isElectron } from '@/hooks/useElectron';
import { DndContext } from '@dnd-kit/core';
import { useElectronAgents, useElectronFS, useElectronSkills } from '@/hooks/useElectron';
import { useMultiTerminal } from './hooks/useMultiTerminal';
import { useTerminalGrid } from './hooks/useTerminalGrid';
import { useTabManager } from './hooks/useTabManager';
import { useBroadcast } from './hooks/useBroadcast';
import { useTerminalKeyboard } from './hooks/useTerminalKeyboard';
import { useTerminalSearch } from './hooks/useTerminalSearch';
import { useTerminalContextMenu } from './hooks/useTerminalContextMenu';
import { useTerminalDnd } from './hooks/useTerminalDnd';
import { LAYOUT_PRESETS } from './constants';
import type { LayoutPreset } from './types';
import GlobalToolbar from './components/GlobalToolbar';
import TerminalGrid from './components/TerminalGrid';
import CustomTabBar from './components/CustomTabBar';
import ProjectTabBar from './components/ProjectTabBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import BroadcastIndicator from './components/BroadcastIndicator';
import ContextMenu from './components/ContextMenu';
import 'xterm/css/xterm.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Lazy-load NewChatModal only when needed
import dynamic from 'next/dynamic';
const NewChatModal = dynamic(() => import('@/components/NewChatModal'), { ssr: false });

export default function TerminalsView() {
  const {
    agents,
    isLoading,
    startAgent,
    stopAgent,
    removeAgent,
    sendInput,
    createAgent,
  } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewFullscreen, setViewFullscreen] = useState(false);
  const lastCustomTabRef = useRef<{ type: 'custom'; tabId: string } | null>(null);
  const [terminalFontSize, setTerminalFontSize] = useState(11);
  const pendingStartRef = useRef<{ agentId: string; prompt: string; options?: { model?: string } } | null>(null);
  const [terminalTheme, setTerminalTheme] = useState<'dark' | 'light'>('dark');
  const [terminalSettingsLoaded, setTerminalSettingsLoaded] = useState(!isElectron());
  // Remember last focused agent per custom tab so Ctrl+Tab restores focus where the user left it
  const lastFocusedByTabRef = useRef<Map<string, string>>(new Map());
  // Set by handleCycleTab; consumed by handleTerminalReady once the destination
  // tab's terminal finishes async init. Also consumed inline if the terminal is
  // already mounted (fast tab cycling).
  const pendingFocusRef = useRef<string | null>(null);

  // Load terminal settings from app settings
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.appSettings) {
      setTerminalSettingsLoaded(true);
      return;
    }
    window.electronAPI.appSettings.get().then((settings) => {
      if (settings) {
        if (settings.terminalFontSize) setTerminalFontSize(settings.terminalFontSize);
        if (settings.terminalTheme) setTerminalTheme(settings.terminalTheme);
      }
      setTerminalSettingsLoaded(true);
    });
  }, []);

  // Tab manager — core state for two-tier tab system
  const allAgentIds = useMemo(() => agents.map(a => a.id), [agents]);
  const tabManager = useTabManager({ existingAgentIds: allAgentIds, isLoading });

  // Derive agents for current active tab
  const filteredAgents = useMemo(() => {
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      // Custom tab: agents in tab order
      const idSet = new Set(tabManager.activeCustomTab.agentIds);
      const agentMap = new Map(agents.map(a => [a.id, a]));
      return tabManager.activeCustomTab.agentIds
        .map(id => agentMap.get(id))
        .filter((a): a is NonNullable<typeof a> => !!a);
    }
    if (tabManager.isProjectTabActive && tabManager.activeProjectPath) {
      // Project tab: all agents for that project
      return agents.filter(a => a.projectPath === tabManager.activeProjectPath);
    }
    return [];
  }, [agents, tabManager.isCustomTabActive, tabManager.isProjectTabActive, tabManager.activeCustomTab, tabManager.activeProjectPath]);

  // Derive grid preset and editable state
  const gridPreset: LayoutPreset = tabManager.activeCustomTab?.layout || '3x3';
  const isEditable = tabManager.isCustomTabActive;
  const tabType: 'custom' | 'project' = tabManager.isCustomTabActive ? 'custom' : 'project';
  const tabId = tabManager.isCustomTabActive && tabManager.activeCustomTab
    ? tabManager.activeCustomTab.id
    : tabManager.activeProjectPath || 'default';

  // Compute disabled presets for layout selector
  const agentCount = filteredAgents.length;
  const disabledPresets = useMemo(() => {
    return (Object.keys(LAYOUT_PRESETS) as LayoutPreset[]).filter(
      preset => LAYOUT_PRESETS[preset].maxPanels < agentCount
    );
  }, [agentCount]);

  // Current tab agent IDs (for AddAgentDropdown)
  const currentTabAgentIds = tabManager.activeCustomTab?.agentIds || [];

  // Agent IDs for grid
  const agentIds = useMemo(() => filteredAgents.map(a => a.id), [filteredAgents]);

  // Set after multiTerminal is created; lets handleTerminalReady consume
  // pendingFocusRef without a circular dep.
  const focusTerminalRef = useRef<((agentId: string) => void) | null>(null);

  // Called when a terminal is fully initialized — fire any deferred agent start
  // and consume any pending Ctrl+Tab focus targeting this agent.
  const handleTerminalReady = useCallback((agentId: string) => {
    const pending = pendingStartRef.current;
    if (pending && pending.agentId === agentId) {
      pendingStartRef.current = null;
      startAgent(pending.agentId, pending.prompt, pending.options as { model?: string; resume?: boolean }).catch(error => {
        console.error('Failed to start agent after creation:', error);
      });
    }
    if (pendingFocusRef.current === agentId) {
      pendingFocusRef.current = null;
      focusTerminalRef.current?.(agentId);
    }
  }, [startAgent]);

  // Broadcast must be initialized before multiTerminal so we can pass broadcastMode
  const broadcast = useBroadcast();

  // Core hooks — delay terminal init until settings are loaded to avoid wrong font size
  const multiTerminal = useMultiTerminal({
    agents: terminalSettingsLoaded ? filteredAgents : [],
    initialFontSize: terminalFontSize,
    onFontSizeChange: (size) => {
      setTerminalFontSize(size);
      if (isElectron() && window.electronAPI?.appSettings) {
        window.electronAPI.appSettings.save({ terminalFontSize: size });
      }
    },
    theme: terminalTheme,
    onTerminalReady: handleTerminalReady,
    broadcastMode: broadcast.broadcastMode,
  });
  // Expose focusTerminal to handleTerminalReady via a ref to break the cycle.
  focusTerminalRef.current = multiTerminal.focusTerminal;

  // Prune lastFocusedByTabRef entries for tabs that no longer exist (mirrors
  // the cleanup useTabManager does for stale agent IDs and tab layouts).
  useEffect(() => {
    const validIds = new Set(tabManager.customTabs.map(t => t.id));
    for (const tabId of lastFocusedByTabRef.current.keys()) {
      if (!validIds.has(tabId)) lastFocusedByTabRef.current.delete(tabId);
    }
  }, [tabManager.customTabs]);

  const grid = useTerminalGrid({ agentIds, preset: gridPreset, isEditable, tabId });
  const search = useTerminalSearch(filteredAgents);
  const contextMenu = useTerminalContextMenu();

  // Dnd hook
  const dnd = useTerminalDnd({
    onSkillDrop: async (skillName, agentId) => {
      await sendInput(agentId, `use this skill: ${skillName}\n`);
    },
  });

  // Handler callbacks
  const handleStartAgent = useCallback(async (agentId: string) => {
    await startAgent(agentId, '', { resume: true });
  }, [startAgent]);

  const handleStopAgent = useCallback(async (agentId: string) => {
    await stopAgent(agentId);
  }, [stopAgent]);

  // Remove from tab (custom tabs): stop agent + remove from tab membership
  const handleRemoveFromTab = useCallback(async (agentId: string) => {
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      await stopAgent(agentId);
      tabManager.removeAgentFromTab(tabManager.activeCustomTab.id, agentId);
    }
  }, [stopAgent, tabManager]);

  // For project tabs: full remove (backwards compat)
  const handleRemoveAgent = useCallback(async (agentId: string) => {
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      // Custom tab: remove from tab, stop agent
      await stopAgent(agentId);
      tabManager.removeAgentFromTab(tabManager.activeCustomTab.id, agentId);
    } else {
      // Project tab: actual remove
      multiTerminal.unregisterContainer(agentId);
      await removeAgent(agentId);
    }
  }, [stopAgent, removeAgent, multiTerminal, tabManager]);

  const handleAddAgentToTab = useCallback((agentId: string) => {
    if (tabManager.activeCustomTab) {
      tabManager.addAgentToTab(tabManager.activeCustomTab.id, agentId);
    }
  }, [tabManager]);

  const handleFocusPanel = useCallback((agentId: string) => {
    setFocusedPanelId(agentId);
    multiTerminal.focusTerminal(agentId);
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      lastFocusedByTabRef.current.set(tabManager.activeCustomTab.id, agentId);
    }
  }, [multiTerminal, tabManager]);

  // Ctrl+Tab / Ctrl+Shift+Tab: cycle through custom tabs (browser-style),
  // restoring focus to the last focused agent in the destination tab.
  const handleCycleTab = useCallback((direction: 'next' | 'prev') => {
    const tabs = tabManager.customTabs;
    if (tabs.length < 2) return;

    const currentIdx = tabManager.isCustomTabActive && tabManager.activeCustomTab
      ? tabs.findIndex(t => t.id === tabManager.activeCustomTab!.id)
      : 0;
    const step = direction === 'next' ? 1 : tabs.length - 1;
    const nextTab = tabs[(currentIdx + step) % tabs.length];

    // Resolve the focus target: last focused agent in the destination tab if
    // it's still a member, otherwise the first agent. Empty tabs get nothing.
    const remembered = lastFocusedByTabRef.current.get(nextTab.id);
    const targetAgentId = remembered && nextTab.agentIds.includes(remembered)
      ? remembered
      : nextTab.agentIds[0];

    tabManager.setActiveTab({ type: 'custom', tabId: nextTab.id });

    if (targetAgentId) {
      setFocusedPanelId(targetAgentId);
      // Switching tabs re-mounts terminals (registerContainer disposes the old
      // one and asynchronously inits a new xterm). Stash the focus target —
      // handleTerminalReady will consume it once the new terminal is ready.
      pendingFocusRef.current = targetAgentId;
      // Also try immediately in case the terminal happens to already be live
      // (no-op if it's not yet registered).
      multiTerminal.focusTerminal(targetAgentId);
    }
  }, [tabManager, multiTerminal]);

  // Keyboard shortcuts (must come after handler declarations to avoid TDZ)
  const visibleAgentIds = useMemo(
    () => grid.visiblePanels.map(p => p.agentId),
    [grid.visiblePanels]
  );

  useTerminalKeyboard({
    panelAgentIds: visibleAgentIds,
    onFocusPanel: handleFocusPanel,
    onToggleFullscreen: () => grid.toggleFullscreen(focusedPanelId || undefined),
    onToggleBroadcast: broadcast.toggleBroadcast,
    onToggleSidebar: () => { },
    onNewAgent: () => setShowNewChatModal(true),
    onExitFullscreen: grid.exitFullscreen,
    onCycleTab: handleCycleTab,
    isFullscreen: !!grid.fullscreenPanelId,
  });

  const handleStartAll = useCallback(async () => {
    const needsStart = filteredAgents.filter(a =>
      a.status === 'idle' || a.status === 'completed' || a.status === 'error'
    );
    for (const agent of needsStart) {
      await startAgent(agent.id, '', { resume: true });
    }
  }, [filteredAgents, startAgent]);

  const handleStopAll = useCallback(async () => {
    const running = filteredAgents.filter(a => a.status === 'running' || a.status === 'waiting');
    for (const agent of running) {
      await stopAgent(agent.id);
    }
  }, [filteredAgents, stopAgent]);

  const handleCopyOutput = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      navigator.clipboard.writeText(agent.output.join('')).catch(() => { });
    }
  }, [agents]);

  const handleLayoutChange = useCallback((preset: LayoutPreset) => {
    if (tabManager.activeCustomTab) {
      tabManager.setTabLayout(tabManager.activeCustomTab.id, preset);
    }
  }, [tabManager]);

  const handleNewAgent = useCallback(async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: string,
    name?: string,
    secondaryProjectPath?: string,
    permissionMode?: 'normal' | 'auto' | 'bypass',
    _provider?: string,
    _localModel?: string,
    _obsidianVaultPaths?: string[],
    effort?: 'low' | 'medium' | 'high',
  ) => {
    const agent = await createAgent({
      projectPath,
      skills,
      worktree,
      character: character as import('@/types/electron').AgentCharacter,
      name,
      secondaryProjectPath,
      permissionMode,
      effort,
    });
    // Auto-add to active custom tab
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      tabManager.addAgentToTab(tabManager.activeCustomTab.id, agent.id);
    }
    // Defer start until the terminal for this agent is initialized.
    // The onTerminalReady callback will fire startAgent once xterm is ready.
    if (prompt) {
      pendingStartRef.current = { agentId: agent.id, prompt, options: { model } };
    }
    setShowNewChatModal(false);
  }, [createAgent, tabManager]);

  // Auto-start agents that have no PTY (freshly loaded from disk).
  // Skip agents that already have a live PTY — they're idle but have an
  // active Claude session waiting for the next prompt.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (isLoading || autoStartedRef.current) return;
    autoStartedRef.current = true;
    const needsStart = agents.filter(a =>
      (a.status === 'idle' || a.status === 'completed') && !a.ptyId
    );
    for (const agent of needsStart) {
      startAgent(agent.id, '', { resume: true }).catch(() => { });
    }
  }, [isLoading, agents, startAgent]);

  // Exit view fullscreen on Escape
  useEffect(() => {
    if (!viewFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewFullscreen]);

  // Re-fit terminals when view fullscreen changes
  useEffect(() => {
    const timer = setTimeout(() => multiTerminal.fitAll(), 100);
    return () => clearTimeout(timer);
  }, [viewFullscreen, multiTerminal]);

  const runningCount = filteredAgents.filter(a => a.status === 'running' || a.status === 'waiting').length;

  return (
    <DndContext sensors={dnd.sensors} onDragEnd={dnd.handleDragEnd}>
      <div className={`flex flex-col overflow-hidden ${viewFullscreen ? 'fixed inset-0 z-[100] bg-background window-no-drag pt-7' : 'h-full w-full relative'}`}>
        {/* Broadcast overlay */}
        <BroadcastIndicator active={broadcast.broadcastMode} />

        {/* Top toolbar */}
        <GlobalToolbar
          layout={gridPreset}
          onLayoutChange={handleLayoutChange}
          broadcastMode={broadcast.broadcastMode}
          onToggleBroadcast={broadcast.toggleBroadcast}
          onStartAll={handleStartAll}
          onStopAll={handleStopAll}
          onNewAgent={() => setShowNewChatModal(true)}
          runningCount={runningCount}
          totalCount={filteredAgents.length}
          fontSize={multiTerminal.fontSize}
          onZoomIn={multiTerminal.zoomIn}
          onZoomOut={multiTerminal.zoomOut}
          onZoomReset={multiTerminal.zoomReset}
          isViewFullscreen={viewFullscreen}
          onToggleViewFullscreen={() => setViewFullscreen(prev => !prev)}
          isCustomTabActive={tabManager.isCustomTabActive}
          allAgents={agents}
          currentTabAgentIds={currentTabAgentIds}
          onAddAgentToTab={handleAddAgentToTab}
          disabledPresets={disabledPresets}
        />

        {/* Custom tab bar — top */}
        <CustomTabBar
          tabs={tabManager.customTabs}
          activeTab={tabManager.activeTab}
          canCreateTab={tabManager.canCreateTab}
          onSelectTab={(tabId) => tabManager.setActiveTab({ type: 'custom', tabId })}
          onCreateTab={tabManager.createTab}
          onDeleteTab={tabManager.deleteTab}
          onRenameTab={tabManager.renameTab}
          onReorderTabs={tabManager.reorderTabs}
        />

        {/* Terminal grid — takes full space, relative for sidebar panel */}
        <div className="flex-1 min-h-0 relative">
          <TerminalGrid
            agents={filteredAgents}
            visiblePanels={grid.visiblePanels}
            rglLayout={grid.rglLayout}
            cols={grid.cols}
            rows={grid.gridDefinition.rows}
            onDragStop={grid.onDragStop}
            broadcastMode={broadcast.broadcastMode}
            focusedPanelId={focusedPanelId}
            fullscreenPanelId={grid.fullscreenPanelId}
            isLoading={isLoading}
            isEditable={isEditable}
            tabType={tabType}
            onRegisterContainer={multiTerminal.registerContainer}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            onRemoveAgent={handleRemoveAgent}
            onClearTerminal={multiTerminal.clearTerminal}
            onFullscreenPanel={grid.fullscreenPanel}
            onExitFullscreen={grid.exitFullscreen}
            onFocusPanel={handleFocusPanel}
            onContextMenu={contextMenu.openMenu}
            onFitAll={multiTerminal.fitAll}
          />

          {/* Sidebar panel — overlays grid from the right */}
          <Sidebar
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            agents={filteredAgents}
            focusedPanelId={focusedPanelId}
            onFocusPanel={handleFocusPanel}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            installedSkills={installedSkills}
          />
        </div>

        {/* Project tab bar — bottom */}
        <ProjectTabBar
          agents={agents}
          activeTab={tabManager.activeTab}
          onSelectProject={(path) => {
            if (tabManager.activeTab.type === 'project' && tabManager.activeTab.projectPath === path) {
              // Toggle off: restore last custom tab, or fallback to first
              const restore = lastCustomTabRef.current;
              const target = restore && tabManager.customTabs.find(t => t.id === restore.tabId)
                ? restore
                : tabManager.customTabs[0] ? { type: 'custom' as const, tabId: tabManager.customTabs[0].id } : null;
              if (target) tabManager.setActiveTab(target);
            } else {
              // Save current custom tab before switching to project view
              if (tabManager.activeTab.type === 'custom') {
                lastCustomTabRef.current = { type: 'custom', tabId: tabManager.activeTab.tabId };
              }
              tabManager.setActiveTab({ type: 'project', projectPath: path });
            }
          }}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen(prev => !prev)}
        />

        {/* Status bar */}
        <StatusBar agents={filteredAgents} />

        {/* Context menu */}
        <ContextMenu
          state={contextMenu.menuState}
          agent={contextMenu.menuState.agentId ? agents.find(a => a.id === contextMenu.menuState.agentId) || null : null}
          onClose={contextMenu.closeMenu}
          onStart={handleStartAgent}
          onStop={handleStopAgent}
          onClear={multiTerminal.clearTerminal}
          onFullscreen={grid.fullscreenPanel}
          onCopyOutput={handleCopyOutput}
        />

        {/* New Chat Modal */}
        {showNewChatModal && (
          <NewChatModal
            open={showNewChatModal}
            onClose={() => setShowNewChatModal(false)}
            onSubmit={handleNewAgent}
            projects={projects}
            onBrowseFolder={openFolderDialog}
            installedSkills={installedSkills}
            onRefreshSkills={refreshSkills}
          />
        )}
      </div>
    </DndContext>
  );
}
