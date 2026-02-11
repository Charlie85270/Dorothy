'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import { useClaude } from '@/hooks/useClaude';
import AgentTerminalDialog from '@/components/AgentWorld/AgentTerminalDialog';
import NewChatModal from '@/components/NewChatModal';

import {
  useCanvasState,
  useCanvasGestures,
  useCanvasNodes,
  useTerminalDialog,
  useAgentActions,
} from './hooks';

import {
  DotGrid,
  ConnectionLine,
  AgentNodeCard,
  ProjectNodeCard,
  CanvasToolbar,
  CanvasStatusBar,
  NotificationPanel,
  EmptyState,
} from './components';

export default function CanvasView() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  // External hooks
  const { agents: electronAgents, stopAgent, startAgent, createAgent, refresh: refreshAgents } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();
  const { data: claudeData } = useClaude();

  // Canvas state (positions, zoom, pan)
  const canvasState = useCanvasState();
  const {
    agentPositions,
    projectPositions,
    zoom,
    panOffset,
    notificationPanelCollapsed,
    selectedNodeId,
    setZoom,
    setNotificationPanelCollapsed,
    setSelectedNodeId,
    updateAgentPosition,
    updateProjectPosition,
    resetView,
  } = canvasState;

  // Gestures (mouse/touch panning)
  const { isPanning, handlers: gestureHandlers } = useCanvasGestures(canvasState);

  // Filter state
  const [filter, setFilter] = useState<'all' | 'running' | 'idle' | 'stopped'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Canvas nodes (transform agents to nodes, filter, connections)
  const {
    agentNodes,
    projectNodes,
    filteredAgents,
    filteredProjects,
    uniqueProjects,
    connections,
    superAgent,
    runningCount,
    waitingCount,
  } = useCanvasNodes(
    electronAgents,
    agentPositions,
    projectPositions,
    filter,
    projectFilter,
    searchQuery
  );

  // Terminal dialog
  const terminal = useTerminalDialog(electronAgents);
  const {
    terminalAgent,
    terminalInitialPanel,
    handleOpenTerminal,
    handleEditAgent,
    closeTerminal,
    isOpen: isTerminalOpen,
  } = terminal;

  // Agent actions
  const agentActions = useAgentActions({
    stopAgent,
    startAgent,
    createAgent,
    projects,
    superAgent,
    setTerminalAgentId: (id) => id ? handleOpenTerminal(id) : closeTerminal(),
  });

  const {
    isCreatingSuperAgent,
    showCreateAgentModal,
    createAgentProjectPath,
    handleToggleAgent,
    handleStartAgent,
    handleStopAgent,
    handleAddAgentToProject,
    handleCreateAgent,
    handleSuperAgentClick,
    closeCreateAgentModal,
  } = agentActions;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
      if (e.key === 'f' && e.metaKey) {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetView, setSelectedNodeId]);

  // Handle agent drag
  const handleAgentDrag = useCallback((id: string, delta: { x: number; y: number }) => {
    const node = agentNodes.find(a => a.id === id);
    updateAgentPosition(id, delta, node?.position);
  }, [agentNodes, updateAgentPosition]);

  // Handle project drag
  const handleProjectDrag = useCallback((id: string, delta: { x: number; y: number }) => {
    const node = projectNodes.find(p => p.id === id);
    updateProjectPosition(id, delta, node?.position);
  }, [projectNodes, updateProjectPosition]);

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full bg-[#0D0B08] overflow-hidden touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      {...gestureHandlers}
    >
      <DotGrid />

      <CanvasToolbar
        filter={filter}
        setFilter={setFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        projects={uniqueProjects}
        onResetView={resetView}
        zoom={zoom}
        setZoom={setZoom}
        superAgent={superAgent}
        isCreatingSuperAgent={isCreatingSuperAgent}
        onSuperAgentClick={handleSuperAgentClick}
        showSuperAgentButton={isElectron()}
      />

      {/* Canvas Content */}
      <div
        className="canvas-content absolute inset-0 pt-16"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Connection Lines */}
        {connections.map((conn, i) => (
          <ConnectionLine key={i} from={conn.from} to={conn.to} isActive={conn.isActive} />
        ))}

        {/* Agent Nodes */}
        <AnimatePresence>
          {filteredAgents.map((agent) => (
            <AgentNodeCard
              key={agent.id}
              node={agent}
              isSelected={selectedNodeId === agent.id}
              onSelect={() => setSelectedNodeId(agent.id)}
              onDrag={(delta) => handleAgentDrag(agent.id, delta)}
              onOpenTerminal={() => handleOpenTerminal(agent.id)}
              onToggleAgent={() => handleToggleAgent(agent.id, agent.status === 'running' || agent.status === 'waiting')}
              onEdit={() => handleEditAgent(agent.id)}
            />
          ))}
        </AnimatePresence>

        {/* Project Nodes */}
        <AnimatePresence>
          {filteredProjects.map((project) => (
            <ProjectNodeCard
              key={project.id}
              node={project}
              isSelected={selectedNodeId === project.id}
              onSelect={() => setSelectedNodeId(project.id)}
              onDrag={(delta) => handleProjectDrag(project.id, delta)}
              onAddAgent={() => handleAddAgentToProject(project.path)}
            />
          ))}
        </AnimatePresence>
      </div>

      <CanvasStatusBar
        agentCount={filteredAgents.length}
        runningCount={runningCount}
        waitingCount={waitingCount}
        projectCount={filteredProjects.length}
      />

      {/* Notification Panel - hidden on mobile */}
      <div className="hidden lg:block">
        <NotificationPanel
          agents={agentNodes}
          isCollapsed={notificationPanelCollapsed}
          onToggle={() => setNotificationPanelCollapsed(!notificationPanelCollapsed)}
          onOpenTerminal={handleOpenTerminal}
        />
      </div>

      {/* Empty state */}
      {agentNodes.length === 0 && projectNodes.length === 0 && (
        <EmptyState onNavigateToAgents={() => router.push('/agents')} />
      )}

      {/* Title */}
      <div className="absolute bottom-20 left-4 z-40 pointer-events-none">
        <h2 className="text-xl font-mono text-zinc-700 italic">Agent Board</h2>
      </div>

      {/* Agent Terminal Dialog */}
      <AgentTerminalDialog
        agent={terminalAgent}
        open={isTerminalOpen}
        onClose={closeTerminal}
        onStart={handleStartAgent}
        onStop={handleStopAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        agents={electronAgents}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        onAgentUpdated={refreshAgents}
        initialPanel={terminalInitialPanel}
      />

      {/* New Agent Modal */}
      <NewChatModal
        open={showCreateAgentModal}
        onClose={closeCreateAgentModal}
        onSubmit={handleCreateAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        allInstalledSkills={claudeData?.skills || []}
        onRefreshSkills={refreshSkills}
        initialProjectPath={createAgentProjectPath || undefined}
        initialStep={createAgentProjectPath ? 2 : 1}
      />
    </div>
  );
}
