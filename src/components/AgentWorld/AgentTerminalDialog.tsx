'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Square,
  Terminal as TerminalIcon,
  Loader2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  FolderOpen,
  FolderPlus,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  GitBranch,
  PanelRightClose,
  PanelRight,
  TerminalSquare,
  Layers,
  Check,
  Code2,
  Settings2,
  Crown,
  Users,
  Folder,
  Circle,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import { CHARACTER_FACES, TERMINAL_THEME, QUICK_TERMINAL_THEME } from './constants';
import 'xterm/css/xterm.css';

// Lazy load heavy components to improve initial load time (bundle-dynamic-imports)
const GitPanel = dynamic(() => import('./GitPanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
    </div>
  ),
});

const CodePanel = dynamic(() => import('./CodePanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
    </div>
  ),
});

// Store PTY IDs per agent to persist terminals across dialog open/close
const persistentTerminals = new Map<string, { ptyId: string; outputBuffer: string[] }>();

// Helper to detect Super Agent
const isSuperAgent = (agent: { name?: string } | null) => {
  if (!agent) return false;
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
};

interface AgentTerminalDialogProps {
  agent: AgentStatus | null;
  open: boolean;
  onClose: () => void;
  onStart: (agentId: string, prompt: string) => void;
  onStop: (agentId: string) => void;
  projects?: { path: string; name: string }[];
  agents?: AgentStatus[]; // All agents (for Super Agent sidebar)
  onBrowseFolder?: () => Promise<string | null>;
  onAgentUpdated?: (agent: AgentStatus) => void;
  onUpdateAgent?: (params: {
    id: string;
    skills?: string[];
    secondaryProjectPath?: string | null;
    skipPermissions?: boolean;
  }) => Promise<{ success: boolean; error?: string; agent?: AgentStatus }>;
  initialPanel?: PanelType; // Panel to expand when dialog opens
  skipHistoricalOutput?: boolean; // Skip showing old output (useful when opening mid-task)
}

// Panel types for the sidebar
type PanelType = 'code' | 'git' | 'terminal' | 'context' | 'settings';

// Import Zap icon for skip permissions
import { Zap } from 'lucide-react';

// Memoized simplified header component
const DialogHeader = memo(function DialogHeader({
  agent,
  character,
  isFullscreen,
  hasSecondaryProject,
  isSuperAgentMode,
  onOpenInFinder,
  onToggleFullscreen,
  onClose,
}: {
  agent: AgentStatus;
  character: string;
  isFullscreen: boolean;
  hasSecondaryProject: boolean;
  isSuperAgentMode: boolean;
  onOpenInFinder: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="px-5 py-3 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/30">
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          {isSuperAgentMode ? '👑' : CHARACTER_FACES[character as keyof typeof CHARACTER_FACES] || '🤖'}
        </span>
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            {agent.name || 'Agent'}
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full
                ${agent.status === 'running' ? 'bg-accent-cyan/20 text-accent-cyan' : ''}
                ${agent.status === 'idle' ? 'bg-text-muted/20 text-text-muted' : ''}
                ${agent.status === 'completed' ? 'bg-accent-green/20 text-accent-green' : ''}
                ${agent.status === 'error' ? 'bg-accent-red/20 text-accent-red' : ''}
              `}
            >
              {agent.status}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {isSuperAgentMode ? (
              <span className="text-amber-400 flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Orchestrator
              </span>
            ) : (
              <>
                <span className="font-mono truncate max-w-[200px]">
                  {agent.projectPath.split('/').pop()}
                </span>
                {agent.branchName && (
                  <span className="text-accent-purple flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {agent.branchName}
                  </span>
                )}
                {hasSecondaryProject && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    +1 context
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {!isSuperAgentMode && (
          <>
            <button
              onClick={onOpenInFinder}
              className="p-2 hover:bg-bg-tertiary rounded-none transition-colors"
              title="Open in Finder"
            >
              <FolderOpen className="w-4 h-4 text-text-muted" />
            </button>
            <div className="w-px h-5 bg-border-primary mx-1" />
          </>
        )}
        <button
          onClick={onToggleFullscreen}
          className="p-2 hover:bg-bg-tertiary rounded-none transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-bg-tertiary rounded-none transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

// Accordion panel header component
const PanelHeader = memo(function PanelHeader({
  icon: Icon,
  title,
  color,
  isExpanded,
  badge,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  isExpanded: boolean;
  badge?: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-bg-tertiary/50 ${
        isExpanded ? 'bg-bg-tertiary/30' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm font-medium">{title}</span>
        {badge}
      </div>
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
    </button>
  );
});

// Memoized secondary project content
const SecondaryProjectContent = memo(function SecondaryProjectContent({
  agent,
  availableProjects,
  customSecondaryPath,
  onCustomPathChange,
  onSetSecondaryProject,
  onBrowseFolder,
}: {
  agent: AgentStatus;
  availableProjects: { path: string; name: string }[];
  customSecondaryPath: string;
  onCustomPathChange: (value: string) => void;
  onSetSecondaryProject: (path: string | null) => void;
  onBrowseFolder?: () => Promise<string | null>;
}) {
  // Get the selected project name
  const selectedProjectName = agent.secondaryProjectPath?.split('/').pop() || '';

  // Filter out already selected project from available list
  const unselectedProjects = availableProjects.filter(p => p.path !== agent.secondaryProjectPath);

  return (
    <div className="p-3 space-y-3">
      {/* Active context - shown at top, clickable to remove */}
      {agent.secondaryProjectPath && (
        <div>
          <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wide">Active Context</p>
          <button
            onClick={() => onSetSecondaryProject(null)}
            className="w-full text-left px-2 py-1.5 rounded-none text-xs transition-colors flex items-center justify-between bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderPlus className="w-3 h-3 shrink-0" />
              <span className="truncate">{selectedProjectName}</span>
            </div>
            <X className="w-3 h-3 shrink-0 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Available projects to add */}
      {unselectedProjects.length > 0 && (
        <div>
          <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wide">Available Projects</p>
          <div className="space-y-1">
            {unselectedProjects.slice(0, 6).map((project) => (
              <div
                key={project.path}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-none text-xs hover:bg-bg-tertiary/50"
              >
                <div className="flex items-center gap-2 min-w-0 text-text-secondary">
                  <FolderPlus className="w-3 h-3 shrink-0" />
                  <span className="truncate">{project.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetSecondaryProject(project.path);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/30 shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom path */}
      <div>
        <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wide">Custom Path</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customSecondaryPath}
            onChange={(e) => onCustomPathChange(e.target.value)}
            placeholder="/path/to/project..."
            className="flex-1 px-2 py-1 rounded text-xs bg-bg-primary border border-border-primary focus:border-amber-500 focus:outline-none font-mono"
          />
          {onBrowseFolder && (
            <button
              onClick={async () => {
                const path = await onBrowseFolder();
                if (path) onCustomPathChange(path);
              }}
              className="p-1 rounded bg-bg-tertiary border border-border-primary hover:border-amber-500/50"
              title="Browse"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
          <button
            onClick={() => customSecondaryPath.trim() && onSetSecondaryProject(customSecondaryPath.trim())}
            disabled={!customSecondaryPath.trim()}
            className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
});

// Super Agent Sidebar showing agents and projects
const SuperAgentSidebar = memo(function SuperAgentSidebar({
  agents,
  projects,
}: {
  agents: AgentStatus[];
  projects: { path: string; name: string }[];
}) {
  // Filter out the super agent itself from the list
  const otherAgents = agents.filter(a => !isSuperAgent(a));

  // Group agents by status
  const runningAgents = otherAgents.filter(a => a.status === 'running');
  const idleAgents = otherAgents.filter(a => a.status === 'idle' || a.status === 'completed');
  const errorAgents = otherAgents.filter(a => a.status === 'error');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-accent-cyan';
      case 'completed': return 'text-accent-green';
      case 'error': return 'text-accent-red';
      default: return 'text-text-muted';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-accent-cyan/20';
      case 'completed': return 'bg-accent-green/20';
      case 'error': return 'bg-accent-red/20';
      default: return 'bg-text-muted/20';
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Agents Section */}
      <div className="border-b border-border-primary">
        <div className="px-3 py-2.5 flex items-center gap-2 bg-bg-tertiary/30">
          <Users className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm font-medium">Agents</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">
            {otherAgents.length}
          </span>
        </div>
        <div className="p-3 space-y-3">
          {/* Running Agents */}
          {runningAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-accent-cyan mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Circle className="w-2 h-2 fill-accent-cyan animate-pulse" />
                Running ({runningAgents.length})
              </p>
              <div className="space-y-1">
                {runningAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-accent-cyan/10 border border-accent-cyan/20"
                  >
                    <span className="text-lg">
                      {CHARACTER_FACES[agent.character as keyof typeof CHARACTER_FACES] || '🤖'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {agent.currentTask?.slice(0, 40) || agent.projectPath.split('/').pop()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Agents */}
          {errorAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-accent-red mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Error ({errorAgents.length})
              </p>
              <div className="space-y-1">
                {errorAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-accent-red/10 border border-accent-red/20"
                  >
                    <span className="text-lg">
                      {CHARACTER_FACES[agent.character as keyof typeof CHARACTER_FACES] || '🤖'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {agent.projectPath.split('/').pop()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Idle/Completed Agents */}
          {idleAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wide">
                Idle ({idleAgents.length})
              </p>
              <div className="space-y-1">
                {idleAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-none hover:bg-bg-tertiary/50"
                  >
                    <span className="text-lg opacity-60">
                      {CHARACTER_FACES[agent.character as keyof typeof CHARACTER_FACES] || '🤖'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-secondary truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {agent.projectPath.split('/').pop()}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBgColor(agent.status)} ${getStatusColor(agent.status)}`}>
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherAgents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">
              No agents created yet
            </p>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="border-b border-border-primary">
        <div className="px-3 py-2.5 flex items-center gap-2 bg-bg-tertiary/30">
          <Folder className="w-4 h-4 text-accent-purple" />
          <span className="text-sm font-medium">Projects</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
            {projects.length}
          </span>
        </div>
        <div className="p-3">
          {projects.length > 0 ? (
            <div className="space-y-1">
              {projects.map((project) => {
                // Count agents on this project
                const projectAgents = otherAgents.filter(
                  a => a.projectPath === project.path || a.worktreePath?.startsWith(project.path)
                );
                const runningCount = projectAgents.filter(a => a.status === 'running').length;

                return (
                  <div
                    key={project.path}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-none hover:bg-bg-tertiary/50"
                  >
                    <Folder className="w-4 h-4 text-accent-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{project.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">
                        {project.path.split('/').slice(-2).join('/')}
                      </p>
                    </div>
                    {projectAgents.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                          {projectAgents.length} agent{projectAgents.length !== 1 ? 's' : ''}
                        </span>
                        {runningCount > 0 && (
                          <span className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">
              No projects added yet
            </p>
          )}
        </div>
      </div>

      {/* MCP Tools Info */}
      <div className="p-3">
        <div className="p-3 rounded-none border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-400">Orchestrator Mode</p>
              <p className="text-[10px] text-text-muted mt-1">
                Use MCP tools to manage agents: create_agent, start_agent, stop_agent, list_agents, send_prompt
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Memoized footer component
const DialogFooter = memo(function DialogFooter({
  agent,
  prompt,
  onPromptChange,
  onStart,
  onStop,
}: {
  agent: AgentStatus;
  prompt: string;
  onPromptChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
      {agent.pathMissing && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-none text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Project path no longer exists: <code className="font-mono text-xs">{agent.projectPath}</code>
          </span>
        </div>
      )}
      {agent.status !== 'running' ? (
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !agent.pathMissing && onStart()}
            placeholder={agent.pathMissing ? 'Cannot start - path not found' : 'Enter a task for this agent...'}
            disabled={agent.pathMissing}
            className={`flex-1 px-4 py-2 bg-bg-primary border border-border-primary rounded-none text-sm focus:outline-none focus:border-accent-cyan ${
              agent.pathMissing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoFocus={!agent.pathMissing}
          />
          <button
            onClick={onStart}
            disabled={!prompt.trim() || agent.pathMissing}
            className={`flex items-center gap-2 px-4 py-2 rounded-none transition-colors disabled:opacity-50 ${
              agent.pathMissing
                ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
            }`}
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-accent-cyan">
            <TerminalIcon className="w-4 h-4" />
            <span>Agent is working: {agent.currentTask?.slice(0, 50)}...</span>
          </div>
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 bg-accent-red/20 text-accent-red rounded-none hover:bg-accent-red/30 transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      )}
    </div>
  );
});

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
  // Check if this is a Super Agent
  const isSuperAgentMode = isSuperAgent(agent);
  const [terminalReady, setTerminalReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prompt, setPrompt] = useState('');

  // Settings panel state
  const [editSkipPermissions, setEditSkipPermissions] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Set<PanelType>>(new Set(['code', 'git']));

  // Track if we've applied the initial panel for this agent
  const appliedInitialPanelRef = useRef<string | null>(null);
  const [quickTerminalReady, setQuickTerminalReady] = useState(false);
  const [customSecondaryPath, setCustomSecondaryPath] = useState('');
  const [gitBranch, setGitBranch] = useState<string>('');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const quickTerminalRef = useRef<HTMLDivElement>(null);
  const quickXtermRef = useRef<import('xterm').Terminal | null>(null);
  const quickFitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const quickPtyIdRef = useRef<string | null>(null);

  // Memoize project path
  const projectPath = useMemo(() => {
    return agent?.worktreePath || agent?.projectPath || '';
  }, [agent?.worktreePath, agent?.projectPath]);

  // Memoize character
  const character = useMemo(() => {
    return agent?.name?.toLowerCase() === 'bitwonka' ? 'frog' : agent?.character || 'robot';
  }, [agent?.name, agent?.character]);

  // Keep track of agent ID and reset state when agent changes
  useEffect(() => {
    agentIdRef.current = agent?.id || null;
    setGitBranch('');
    setEditSkipPermissions(agent?.skipPermissions || false);
  }, [agent?.id, agent?.skipPermissions]);

  // Handle initial panel expansion when dialog opens
  useEffect(() => {
    if (open && agent && initialPanel && appliedInitialPanelRef.current !== agent.id) {
      // Expand the initial panel
      setExpandedPanels(prev => {
        const next = new Set(prev);
        next.add(initialPanel);
        return next;
      });
      appliedInitialPanelRef.current = agent.id;
    }
    // Reset when dialog closes
    if (!open) {
      appliedInitialPanelRef.current = null;
    }
  }, [open, agent, initialPanel]);

  // Initialize xterm when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    const initTerminal = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!terminalRef.current) return;

      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: TERMINAL_THEME,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(terminalRef.current);
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const fitAndResize = () => {
          try {
            fitAddon.fit();
            if (window.electronAPI?.agent?.resize && agent?.id) {
              window.electronAPI.agent.resize({
                id: agent.id,
                cols: term.cols,
                rows: term.rows,
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Failed to fit terminal:', e);
          }
        };

        fitAndResize();
        setTimeout(fitAndResize, 50);
        setTimeout(fitAndResize, 200);
        setTimeout(() => {
          fitAndResize();
          term.focus();
        }, 350);

        // Filter out xterm focus in/out reports (\x1b[I / \x1b[O) that Claude Code
        // requests via DECSET 1004 — these should not be forwarded as user input.
        term.onData(async (data) => {
          const cleaned = data.replace(/\x1b\[(?:I|O)/g, '');
          if (!cleaned) return;
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.sendInput) {
            try {
              await window.electronAPI.agent.sendInput({ id, input: cleaned });
            } catch (err) {
              console.error('Error sending input:', err);
            }
          }
        });

        setTerminalReady(true);

        term.writeln(`\x1b[36m● Connected to ${agent.name || 'Agent'}\x1b[0m`);
        term.writeln('');

        if (window.electronAPI?.agent?.get) {
          try {
            const latestAgent = await window.electronAPI.agent.get(agent.id);
            if (latestAgent?.output && latestAgent.output.length > 0) {
              if (skipHistoricalOutput) {
                // Just show the last few chunks for context (recent output)
                const recentOutput = latestAgent.output.slice(-20);
                if (recentOutput.length > 0) {
                  recentOutput.forEach((line: string) => term.write(line));
                }
              } else {
                // Show all historical output
                term.writeln(`\x1b[33m--- Previous output ---\x1b[0m`);
                latestAgent.output.forEach((line: string) => term.write(line));
              }
              setTimeout(fitAndResize, 50);
            }
          } catch (err) {
            console.error('Failed to fetch agent:', err);
          }
        }
      } catch (e) {
        console.error('Failed to initialize terminal:', e);
      }
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [open, agent?.id]);

  // Listen for agent output - re-subscribe when terminal is ready or agent changes
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput || !terminalReady || !agent?.id) return;

    // Set the ref to make sure it's current
    agentIdRef.current = agent.id;

    const unsubscribe = window.electronAPI.agent.onOutput((event) => {
      if (event.agentId === agent.id && xtermRef.current) {
        xtermRef.current.write(event.data);
      }
    });

    return unsubscribe;
  }, [terminalReady, agent?.id]);

  // Handle resize
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    const fitAndResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(terminalRef.current);
    return () => resizeObserver.disconnect();
  }, [terminalReady]);

  // Fit terminal when fullscreen changes
  useEffect(() => {
    if (!terminalReady || !fitAddonRef.current || !xtermRef.current) return;

    const timeouts = [
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && xtermRef.current && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        }
      }, 50),
      setTimeout(() => fitAddonRef.current?.fit(), 150),
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [isFullscreen, terminalReady]);

  // Quick terminal initialization
  useEffect(() => {
    const agentId = agent?.id;
    const isTerminalExpanded = expandedPanels.has('terminal');
    if (!isTerminalExpanded || !agentId || !projectPath) return;

    if (quickXtermRef.current && quickPtyIdRef.current) return;

    const initQuickTerminal = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!quickTerminalRef.current || quickXtermRef.current) return;

      const rect = quickTerminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initQuickTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: QUICK_TERMINAL_THEME,
        fontSize: 12,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(quickTerminalRef.current);
        quickXtermRef.current = term;
        quickFitAddonRef.current = fitAddon;

        fitAddon.fit();
        setTimeout(() => fitAddon.fit(), 100);
        setTimeout(() => {
          fitAddon.fit();
          term.focus();
        }, 250);

        const existing = persistentTerminals.get(agentId);

        if (existing) {
          quickPtyIdRef.current = existing.ptyId;
          setQuickTerminalReady(true);

          if (existing.outputBuffer.length > 0) {
            existing.outputBuffer.forEach((data) => term.write(data));
          }

          if (window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: existing.ptyId, cols: term.cols, rows: term.rows });
          }
        } else if (window.electronAPI?.pty?.create) {
          const { id: ptyId } = await window.electronAPI.pty.create({
            cwd: projectPath,
            cols: term.cols,
            rows: term.rows,
          });

          quickPtyIdRef.current = ptyId;
          persistentTerminals.set(agentId, { ptyId, outputBuffer: [] });
          setQuickTerminalReady(true);
        }

        term.onData(async (data) => {
          const cleaned = data.replace(/\x1b\[(?:I|O)/g, '');
          if (!cleaned) return;
          if (quickPtyIdRef.current && window.electronAPI?.pty?.write) {
            await window.electronAPI.pty.write({ id: quickPtyIdRef.current, data: cleaned });
          }
        });

        term.onResize(({ cols, rows }) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: quickPtyIdRef.current, cols, rows });
          }
        });
      } catch (e) {
        console.error('Failed to initialize quick terminal:', e);
      }
    };

    initQuickTerminal();

    return () => {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    };
  }, [expandedPanels, agent?.id, projectPath]);

  // Cleanup xterm UI when dialog closes
  useEffect(() => {
    if (!open) {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    }
  }, [open]);

  // Listen for quick terminal PTY output
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.pty?.onData) return;
    const agentId = agent?.id;

    const unsubscribe = window.electronAPI.pty.onData((event) => {
      if (agentId) {
        const existing = persistentTerminals.get(agentId);
        if (existing && event.id === existing.ptyId) {
          existing.outputBuffer.push(event.data);
          if (existing.outputBuffer.length > 1000) {
            existing.outputBuffer.shift();
          }

          if (quickXtermRef.current) {
            quickXtermRef.current.write(event.data);
          }
        }
      }
    });

    return unsubscribe;
  }, [agent?.id]);

  // Memoized callbacks
  const handleStart = useCallback(() => {
    if (agent && prompt.trim()) {
      onStart(agent.id, prompt.trim());
      setPrompt('');
    }
  }, [agent, prompt, onStart]);

  const handleStop = useCallback(() => {
    if (agent) {
      onStop(agent.id);
    }
  }, [agent, onStop]);

  const handleOpenInFinder = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;
    try {
      await window.electronAPI.shell.exec({
        command: `open "${projectPath}"`,
        cwd: projectPath,
      });
    } catch (err) {
      console.error('Failed to open Finder:', err);
    }
  }, [projectPath]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const togglePanel = useCallback((panel: PanelType) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  }, []);

  const handleSetSecondaryProject = useCallback(async (path: string | null) => {
    if (!agent) return;

    // Send /add-dir command to the running Claude terminal
    if (path && window.electronAPI?.agent?.sendInput) {
      try {
        await window.electronAPI.agent.sendInput({
          id: agent.id,
          input: `/add-dir ${path}\r`,
        });
      } catch (err) {
        console.error('Failed to send /add-dir command:', err);
      }
    }

    // Also update the agent's secondaryProjectPath for persistence
    if (window.electronAPI?.agent?.setSecondaryProject) {
      try {
        const result = await window.electronAPI.agent.setSecondaryProject({
          id: agent.id,
          secondaryProjectPath: path,
        });
        if (result.success && result.agent && onAgentUpdated) {
          onAgentUpdated(result.agent);
        }
        if (result.success) {
          setCustomSecondaryPath('');
        }
      } catch (err) {
        console.error('Failed to set secondary project:', err);
      }
    }
  }, [agent, onAgentUpdated]);

  // Handle saving skip permissions setting
  const handleSaveSkipPermissions = useCallback(async (value: boolean) => {
    if (!agent) return;

    setIsSavingSettings(true);
    try {
      if (onUpdateAgent) {
        const result = await onUpdateAgent({
          id: agent.id,
          skipPermissions: value,
        });
        if (result.success && result.agent && onAgentUpdated) {
          onAgentUpdated(result.agent);
        }
      } else if (window.electronAPI?.agent?.update) {
        const result = await window.electronAPI.agent.update({
          id: agent.id,
          skipPermissions: value,
        });
        if (result.success && result.agent && onAgentUpdated) {
          onAgentUpdated(result.agent);
        }
      }
      setEditSkipPermissions(value);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  }, [agent, onUpdateAgent, onAgentUpdated]);

  const closeQuickTerminal = useCallback(() => {
    const agentId = agent?.id;
    if (agentId) {
      const existing = persistentTerminals.get(agentId);
      if (existing && window.electronAPI?.pty?.kill) {
        window.electronAPI.pty.kill({ id: existing.ptyId });
        persistentTerminals.delete(agentId);
      }
    }
    if (quickXtermRef.current) {
      quickXtermRef.current.dispose();
      quickXtermRef.current = null;
      quickFitAddonRef.current = null;
    }
    quickPtyIdRef.current = null;
    setQuickTerminalReady(false);
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      next.delete('terminal');
      return next;
    });
  }, [agent?.id]);

  const handleGitBranchChange = useCallback((branch: string) => {
    setGitBranch(branch);
  }, []);

  // Check if there's an active terminal session
  const hasActiveTerminal = useMemo(() => {
    return agent ? persistentTerminals.has(agent.id) : false;
  }, [agent]);

  // Check if agent has a secondary project
  const hasSecondaryProject = useMemo(() => {
    return !!agent?.secondaryProjectPath;
  }, [agent?.secondaryProjectPath]);

  // Get available projects (excluding primary)
  const availableProjects = useMemo(() => {
    if (!agent) return projects;
    return projects.filter(p => p.path !== agent.projectPath && p.path !== agent.worktreePath);
  }, [projects, agent?.projectPath, agent?.worktreePath]);

  // Compute dialog class
  const dialogClass = useMemo(() => {
    if (isFullscreen) return 'fixed inset-4';
    return 'w-full max-w-[80vw] h-[85vh]';
  }, [isFullscreen]);

  if (!open || !agent) return null;

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
          <DialogHeader
            agent={agent}
            character={character}
            isFullscreen={isFullscreen}
            hasSecondaryProject={hasSecondaryProject}
            isSuperAgentMode={isSuperAgentMode}
            onOpenInFinder={handleOpenInFinder}
            onToggleFullscreen={handleToggleFullscreen}
            onClose={onClose}
          />

          {/* Main Content */}
          <div className="flex-1 min-h-[300px] flex overflow-hidden">
            {/* Terminal - Main Area */}
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
            </div>

            {/* Right Sidebar - Different for Super Agent */}
            <div
              className="border-l border-border-primary bg-bg-tertiary/20 flex flex-col overflow-hidden"
              style={{ width: '480px' }}
            >
              {isSuperAgentMode ? (
                <SuperAgentSidebar agents={agents} projects={projects} />
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Code Panel */}
                  <div className="border-b border-border-primary">
                    <PanelHeader
                      icon={Code2}
                      title="Code"
                      color="text-purple-400"
                      isExpanded={expandedPanels.has('code')}
                      onToggle={() => togglePanel('code')}
                    />
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: expandedPanels.has('code') ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="h-[250px]">
                          <CodePanel projectPath={projectPath} className="h-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Git Panel */}
                  <div className="border-b border-border-primary">
                    <PanelHeader
                      icon={GitBranch}
                      title="Git"
                      color="text-orange-400"
                      isExpanded={expandedPanels.has('git')}
                      badge={
                        gitBranch ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono">
                            {gitBranch}
                          </span>
                        ) : null
                      }
                      onToggle={() => togglePanel('git')}
                    />
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: expandedPanels.has('git') ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="h-[200px]">
                          <GitPanel
                            projectPath={projectPath}
                            className="h-full"
                            hideHeader
                            onBranchChange={handleGitBranchChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Panel */}
                  <div className="border-b border-border-primary">
                    <PanelHeader
                      icon={TerminalSquare}
                      title="Shell"
                      color="text-cyan-400"
                      isExpanded={expandedPanels.has('terminal')}
                      badge={
                        hasActiveTerminal && !expandedPanels.has('terminal') ? (
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        ) : null
                      }
                      onToggle={() => togglePanel('terminal')}
                    />
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: expandedPanels.has('terminal') ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="h-[180px] relative">
                          <div className="absolute top-1 right-1 z-10">
                            <button
                              onClick={closeQuickTerminal}
                              className="p-1 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-red transition-colors"
                              title="Close terminal (kills process)"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div
                            ref={quickTerminalRef}
                            className="absolute inset-0 bg-[#0f0f1a] p-1"
                            style={{ cursor: 'text' }}
                            onClick={() => quickXtermRef.current?.focus()}
                          />
                          {!quickTerminalReady && expandedPanels.has('terminal') && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
                              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Context Panel (+Project) */}
                  <div className="border-b border-border-primary">
                    <PanelHeader
                      icon={Layers}
                      title="Context"
                      color="text-amber-400"
                      isExpanded={expandedPanels.has('context')}
                      badge={
                        hasSecondaryProject ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            +1
                          </span>
                        ) : null
                      }
                      onToggle={() => togglePanel('context')}
                    />
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: expandedPanels.has('context') ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <SecondaryProjectContent
                          agent={agent}
                          availableProjects={availableProjects}
                          customSecondaryPath={customSecondaryPath}
                          onCustomPathChange={setCustomSecondaryPath}
                          onSetSecondaryProject={handleSetSecondaryProject}
                          onBrowseFolder={onBrowseFolder}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Settings Panel */}
                  <div className="border-b border-border-primary">
                    <PanelHeader
                      icon={Settings2}
                      title="Settings"
                      color="text-zinc-400"
                      isExpanded={expandedPanels.has('settings')}
                      badge={
                        agent.skipPermissions ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            Auto
                          </span>
                        ) : null
                      }
                      onToggle={() => togglePanel('settings')}
                    />
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: expandedPanels.has('settings') ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="p-3 space-y-4">
                          {/* Skip Permissions Toggle */}
                          <div className="p-3 rounded-none border border-amber-500/30 bg-amber-500/5">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleSaveSkipPermissions(!editSkipPermissions)}
                                disabled={isSavingSettings}
                                className={`
                                  mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
                                  ${editSkipPermissions
                                    ? 'bg-amber-500 border-amber-500'
                                    : 'border-amber-500/50 hover:border-amber-500'
                                  }
                                  ${isSavingSettings ? 'opacity-50' : ''}
                                `}
                              >
                                {isSavingSettings ? (
                                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                                ) : editSkipPermissions ? (
                                  <Check className="w-3 h-3 text-white" />
                                ) : null}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium text-sm">Skip Permissions</span>
                                </div>
                                <p className="text-xs text-text-muted mt-1">
                                  Run without asking for permission on each action. Changes take effect on next task.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Agent Info */}
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Skills:</span>
                              <span>{agent.skills.length > 0 ? agent.skills.join(', ') : 'None'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Character:</span>
                              <span>{agent.character || 'robot'}</span>
                            </div>
                            {agent.branchName && (
                              <div className="flex justify-between">
                                <span className="text-text-muted">Branch:</span>
                                <span className="font-mono text-accent-purple">{agent.branchName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter
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
