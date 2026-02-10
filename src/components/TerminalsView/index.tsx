'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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

  // Core hooks
  const multiTerminal = useMultiTerminal({ agents: filteredAgents });
  const grid = useTerminalGrid({ agentIds, preset: gridPreset, isEditable, tabId });
  const broadcast = useBroadcast();
  const search = useTerminalSearch(filteredAgents);
  const contextMenu = useTerminalContextMenu();

  // Dnd hook
  const dnd = useTerminalDnd({
    onSkillDrop: async (skillName, agentId) => {
      await sendInput(agentId, `use this skill: ${skillName}\n`);
    },
  });

  // Keyboard shortcuts
  const visibleAgentIds = useMemo(
    () => grid.visiblePanels.map(p => p.agentId),
    [grid.visiblePanels]
  );

  useTerminalKeyboard({
    panelAgentIds: visibleAgentIds,
    onFocusPanel: (agentId) => {
      setFocusedPanelId(agentId);
      multiTerminal.focusTerminal(agentId);
    },
    onToggleFullscreen: () => grid.toggleFullscreen(focusedPanelId || undefined),
    onToggleBroadcast: broadcast.toggleBroadcast,
    onToggleSidebar: () => {},
    onNewAgent: () => setShowNewChatModal(true),
    onExitFullscreen: grid.exitFullscreen,
    isFullscreen: !!grid.fullscreenPanelId,
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
  }, [multiTerminal]);

  const handleStartAll = useCallback(async () => {
    const idle = filteredAgents.filter(a => a.status === 'idle' || a.status === 'completed');
    for (const agent of idle) {
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
      navigator.clipboard.writeText(agent.output.join('')).catch(() => {});
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
    skipPermissions?: boolean,
  ) => {
    const agent = await createAgent({
      projectPath,
      skills,
      worktree,
      character: character as import('@/types/electron').AgentCharacter,
      name,
      secondaryProjectPath,
      skipPermissions,
    });
    // Auto-add to active custom tab
    if (tabManager.isCustomTabActive && tabManager.activeCustomTab) {
      tabManager.addAgentToTab(tabManager.activeCustomTab.id, agent.id);
    }
    if (prompt) {
      await startAgent(agent.id, prompt, { model } as { model?: string; resume?: boolean });
    }
    setShowNewChatModal(false);
  }, [createAgent, startAgent, tabManager]);

  // Auto-start all idle agents when the Terminals view opens
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (isLoading || autoStartedRef.current) return;
    autoStartedRef.current = true;
    const idle = agents.filter(a => a.status === 'idle' || a.status === 'completed');
    for (const agent of idle) {
      startAgent(agent.id, '', { resume: true }).catch(() => {});
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
      <div className={`flex flex-col overflow-hidden ${viewFullscreen ? 'fixed inset-0 z-[100] bg-background' : 'h-full w-full relative'}`}>
        {/* Broadcast overlay */}
        <BroadcastIndicator active={broadcast.broadcastMode} />

        {/* Top toolbar */}
        <GlobalToolbar
          layout={gridPreset}
          onLayoutChange={handleLayoutChange}
          broadcastMode={broadcast.broadcastMode}
          onToggleBroadcast={broadcast.toggleBroadcast}
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
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
            onLayoutChange={grid.onLayoutChange}
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
          onSelectProject={(path) => tabManager.setActiveTab({ type: 'project', projectPath: path })}
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
