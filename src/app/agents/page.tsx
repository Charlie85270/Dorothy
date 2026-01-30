'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Play,
  Square,
  Trash2,
  Plus,
  Terminal as TerminalIcon,
  Loader2,
  Circle,
  Sparkles,
  FolderOpen,
  Cpu,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  MonitorDown,
  GitBranch,
  Layers,
  AlertTriangle,
  Pencil,
  Crown,
} from 'lucide-react';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import { useClaude } from '@/hooks/useClaude';
import type { AgentCharacter } from '@/types/electron';
import NewChatModal from '@/components/NewChatModal';
import AgentTerminalDialog from '@/components/AgentWorld/AgentTerminalDialog';
import type { AgentStatus } from '@/types/electron';
// Import xterm CSS
import 'xterm/css/xterm.css';

const STATUS_COLORS: Record<AgentStatus['status'], { bg: string; text: string; icon: typeof Circle }> = {
  idle: { bg: 'bg-white/10', text: 'text-muted-foreground', icon: Circle },
  running: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Activity },
  completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: CheckCircle },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle },
  waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Pause },
};

// Generate consistent color for project based on name
const getProjectColor = (name: string) => {
  const colors = [
    { bg: 'bg-white/10', text: 'text-white/80', border: 'border-white/20' },
    { bg: 'bg-white/15', text: 'text-white/90', border: 'border-white/25' },
    { bg: 'bg-white/8', text: 'text-white/70', border: 'border-white/15' },
    { bg: 'bg-white/12', text: 'text-white/85', border: 'border-white/22' },
    { bg: 'bg-white/10', text: 'text-white/80', border: 'border-white/20' },
    { bg: 'bg-white/15', text: 'text-white/90', border: 'border-white/25' },
    { bg: 'bg-white/8', text: 'text-white/70', border: 'border-white/15' },
    { bg: 'bg-white/12', text: 'text-white/85', border: 'border-white/22' },
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Character emoji mapping
const CHARACTER_FACES: Record<string, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

export default function AgentsPage() {
  const {
    agents,
    isLoading: agentsLoading,
    isElectron: hasElectron,
    createAgent,
    startAgent,
    stopAgent,
    removeAgent,
    sendInput,
  } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();
  const { data: claudeData } = useClaude();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showStartPromptModal, setShowStartPromptModal] = useState(false);
  const [startPromptValue, setStartPromptValue] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | null>(null); // null = All
  const startPromptInputRef = useRef<HTMLInputElement>(null);
  const [editAgentId, setEditAgentId] = useState<string | null>(null); // For edit dialog
  const [isCreatingSuperAgent, setIsCreatingSuperAgent] = useState(false);

  // Find existing super agent
  const superAgent = useMemo(() => {
    return agents.find(a =>
      a.name?.toLowerCase().includes('super agent') ||
      a.name?.toLowerCase().includes('orchestrator')
    ) || null;
  }, [agents]);

  // Orchestrator prompt for Super Agent
  const orchestratorPrompt = `You are the Super Agent - an orchestrator that manages other agents using MCP tools.

AVAILABLE MCP TOOLS (from "claude-mgr-orchestrator"):
- list_agents: List all agents with status, project, ID
- get_agent_output: Read agent's terminal output (use to see responses!)
- start_agent: Start agent with a prompt (auto-sends to running agents too)
- send_message: Send message to agent (auto-starts idle agents)
- stop_agent: Stop a running agent
- create_agent: Create a new agent
- remove_agent: Delete an agent

WORKFLOW - When asked to talk to an agent:
1. Use start_agent or send_message with your question (both auto-handle idle/running states)
2. Wait 5-10 seconds for the agent to process
3. Use get_agent_output to read their response
4. Report the response back to the user

IMPORTANT:
- ALWAYS check get_agent_output after sending a message to see the response
- Keep responses concise
- NEVER explore codebases - you only manage agents

Say hello and list the current agents.`;

  // Handle Super Agent button click
  const handleSuperAgentClick = async () => {
    // If super agent exists
    if (superAgent) {
      // If idle, restart it with the orchestrator prompt
      if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
        await startAgent(superAgent.id, orchestratorPrompt);
      }
      setSelectedAgent(superAgent.id);
      return;
    }

    // Check if orchestrator is configured
    if (!window.electronAPI?.orchestrator?.getStatus) {
      console.error('Orchestrator API not available');
      return;
    }

    const status = await window.electronAPI.orchestrator.getStatus();

    // If not configured, set it up first
    if (!status.configured && window.electronAPI?.orchestrator?.setup) {
      const setupResult = await window.electronAPI.orchestrator.setup();
      if (!setupResult.success) {
        console.error('Failed to setup orchestrator:', setupResult.error);
        return;
      }
    }

    // Create a new super agent
    setIsCreatingSuperAgent(true);
    try {
      // Use the first project path or a default
      const projectPath = projects[0]?.path || '/tmp';

      const agent = await createAgent({
        projectPath,
        skills: [],
        character: 'wizard',
        name: 'Super Agent (Orchestrator)',
        skipPermissions: true,
      });

      setSelectedAgent(agent.id);

      // Start with orchestrator instructions
      setTimeout(async () => {
        await startAgent(agent.id, orchestratorPrompt);
      }, 600);
    } catch (error) {
      console.error('Failed to create super agent:', error);
    } finally {
      setIsCreatingSuperAgent(false);
    }
  };

  // Get unique projects from agents
  const uniqueProjects = useMemo(() => {
    const projectSet = new Map<string, string>();
    agents.forEach((agent) => {
      const projectName = agent.projectPath.split('/').pop() || 'Unknown';
      projectSet.set(agent.projectPath, projectName);
    });
    return Array.from(projectSet.entries()).map(([path, name]) => ({ path, name }));
  }, [agents]);

  // Helper to detect super agent
  const isSuperAgentCheck = (agent: AgentStatus) => {
    const name = agent.name?.toLowerCase() || '';
    return name.includes('super agent') || name.includes('orchestrator');
  };

  // Filter agents by selected project, with Super Agent always at top, then sorted by status
  const filteredAgents = useMemo(() => {
    let filtered = projectFilter ? agents.filter(a => a.projectPath === projectFilter) : agents;

    // Status priority: running = 0, waiting = 1, idle/completed/error = 2
    const getStatusPriority = (status: string) => {
      if (status === 'running') return 0;
      if (status === 'waiting') return 1;
      return 2;
    };

    // Sort: Super Agent first, then by status (running > waiting > idle)
    return [...filtered].sort((a, b) => {
      const aIsSuper = isSuperAgentCheck(a);
      const bIsSuper = isSuperAgentCheck(b);

      // Super Agent always first
      if (aIsSuper && !bIsSuper) return -1;
      if (!aIsSuper && bIsSuper) return 1;

      // Then sort by status priority
      const aPriority = getStatusPriority(a.status);
      const bPriority = getStatusPriority(b.status);
      return aPriority - bPriority;
    });
  }, [agents, projectFilter]);

  // xterm refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const selectedAgentIdRef = useRef<string | null>(null);

  // Keep track of selected agent ID for event handling
  useEffect(() => {
    selectedAgentIdRef.current = selectedAgent;
  }, [selectedAgent]);

  // Get selected agent data
  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  // Keep agents in a ref for access in callbacks
  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // Initialize xterm when an agent is selected
  useEffect(() => {
    if (!selectedAgent || !terminalRef.current) return;

    // Clean up existing terminal if any
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#e4e4e7',
          cursor: '#22d3ee',
          cursorAccent: '#0a0a0f',
          selectionBackground: '#22d3ee33',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#fafafa',
        },
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Fit after a short delay to ensure proper sizing
      setTimeout(async () => {
        fitAddon.fit();
        term.focus();
        // Send initial resize to agent PTY (ignore errors if PTY not ready)
        if (window.electronAPI?.agent?.resize) {
          try {
            await window.electronAPI.agent.resize({
              id: selectedAgent,
              cols: term.cols,
              rows: term.rows,
            });
          } catch (err) {
            console.warn('Failed to resize agent PTY:', err);
          }
        }
      }, 100);

      // Focus terminal on click
      const container = terminalRef.current!;
      const handleClick = () => term.focus();
      container.addEventListener('click', handleClick);

      // Handle user input - send to agent PTY
      term.onData(async (data) => {
        const agentId = selectedAgentIdRef.current;
        if (agentId && window.electronAPI?.agent?.sendInput) {
          try {
            const result = await window.electronAPI.agent.sendInput({ id: agentId, input: data });
            if (!result.success) {
              console.warn('Failed to send input to agent');
            }
          } catch (err) {
            console.error('Error sending input to agent:', err);
          }
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const agentId = selectedAgentIdRef.current;
          if (agentId && xtermRef.current && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id: agentId,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {
              // Ignore resize errors (PTY might have exited)
            });
          }
        }
      });
      resizeObserver.observe(terminalRef.current!);

      setTerminalReady(true);

      // Write a welcome message
      term.writeln('\x1b[36m● Terminal connected to agent\x1b[0m');
      term.writeln('');

      // Fetch latest agent data from main process to get all stored output
      console.log('Fetching agent data for:', selectedAgent);
      if (window.electronAPI?.agent?.get) {
        try {
          const latestAgent = await window.electronAPI.agent.get(selectedAgent);
          console.log('Fetched agent data:', latestAgent?.id, 'output length:', latestAgent?.output?.length);
          if (latestAgent && latestAgent.output && latestAgent.output.length > 0) {
            term.writeln(`\x1b[33m--- Replaying ${latestAgent.output.length} previous output chunks ---\x1b[0m`);
            latestAgent.output.forEach(line => {
              term.write(line);
            });
          } else {
            term.writeln('\x1b[90m(No previous output)\x1b[0m');
          }
        } catch (err) {
          console.error('Failed to fetch agent data:', err);
          term.writeln(`\x1b[31mFailed to fetch agent data: ${err}\x1b[0m`);
        }
      } else {
        term.writeln('\x1b[31mElectron API not available\x1b[0m');
      }

      return () => {
        resizeObserver.disconnect();
        container.removeEventListener('click', handleClick);
      };
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
  }, [selectedAgent]);

  // Listen for agent output events
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput) {
      console.log('Agent output listener not set up - electronAPI not available');
      return;
    }

    console.log('Setting up agent output listener');
    const unsubscribe = window.electronAPI.agent.onOutput((event) => {
      console.log('Received agent output event:', event.agentId, 'data length:', event.data?.length);
      if (event.agentId === selectedAgentIdRef.current && xtermRef.current) {
        xtermRef.current.write(event.data);
      } else {
        console.log('Skipping event - agent:', selectedAgentIdRef.current, 'xterm:', !!xtermRef.current);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for agent error events
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onError) return;

    const unsubscribe = window.electronAPI.agent.onError((event) => {
      if (event.agentId === selectedAgentIdRef.current && xtermRef.current) {
        xtermRef.current.write(`\x1b[31m${event.data}\x1b[0m`);
      }
    });

    return unsubscribe;
  }, []);

  const handleCreateAgent = async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean
  ) => {
    try {
      const agent = await createAgent({ projectPath, skills, worktree, character, name, secondaryProjectPath, skipPermissions });
      setSelectedAgent(agent.id);
      setShowNewChatModal(false);

      // If prompt provided, start immediately
      if (prompt) {
        // Small delay to let the terminal initialize
        setTimeout(async () => {
          await startAgent(agent.id, prompt, { model });
        }, 600);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  // Handle starting agent with prompt
  const handleStartAgent = async (agentId: string, prompt: string) => {
    // Clear terminal before starting new task
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    await startAgent(agentId, prompt);
  };

  // Show desktop app required message if not in Electron
  if (!hasElectron && typeof window !== 'undefined') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-none bg-accent-purple/20 flex items-center justify-center mx-auto mb-6">
            <MonitorDown className="w-10 h-10 text-accent-purple" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Desktop App Required</h2>
          <p className="text-text-secondary mb-6">
            The Agent Control Center requires the desktop application to run terminal commands and manage Claude Code agents directly on your machine.
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-none bg-bg-tertiary border border-border-primary">
              <p className="text-sm font-medium mb-2">To run the desktop app:</p>
              <code className="block p-2 rounded bg-[#0d0e12] text-accent-blue text-xs font-mono">
                npm run electron:dev
              </code>
            </div>
            <p className="text-xs text-text-muted">
              Or build the Mac app with: <code className="text-accent-purple">npm run electron:build</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (agentsLoading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-4" />
          <p className="text-text-secondary">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col pt-4 lg:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Agent Control Center</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Manage and monitor your Claude Code agents in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Super Agent Button */}
          <button
            onClick={handleSuperAgentClick}
            disabled={isCreatingSuperAgent}
            className={`
              flex items-center justify-center gap-2 px-3 lg:px-4 py-2 font-medium rounded-none transition-all text-sm lg:text-base
              ${superAgent
                ? superAgent.status === 'running' || superAgent.status === 'waiting'
                  ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300 hover:bg-purple-500/30 shadow-lg shadow-purple-500/20'
                  : 'bg-bg-tertiary border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50'
                : 'bg-bg-tertiary border border-border-primary text-text-secondary hover:bg-bg-secondary hover:border-purple-500/50 hover:text-purple-400'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={superAgent ? `Super Agent (${superAgent.status})` : 'Create Super Agent'}
          >
            {isCreatingSuperAgent ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            ) : (
              <div className="relative">
                <Crown className={`w-4 h-4 ${superAgent ? 'text-amber-400' : ''}`} />
                {superAgent && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-tertiary ${
                    superAgent.status === 'running' ? 'bg-green-400 animate-pulse' :
                    superAgent.status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                    superAgent.status === 'error' ? 'bg-red-400' :
                    superAgent.status === 'completed' ? 'bg-cyan-400' :
                    'bg-zinc-500'
                  }`} />
                )}
              </div>
            )}
            <span className="hidden sm:inline">
              {isCreatingSuperAgent ? 'Creating...' : 'Super Agent'}
            </span>
          </button>

          {/* New Agent Button */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm lg:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Agent</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Project Filter Tabs - Horizontal */}
      {uniqueProjects.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {/* All tab */}
          <button
            onClick={() => setProjectFilter(null)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all whitespace-nowrap
              ${projectFilter === null
                ? 'bg-white text-black'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
              }
            `}
          >
            <Layers className="w-4 h-4" />
            All Projects
            <span className={`px-1.5 py-0.5 text-xs ${
              projectFilter === null ? 'bg-black/10' : 'bg-white/10'
            }`}>
              {agents.length}
            </span>
          </button>

          {/* Project tabs */}
          {uniqueProjects.map(({ path, name }) => {
            const agentCount = agents.filter(a => a.projectPath === path).length;
            const isActive = projectFilter === path;

            return (
              <button
                key={path}
                onClick={() => setProjectFilter(path)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-white text-black'
                    : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
                  }
                `}
                title={path}
              >
                <FolderOpen className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{name}</span>
                <span className={`px-1.5 py-0.5 text-xs ${
                  isActive ? 'bg-black/10' : 'bg-white/10'
                }`}>
                  {agentCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        {/* Agent List */}
        <div className="w-full lg:w-96 flex flex-col border border-border bg-card overflow-hidden lg:shrink-0 h-48 lg:h-auto">
          <div className="px-4 py-3 border-b border-border bg-secondary flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Bot className="w-4 h-4 text-muted-foreground" />
              Active Agents
            </span>
            <span className="text-xs text-muted-foreground">
              {agents.filter((a) => a.status === 'running').length} running
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div>
              {filteredAgents.map((agent) => {
                const statusConfig = STATUS_COLORS[agent.status];
                const StatusIcon = statusConfig.icon;
                const isSelected = selectedAgent === agent.id;
                const projectName = agent.projectPath.split('/').pop() || 'Unknown';
                const projectColor = getProjectColor(projectName);
                const isSuper = isSuperAgentCheck(agent);

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`
                      p-4 cursor-pointer transition-all relative
                      ${isSuper
                        ? 'bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-l-2 border-l-amber-500/50 border-b border-amber-500/20'
                        : 'border-b border-border-primary/50'}
                      ${isSelected ? 'bg-accent-blue/10' : isSuper ? '' : 'hover:bg-bg-tertiary/50'}
                    `}
                  >
                    {/* Subtle gold shimmer for Super Agent */}
                    {isSuper && (
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 to-transparent pointer-events-none" />
                    )}
                    <div className="flex items-start gap-3 relative">
                      <div className={`w-10 h-10 rounded-none flex items-center justify-center shrink-0 relative ${
                        isSuper
                          ? 'bg-gradient-to-br from-amber-500/30 to-yellow-600/20 ring-1 ring-amber-500/30'
                          : agent.name?.toLowerCase() === 'bitwonka'
                            ? 'bg-accent-green/20'
                            : statusConfig.bg
                      }`}>
                        {isSuper ? (
                          <span className="text-xl">👑</span>
                        ) : agent.name?.toLowerCase() === 'bitwonka' ? (
                          <span className="text-xl">🐸</span>
                        ) : agent.character ? (
                          <span className="text-xl">{CHARACTER_FACES[agent.character] || '🤖'}</span>
                        ) : agent.status === 'running' ? (
                          <Loader2 className={`w-5 h-5 ${statusConfig.text} animate-spin`} />
                        ) : (
                          <StatusIcon className={`w-5 h-5 ${statusConfig.text}`} />
                        )}
                        {agent.status === 'running' && (agent.character || agent.name?.toLowerCase() === 'bitwonka' || isSuper) && (
                          <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse ${isSuper ? 'bg-amber-400' : 'bg-accent-blue'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`font-medium text-sm truncate flex items-center gap-1.5 ${isSuper ? 'text-amber-200' : ''}`}>
                            {isSuper && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                            {agent.name || 'Unnamed Agent'}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditAgentId(agent.id);
                              }}
                              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                              title="Edit agent"
                            >
                              <Pencil className="w-3.5 h-3.5 text-text-muted hover:text-accent-blue" />
                            </button>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isSuper && agent.status === 'running'
                                ? 'bg-amber-500/20 text-amber-400'
                                : `${statusConfig.bg} ${statusConfig.text}`
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-text-muted mt-1 truncate">
                          {agent.pathMissing ? (
                            <span className="text-accent-amber flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Path not found
                            </span>
                          ) : (
                            agent.currentTask || 'Waiting for task...'
                          )}
                        </p>
                        {/* Project badge and branch */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[100px] ${projectColor.bg} ${projectColor.text}`}
                            title={agent.projectPath}
                          >
                            {projectName}
                          </span>
                          {agent.branchName && (
                            <span className="flex items-center gap-1 text-[10px] text-accent-purple">
                              <GitBranch className="w-3 h-3" />
                              <span className="font-mono truncate max-w-[80px]">{agent.branchName}</span>
                            </span>
                          )}
                        </div>
                        {agent.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {agent.skills.slice(0, 2).map((skill) => (
                              <span
                                key={skill}
                                className="px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple text-[10px] truncate max-w-[70px]"
                                title={skill}
                              >
                                {skill}
                              </span>
                            ))}
                            {agent.skills.length > 2 && (
                              <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted text-[10px]">
                                +{agent.skills.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredAgents.length === 0 && (
              <div className="p-8 text-center">
                <Bot className="w-10 h-10 mx-auto text-text-muted/30 mb-3" />
                <p className="text-text-muted text-sm">
                  {agents.length === 0 ? 'No agents running' : 'No agents for this project'}
                </p>
                {agents.length === 0 ? (
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-3 text-accent-blue text-sm hover:underline"
                  >
                    Create your first agent
                  </button>
                ) : (
                  <button
                    onClick={() => setProjectFilter(null)}
                    className="mt-3 text-accent-blue text-sm hover:underline"
                  >
                    View all agents
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agent Details / Live View */}
        <div className="flex-1 flex flex-col border border-border bg-card overflow-hidden">
          {selectedAgentData ? (
            <>
              {/* Agent Header */}
              <div className="px-3 lg:px-5 py-3 lg:py-4 border-b border-border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-tertiary/30">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-none ${selectedAgentData.name?.toLowerCase() === 'bitwonka' ? 'bg-accent-green/20' : STATUS_COLORS[selectedAgentData.status].bg} flex items-center justify-center relative`}>
                    {selectedAgentData.name?.toLowerCase() === 'bitwonka' ? (
                      <span className="text-2xl">🐸</span>
                    ) : selectedAgentData.character ? (
                      <span className="text-2xl">{CHARACTER_FACES[selectedAgentData.character] || '🤖'}</span>
                    ) : selectedAgentData.status === 'running' ? (
                      <Cpu className={`w-6 h-6 ${STATUS_COLORS[selectedAgentData.status].text} animate-pulse`} />
                    ) : (
                      <Bot className={`w-6 h-6 ${STATUS_COLORS[selectedAgentData.status].text}`} />
                    )}
                    {selectedAgentData.status === 'running' && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent-blue animate-pulse border border-bg-secondary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{selectedAgentData.name || selectedAgentData.projectPath.split('/').pop()}</h3>
                      {selectedAgentData.branchName && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple text-xs">
                          <GitBranch className="w-3 h-3" />
                          {selectedAgentData.branchName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {selectedAgentData.worktreePath || selectedAgentData.projectPath}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(() => {
                          try {
                            const date = new Date(selectedAgentData.lastActivity);
                            if (isNaN(date.getTime())) return 'Just now';
                            return date.toLocaleTimeString();
                          } catch {
                            return 'Just now';
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedAgentData.pathMissing && (
                    <div className="flex items-center gap-2 px-2 lg:px-3 py-1 lg:py-1.5 bg-accent-amber/20 text-accent-amber rounded-none text-xs lg:text-sm">
                      <AlertTriangle className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span className="hidden sm:inline">Path not found</span>
                    </div>
                  )}
                  {selectedAgentData.status === 'running' ? (
                    <button
                      onClick={() => stopAgent(selectedAgentData.id)}
                      className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 bg-accent-red/20 text-accent-red rounded-none hover:bg-accent-red/30 transition-colors text-xs lg:text-sm"
                    >
                      <Square className="w-3 h-3 lg:w-4 lg:h-4" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setStartPromptValue('');
                        setShowStartPromptModal(true);
                        setTimeout(() => startPromptInputRef.current?.focus(), 100);
                      }}
                      disabled={selectedAgentData.pathMissing}
                      className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-none transition-colors text-xs lg:text-sm ${
                        selectedAgentData.pathMissing
                          ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                          : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                      }`}
                    >
                      <Play className="w-3 h-3 lg:w-4 lg:h-4" />
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => {
                      removeAgent(selectedAgentData.id);
                      setSelectedAgent(null);
                    }}
                    className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 bg-bg-tertiary text-text-muted rounded-none hover:text-accent-red transition-colors"
                  >
                    <Trash2 className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>
                </div>
              </div>

              {/* Skills Bar */}
              {selectedAgentData.skills.length > 0 && (
                <div className="px-5 py-2 border-b border-border-primary bg-accent-purple/5 flex items-center gap-2 overflow-x-auto">
                  <Sparkles className="w-4 h-4 text-accent-purple shrink-0" />
                  <span className="text-xs text-text-muted shrink-0">Skills:</span>
                  {selectedAgentData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple text-xs shrink-0"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Live Terminal Output with xterm */}
              <div className="flex-1 min-h-0 relative overflow-hidden">
                <div
                  ref={terminalRef}
                  className="absolute inset-0 bg-[#0a0a0f] p-2"
                  style={{ cursor: 'text' }}
                />
                {!terminalReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]">
                    <div className="flex items-center gap-2 text-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing terminal...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-muted">Interactive Terminal</span>
                  </div>
                  {selectedAgentData.status === 'running' && (
                    <span className="flex items-center gap-1 text-accent-blue">
                      <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                      Agent is running
                    </span>
                  )}
                  {selectedAgentData.status === 'waiting' && (
                    <span className="flex items-center gap-1 text-accent-amber">
                      <span className="w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
                      Waiting for input
                    </span>
                  )}
                </div>
                <span className="text-text-muted">
                  Type directly in terminal to interact
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-16 h-16 mx-auto text-text-muted/30 mb-4" />
                <h3 className="font-medium text-lg mb-2">Select an Agent</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Choose an agent from the list or create a new one
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="text-accent-blue hover:underline"
                >
                  Create new agent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        open={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onSubmit={handleCreateAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        allInstalledSkills={claudeData?.skills || []}
        onRefreshSkills={refreshSkills}
      />

      {/* Start Agent Prompt Modal */}
      <AnimatePresence>
        {showStartPromptModal && selectedAgentData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowStartPromptModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-bg-secondary border border-border-primary rounded-none p-6 w-full max-w-lg mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-accent-green" />
                Start Agent Task
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Enter the task you want the agent to perform:
              </p>
              <input
                ref={startPromptInputRef}
                type="text"
                value={startPromptValue}
                onChange={(e) => setStartPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && startPromptValue.trim()) {
                    handleStartAgent(selectedAgentData.id, startPromptValue.trim());
                    setShowStartPromptModal(false);
                    setStartPromptValue('');
                  }
                  if (e.key === 'Escape') {
                    setShowStartPromptModal(false);
                  }
                }}
                placeholder="e.g., Fix the bug in login.tsx..."
                className="w-full px-4 py-3 bg-bg-primary border border-border-primary rounded-none text-sm focus:outline-none focus:border-accent-cyan mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowStartPromptModal(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (startPromptValue.trim()) {
                      handleStartAgent(selectedAgentData.id, startPromptValue.trim());
                      setShowStartPromptModal(false);
                      setStartPromptValue('');
                    }
                  }}
                  disabled={!startPromptValue.trim()}
                  className="px-4 py-2 text-sm bg-accent-green/20 text-accent-green rounded-none hover:bg-accent-green/30 transition-colors disabled:opacity-50"
                >
                  Start Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Agent Dialog */}
      <AgentTerminalDialog
        agent={editAgentId ? agents.find(a => a.id === editAgentId) || null : null}
        open={!!editAgentId}
        onClose={() => setEditAgentId(null)}
        onStart={handleStartAgent}
        onStop={stopAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        agents={agents}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        initialPanel="settings"
      />
    </div>
  );
}
