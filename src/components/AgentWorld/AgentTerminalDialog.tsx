'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, PanelRight } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import 'xterm/css/xterm.css';

import type { AgentTerminalDialogProps, PanelType } from './AgentDialogTypes';
import { isSuperAgent } from './AgentDialogTypes';
import { AgentDialogHeader } from './AgentDialogHeader';
import { AgentDialogFooter } from './AgentDialogFooter';
import { AgentDialogSidebar } from './AgentDialogSidebar';
import { AgentDialogSuperAgentSidebar } from './AgentDialogSuperAgentSidebar';
import { useAgentDialogTerminal } from './useAgentDialogTerminal';
import { useQuickTerminal } from './useQuickTerminal';

export default function AgentTerminalDialog({
  agent,
  open,
  onClose,
  onStart,
  onStop,
  projects = [],
  agents = [],
  onBrowseFolder,
  onAgentUpdated,
  onUpdateAgent,
  initialPanel,
  skipHistoricalOutput = false,
}: AgentTerminalDialogProps) {
  const isSuperAgentMode = isSuperAgent(agent);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Set<PanelType>>(new Set());
  const [gitBranch, setGitBranch] = useState('');

  // Settings panel state
  const [editSkipPermissions, setEditSkipPermissions] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [customSecondaryPath, setCustomSecondaryPath] = useState('');

  // Track whether we've applied the initialPanel for this agent
  const appliedInitialPanelRef = useRef<string | null>(null);

  // Derived values
  const projectPath = useMemo(
    () => agent?.worktreePath || agent?.projectPath || '',
    [agent?.worktreePath, agent?.projectPath],
  );
  const character = useMemo(
    () => (agent?.name?.toLowerCase() === 'bitwonka' ? 'frog' : agent?.character || 'robot'),
    [agent?.name, agent?.character],
  );
  const hasSecondaryProject = !!agent?.secondaryProjectPath;
  const availableProjects = useMemo(
    () => (agent ? projects.filter(p => p.path !== agent.projectPath && p.path !== agent.worktreePath) : projects),
    [projects, agent?.projectPath, agent?.worktreePath], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Sync skip-permissions UI state when agent changes
  useEffect(() => {
    setEditSkipPermissions(agent?.skipPermissions || false);
    setGitBranch('');
  }, [agent?.id, agent?.skipPermissions]);

  // Expand initialPanel when the dialog opens for a new agent
  useEffect(() => {
    if (open && agent && initialPanel && appliedInitialPanelRef.current !== agent.id) {
      setExpandedPanels(prev => new Set([...prev, initialPanel]));
      appliedInitialPanelRef.current = agent.id;
    }
    if (!open) appliedInitialPanelRef.current = null;
  }, [open, agent, initialPanel]);

  // Terminal hooks
  const { terminalReady, terminalRef, xtermRef } = useAgentDialogTerminal({
    open,
    agent,
    isFullscreen,
    skipHistoricalOutput,
  });

  const collapseTerminalPanel = useCallback(() => {
    setExpandedPanels(prev => { const s = new Set(prev); s.delete('terminal'); return s; });
  }, []);

  const { quickTerminalReady, quickTerminalRef, quickXtermRef, hasActiveTerminal, closeQuickTerminal } =
    useQuickTerminal({
      agentId: agent?.id,
      projectPath,
      open,
      expandedPanels,
      onCollapseTerminal: collapseTerminalPanel,
    });

  // ── Callbacks ────────────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (agent && prompt.trim()) {
      onStart(agent.id, prompt.trim());
      setPrompt('');
    }
  }, [agent, prompt, onStart]);

  const handleStop = useCallback(() => {
    if (agent) onStop(agent.id);
  }, [agent, onStop]);

  const handleOpenInFinder = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;
    try {
      await window.electronAPI.shell.exec({ command: `open "${projectPath}"`, cwd: projectPath });
    } catch (err) {
      console.error('Failed to open Finder:', err);
    }
  }, [projectPath]);

  const togglePanel = useCallback((panel: PanelType) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      next.has(panel) ? next.delete(panel) : next.add(panel);
      return next;
    });
  }, []);

  const handleSetSecondaryProject = useCallback(async (path: string | null) => {
    if (!agent) return;
    if (path && window.electronAPI?.agent?.sendInput) {
      try {
        await window.electronAPI.agent.sendInput({ id: agent.id, input: `/add-dir ${path}\r` });
      } catch (err) {
        console.error('Failed to send /add-dir command:', err);
      }
    }
    if (window.electronAPI?.agent?.setSecondaryProject) {
      try {
        const result = await window.electronAPI.agent.setSecondaryProject({ id: agent.id, secondaryProjectPath: path });
        if (result.success && result.agent && onAgentUpdated) onAgentUpdated(result.agent);
        if (result.success) setCustomSecondaryPath('');
      } catch (err) {
        console.error('Failed to set secondary project:', err);
      }
    }
  }, [agent, onAgentUpdated]);

  const handleSaveSkipPermissions = useCallback(async (value: boolean) => {
    if (!agent) return;
    setIsSavingSettings(true);
    try {
      const params = { id: agent.id, skipPermissions: value };
      const result = onUpdateAgent
        ? await onUpdateAgent(params)
        : await window.electronAPI!.agent.update(params);
      if (result.success && result.agent && onAgentUpdated) onAgentUpdated(result.agent as AgentStatus);
      setEditSkipPermissions(value);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  }, [agent, onUpdateAgent, onAgentUpdated]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!open || !agent) return null;

  const dialogClass = isFullscreen ? 'fixed inset-4' : 'w-full max-w-[80vw] h-[85vh]';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-bg-secondary border border-border-primary rounded-none overflow-hidden shadow-2xl ${dialogClass} flex flex-col`}
        >
          <AgentDialogHeader
            agent={agent}
            character={character}
            isFullscreen={isFullscreen}
            hasSecondaryProject={hasSecondaryProject}
            isSuperAgentMode={isSuperAgentMode}
            onOpenInFinder={handleOpenInFinder}
            onToggleFullscreen={() => setIsFullscreen(v => !v)}
            onClose={onClose}
          />

          <div className="flex-1 min-h-[300px] flex overflow-hidden">
            {/* Main terminal area */}
            <div className="flex-1 relative">
              <div
                ref={terminalRef}
                className="absolute inset-0 bg-[#1a1a2e] p-2"
                style={{ cursor: 'text', minHeight: '300px' }}
                onClick={() => xtermRef.current?.focus()}
              />
              {!terminalReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
                </div>
              )}
              {/* Sidebar toggle button (bottom-right of terminal) */}
              {!sidebarOpen && !isSuperAgentMode && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors z-10"
                  title="Show sidebar"
                >
                  <PanelRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right sidebar — collapsible */}
            {(sidebarOpen || isSuperAgentMode) && (
              <div className="border-l border-border-primary bg-bg-tertiary/20 flex flex-col overflow-hidden" style={{ width: '480px' }}>
                {isSuperAgentMode ? (
                  <AgentDialogSuperAgentSidebar agents={agents} projects={projects} />
                ) : (
                  <>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-b border-border-primary transition-colors"
                    >
                      <PanelRight className="w-3.5 h-3.5" />
                      Hide sidebar
                    </button>
                    <AgentDialogSidebar
                      agent={agent}
                      projectPath={projectPath}
                      expandedPanels={expandedPanels}
                      onTogglePanel={togglePanel}
                      gitBranch={gitBranch}
                      onGitBranchChange={setGitBranch}
                      quickTerminalRef={quickTerminalRef}
                      quickXtermRef={quickXtermRef}
                      quickTerminalReady={quickTerminalReady}
                      hasActiveTerminal={hasActiveTerminal}
                      onCloseQuickTerminal={closeQuickTerminal}
                      hasSecondaryProject={hasSecondaryProject}
                      availableProjects={availableProjects}
                      customSecondaryPath={customSecondaryPath}
                      onCustomSecondaryPathChange={setCustomSecondaryPath}
                      onSetSecondaryProject={handleSetSecondaryProject}
                      onBrowseFolder={onBrowseFolder}
                      editSkipPermissions={editSkipPermissions}
                      isSavingSettings={isSavingSettings}
                      onSaveSkipPermissions={handleSaveSkipPermissions}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <AgentDialogFooter
            agent={agent}
            prompt={prompt}
            onPromptChange={setPrompt}
            onStart={handleStart}
            onStop={handleStop}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
