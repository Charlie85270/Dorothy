'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FolderOpen,
  FolderPlus,
  Sparkles,
  Search,
  Check,
  Bot,
  Play,
  ChevronDown,
  ChevronRight,
  Zap,
  Filter,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  GitBranch,
  GitFork,
  User,
  Layers,
} from 'lucide-react';
import type { AgentCharacter } from '@/types/electron';

// Character options with emojis and descriptions
const CHARACTER_OPTIONS: { id: AgentCharacter; emoji: string; name: string; description: string }[] = [
  { id: 'robot', emoji: '🤖', name: 'Robot', description: 'Classic AI assistant' },
  { id: 'ninja', emoji: '🥷', name: 'Ninja', description: 'Stealthy and efficient' },
  { id: 'wizard', emoji: '🧙', name: 'Wizard', description: 'Magical problem solver' },
  { id: 'astronaut', emoji: '👨‍🚀', name: 'Astronaut', description: 'Space explorer' },
  { id: 'knight', emoji: '⚔️', name: 'Knight', description: 'Noble defender' },
  { id: 'pirate', emoji: '🏴‍☠️', name: 'Pirate', description: 'Adventurous coder' },
  { id: 'alien', emoji: '👽', name: 'Alien', description: 'Out of this world' },
  { id: 'viking', emoji: '🪓', name: 'Viking', description: 'Fearless warrior' },
];
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
import { isElectron } from '@/hooks/useElectron';
import type { ClaudeSkill } from '@/lib/claude-code';
// Import xterm CSS
import 'xterm/css/xterm.css';

interface Project {
  path: string;
  name: string;
}

interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: WorktreeConfig,
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean
  ) => void;
  projects: Project[];
  onBrowseFolder?: () => Promise<string | null>;
  installedSkills?: string[];
  allInstalledSkills?: ClaudeSkill[]; // Full skills data from useClaude
  onRefreshSkills?: () => void;
  initialProjectPath?: string; // Pre-select a project
  initialStep?: number; // Start at a specific step (1, 2, or 3)
}

export default function NewChatModal({ open, onClose, onSubmit, projects, onBrowseFolder, installedSkills = [], allInstalledSkills = [], onRefreshSkills, initialProjectPath, initialStep }: NewChatModalProps) {
  const [step, setStep] = useState(initialStep || 1);
  const [selectedProject, setSelectedProject] = useState<string>(initialProjectPath || '');
  const [customPath, setCustomPath] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Frontend', 'Development', 'Design']);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'sonnet' | 'opus' | 'haiku'>('sonnet');

  // Worktree state
  const [useWorktree, setUseWorktree] = useState(false);
  const [branchName, setBranchName] = useState('');

  // Character state
  const [agentCharacter, setAgentCharacter] = useState<AgentCharacter>('robot');
  const [agentName, setAgentName] = useState('');

  // Secondary project state
  const [showSecondaryProject, setShowSecondaryProject] = useState(false);
  const [selectedSecondaryProject, setSelectedSecondaryProject] = useState<string>('');
  const [customSecondaryPath, setCustomSecondaryPath] = useState('');

  // Skip permissions state (--dangerously-skip-permissions)
  const [skipPermissions, setSkipPermissions] = useState(false);

  // Installation state
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [installingSkill, setInstallingSkill] = useState<{ name: string; repo: string } | null>(null);
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  const projectPath = selectedProject || customPath;

  // Reset/initialize when modal opens
  useEffect(() => {
    if (open) {
      setStep(initialStep || 1);
      setSelectedProject(initialProjectPath || '');
      setCustomPath('');
      setSelectedSkills([]);
      setPrompt('');
      setUseWorktree(false);
      setBranchName('');
      setAgentCharacter('robot');
      setAgentName('');
      setShowSecondaryProject(false);
      setSelectedSecondaryProject('');
      setCustomSecondaryPath('');
      setSkipPermissions(false);
    }
  }, [open, initialProjectPath, initialStep]);

  // Check if a skill is installed (from either source)
  const isSkillInstalled = (skillName: string) => {
    const lowerName = skillName.toLowerCase();
    const fromElectron = installedSkills.map(s => s.toLowerCase()).includes(lowerName);
    const fromClaude = allInstalledSkills.some(s => s.name.toLowerCase() === lowerName);
    return fromElectron || fromClaude;
  };

  // Initialize xterm when install terminal opens
  useEffect(() => {
    if (!showInstallTerminal || !terminalRef.current || xtermRef.current) return;

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
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = term;

      // Handle user input
      term.onData((data) => {
        if (ptyIdRef.current && window.electronAPI?.skill?.installWrite) {
          window.electronAPI.skill.installWrite({ id: ptyIdRef.current, data });
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ptyIdRef.current && window.electronAPI?.skill?.installResize) {
          window.electronAPI.skill.installResize({
            id: ptyIdRef.current,
            cols: term.cols,
            rows: term.rows,
          });
        }
      });
      resizeObserver.observe(terminalRef.current!);

      setTerminalReady(true);
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [showInstallTerminal]);

  // Start PTY after terminal is ready
  useEffect(() => {
    if (!terminalReady || !installingSkill || !window.electronAPI?.skill?.installStart) return;

    const startPty = async () => {
      try {
        const fullRepo = `${installingSkill.repo}/${installingSkill.name}`;
        const result = await window.electronAPI!.skill.installStart({ repo: fullRepo });
        ptyIdRef.current = result.id;
      } catch (err) {
        console.error('Failed to start installation:', err);
        setShowInstallTerminal(false);
        setInstallingSkill(null);
      }
    };

    startPty();
  }, [terminalReady, installingSkill]);

  // Listen for PTY data
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyData) return;

    const unsubscribe = window.electronAPI.skill.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyExit) return;

    const unsubscribe = window.electronAPI.skill.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
        // Refresh skills list after installation
        if (exitCode === 0 && onRefreshSkills) {
          onRefreshSkills();
        }
      }
    });

    return unsubscribe;
  }, [onRefreshSkills]);

  // Handle install skill
  const handleInstallSkill = (skill: Skill) => {
    setInstallingSkill({ name: skill.name, repo: skill.repo });
    setInstallComplete(false);
    setInstallExitCode(null);
    ptyIdRef.current = null;
    setShowInstallTerminal(true);
  };

  // Close install terminal
  const closeInstallTerminal = () => {
    if (ptyIdRef.current && !installComplete) {
      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
    }
    setShowInstallTerminal(false);
    setInstallingSkill(null);
    ptyIdRef.current = null;
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
  };

  const filteredSkills = useMemo(() => {
    let skills = SKILLS_DATABASE;

    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      skills = skills.filter((s) => s.category === selectedCategory);
    }

    return skills;
  }, [skillSearch, selectedCategory]);

  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    }
    return grouped;
  }, [filteredSkills]);

  const toggleSkill = (skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
    );
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleSubmit = () => {
    if (!projectPath) return;
    if (!prompt.trim() && selectedSkills.length === 0) return;
    if (useWorktree && !branchName.trim()) return;

    // If no prompt but skills are selected, create a prompt from skills
    const finalPrompt = prompt.trim() || `Use the following skills: ${selectedSkills.join(', ')}`;

    // Pass worktree config if enabled
    const worktreeConfig = useWorktree ? { enabled: true, branchName: branchName.trim() } : undefined;

    // Generate default name if not provided
    const projectName = projectPath.split('/').pop() || 'project';
    const finalName = agentName.trim() || `${CHARACTER_OPTIONS.find(c => c.id === agentCharacter)?.name || 'Agent'} on ${projectName}`;

    // Get secondary project path if set
    const secondaryPath = showSecondaryProject ? (selectedSecondaryProject || customSecondaryPath) : undefined;

    onSubmit(projectPath, selectedSkills, finalPrompt, model, worktreeConfig, agentCharacter, finalName, secondaryPath, skipPermissions);
    // Reset form
    setStep(1);
    setSelectedProject('');
    setCustomPath('');
    setSelectedSkills([]);
    setPrompt('');
    setUseWorktree(false);
    setBranchName('');
    setAgentCharacter('robot');
    setAgentName('');
    setShowSecondaryProject(false);
    setSelectedSecondaryProject('');
    setSkipPermissions(false);
    setCustomSecondaryPath('');
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] lg:max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/30">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center">
                <Bot className="w-4 h-4 lg:w-5 lg:h-5 text-bg-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base lg:text-lg">Create New Agent</h2>
                <p className="text-xs lg:text-sm text-text-muted">Step {step} of 3</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-bg-tertiary">
            <motion.div
              initial={{ width: '33%' }}
              animate={{ width: `${(step / 3) * 100}%` }}
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Select Project */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-accent-cyan" />
                    Select Project
                  </h3>
                  <p className="text-text-secondary text-sm mb-4">
                    Choose an existing project or enter a custom path
                  </p>
                </div>

                {/* Existing Projects */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projects.map((project) => (
                    <button
                      key={project.path}
                      onClick={() => {
                        setSelectedProject(project.path);
                        setCustomPath('');
                      }}
                      className={`
                        text-left p-4 rounded-xl border transition-all
                        ${selectedProject === project.path
                          ? 'border-accent-cyan bg-accent-cyan/10'
                          : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-accent-purple" />
                          <span className="font-medium">{project.name}</span>
                        </div>
                        {selectedProject === project.path && (
                          <Check className="w-4 h-4 text-accent-cyan" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-1 truncate font-mono">
                        {project.path}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Custom Path */}
                <div className="relative">
                  <label className="block text-sm font-medium mb-2">Or enter a custom path:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPath}
                      onChange={(e) => {
                        setCustomPath(e.target.value);
                        setSelectedProject('');
                      }}
                      placeholder="/path/to/your/project"
                      className="flex-1 px-4 py-3 rounded-xl font-mono text-sm"
                    />
                    {onBrowseFolder && (
                      <button
                        type="button"
                        onClick={async () => {
                          const path = await onBrowseFolder();
                          if (path) {
                            setCustomPath(path);
                            setSelectedProject('');
                          }
                        }}
                        className="px-4 py-3 rounded-xl bg-bg-tertiary border border-border-primary hover:border-accent-cyan transition-colors flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4 text-accent-cyan" />
                        <span className="text-sm">Browse</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary Project (Collapsible) */}
                <div className="border border-border-primary rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowSecondaryProject(!showSecondaryProject)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <span className="font-medium text-sm flex items-center gap-2">
                      {showSecondaryProject ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Layers className="w-4 h-4 text-accent-purple" />
                      Add second project for context (optional)
                    </span>
                    {(selectedSecondaryProject || customSecondaryPath) && (
                      <span className="text-xs text-accent-purple px-2 py-0.5 rounded bg-accent-purple/10">
                        Selected
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {showSecondaryProject && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4 border-t border-border-primary">
                          <p className="text-xs text-text-muted">
                            The agent will have access to this project via <code className="bg-bg-tertiary px-1 rounded">--add-dir</code>
                          </p>

                          {/* Available projects grid (excluding primary) */}
                          {projects.filter(p => p.path !== projectPath).length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {projects.filter(p => p.path !== projectPath).map((project) => (
                                <button
                                  key={project.path}
                                  onClick={() => {
                                    setSelectedSecondaryProject(project.path);
                                    setCustomSecondaryPath('');
                                  }}
                                  className={`
                                    text-left p-3 rounded-lg border transition-all text-sm
                                    ${selectedSecondaryProject === project.path
                                      ? 'border-accent-purple bg-accent-purple/10'
                                      : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
                                    }
                                  `}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FolderPlus className="w-3.5 h-3.5 text-accent-amber" />
                                      <span className="font-medium">{project.name}</span>
                                    </div>
                                    {selectedSecondaryProject === project.path && (
                                      <Check className="w-3.5 h-3.5 text-accent-purple" />
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted mt-1 truncate font-mono">
                                    {project.path}
                                  </p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted italic">No other projects available</p>
                          )}

                          {/* Custom secondary path */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customSecondaryPath}
                              onChange={(e) => {
                                setCustomSecondaryPath(e.target.value);
                                setSelectedSecondaryProject('');
                              }}
                              placeholder="/path/to/secondary/project"
                              className="flex-1 px-3 py-2 rounded-lg font-mono text-sm"
                            />
                            {onBrowseFolder && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const path = await onBrowseFolder();
                                  if (path) {
                                    setCustomSecondaryPath(path);
                                    setSelectedSecondaryProject('');
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary hover:border-accent-purple transition-colors flex items-center gap-2"
                              >
                                <FolderOpen className="w-4 h-4 text-accent-purple" />
                                <span className="text-sm">Browse</span>
                              </button>
                            )}
                          </div>

                          {/* Clear button */}
                          {(selectedSecondaryProject || customSecondaryPath) && (
                            <button
                              onClick={() => {
                                setSelectedSecondaryProject('');
                                setCustomSecondaryPath('');
                              }}
                              className="text-xs text-text-muted hover:text-accent-red transition-colors flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Clear selection
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Step 2: Select Skills */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-accent-purple" />
                      Assign Skills
                    </h3>
                    <p className="text-text-secondary text-sm">
                      Select skills to enhance your agent (optional)
                    </p>
                  </div>
                  <div className="text-sm text-accent-purple">
                    {selectedSkills.length} selected
                  </div>
                </div>

                {/* Selected Skills */}
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
                    {selectedSkills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs hover:bg-accent-purple/30 transition-colors"
                      >
                        {skill}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Installed Skills Section */}
                {allInstalledSkills.length > 0 && (
                  <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-accent-green">
                      <CheckCircle className="w-4 h-4" />
                      Your Installed Skills ({allInstalledSkills.length})
                    </h4>
                    <div className="space-y-3">
                      {/* Group by source */}
                      {(['project', 'user', 'plugin'] as const).map((sourceType) => {
                        const sourceSkills = allInstalledSkills.filter(s => s.source === sourceType);
                        if (sourceSkills.length === 0) return null;

                        const sourceLabels: Record<string, string> = {
                          project: 'Project Skills',
                          user: 'User Skills',
                          plugin: 'Plugin Skills',
                        };
                        const sourceColors: Record<string, { bg: string; text: string; selected: string }> = {
                          project: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', selected: 'bg-accent-purple/30 border-accent-purple' },
                          user: { bg: 'bg-accent-cyan/10', text: 'text-accent-cyan', selected: 'bg-accent-cyan/30 border-accent-cyan' },
                          plugin: { bg: 'bg-accent-amber/10', text: 'text-accent-amber', selected: 'bg-accent-amber/30 border-accent-amber' },
                        };
                        const colors = sourceColors[sourceType];

                        return (
                          <div key={sourceType}>
                            <p className="text-xs text-text-muted mb-2">{sourceLabels[sourceType]} ({sourceSkills.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {sourceSkills.map((skill, idx) => {
                                const isSelected = selectedSkills.includes(skill.name);
                                return (
                                  <button
                                    key={`${skill.source}-${skill.name}-${idx}`}
                                    onClick={() => toggleSkill(skill.name)}
                                    className={`
                                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border
                                      ${isSelected
                                        ? colors.selected
                                        : `${colors.bg} ${colors.text} border-transparent hover:border-current`
                                      }
                                    `}
                                    title={skill.description || skill.path}
                                  >
                                    {isSelected ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Sparkles className="w-3.5 h-3.5" />
                                    )}
                                    <span>{skill.name}</span>
                                    {skill.projectName && (
                                      <span className="text-xs opacity-60">({skill.projectName})</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Search & Filter for Marketplace */}
                <div className="pt-2 border-t border-border-primary">
                  <p className="text-xs text-text-muted mb-3">Or browse the skills marketplace to install new skills:</p>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="text"
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        placeholder="Search skills marketplace..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setSelectedCategory(selectedCategory ? null : SKILL_CATEGORIES[0])}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Filter className="w-4 h-4" />
                        {selectedCategory || 'All'}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Skills by Category from Marketplace */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {Object.entries(skillsByCategory).map(([category, skills]) => (
                    <div key={category} className="border border-border-primary rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
                      >
                        <span className="font-medium text-sm flex items-center gap-2">
                          {expandedCategories.includes(category) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          {category}
                        </span>
                        <span className="text-xs text-text-muted">{skills.length} skills</span>
                      </button>

                      <AnimatePresence>
                        {expandedCategories.includes(category) && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {skills.map((skill) => {
                                const isSelected = selectedSkills.includes(skill.name);
                                const installed = isSkillInstalled(skill.name);
                                return (
                                  <div
                                    key={skill.name}
                                    className={`
                                      text-left p-3 rounded-lg transition-all
                                      ${isSelected
                                        ? 'bg-accent-purple/20 border-accent-purple/50'
                                        : installed
                                        ? 'bg-bg-secondary/50 hover:bg-bg-tertiary border-transparent'
                                        : 'bg-bg-secondary/30 border-border-primary/50'
                                      }
                                      border
                                    `}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium text-sm ${!installed ? 'text-text-muted' : ''}`}>
                                        {skill.name}
                                      </span>
                                      {installed ? (
                                        isSelected ? (
                                          <Check className="w-4 h-4 text-accent-purple" />
                                        ) : (
                                          <span className="text-xs text-accent-green px-1.5 py-0.5 rounded bg-accent-green/10">
                                            Installed
                                          </span>
                                        )
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleInstallSkill(skill);
                                          }}
                                          className="flex items-center gap-1 text-xs text-accent-cyan px-2 py-1 rounded bg-accent-cyan/10 hover:bg-accent-cyan/20 transition-colors"
                                        >
                                          <Download className="w-3 h-3" />
                                          Install
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs text-text-muted mt-1 font-mono">{skill.repo}</p>
                                    <div className="flex items-center justify-between mt-1">
                                      <p className="text-xs text-accent-cyan">{skill.installs} installs</p>
                                      {installed && (
                                        <button
                                          onClick={() => toggleSkill(skill.name)}
                                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                            isSelected
                                              ? 'bg-accent-purple/20 text-accent-purple'
                                              : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                                          }`}
                                        >
                                          {isSelected ? 'Remove' : 'Add'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Configure & Start */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    <Play className="w-5 h-5 text-accent-green" />
                    Start Your Agent
                  </h3>
                  <p className="text-text-secondary text-sm">
                    Enter your task and choose the model
                  </p>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-border-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Project:</span>
                    <span className="font-mono text-sm truncate max-w-xs">{projectPath}</span>
                  </div>
                  {(selectedSecondaryProject || customSecondaryPath) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        Secondary:
                      </span>
                      <span className="font-mono text-sm truncate max-w-xs text-accent-purple">
                        {(selectedSecondaryProject || customSecondaryPath).split('/').pop()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Skills:</span>
                    <span className="text-sm">
                      {selectedSkills.length > 0 ? `${selectedSkills.length} selected` : 'None'}
                    </span>
                  </div>
                  {useWorktree && branchName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        Branch:
                      </span>
                      <span className="text-sm font-mono text-accent-purple">{branchName}</span>
                    </div>
                  )}
                </div>

                {/* Agent Character & Name */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-accent-purple" />
                      Agent Persona
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {CHARACTER_OPTIONS.map((char) => (
                        <button
                          key={char.id}
                          onClick={() => setAgentCharacter(char.id)}
                          className={`
                            p-3 rounded-xl border transition-all text-center
                            ${agentCharacter === char.id
                              ? 'border-accent-purple bg-accent-purple/10'
                              : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
                            }
                          `}
                        >
                          <span className="text-2xl block mb-1">{char.emoji}</span>
                          <span className="text-xs font-medium block">{char.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Agent Name (optional)</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder={`${CHARACTER_OPTIONS.find(c => c.id === agentCharacter)?.name || 'Agent'} on ${projectPath.split('/').pop() || 'project'}`}
                      className="w-full px-4 py-2 rounded-lg text-sm bg-bg-primary border border-border-primary focus:border-accent-cyan focus:outline-none"
                    />
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['sonnet', 'opus', 'haiku'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`
                          p-3 rounded-xl border transition-all text-center
                          ${model === m
                            ? 'border-accent-cyan bg-accent-cyan/10'
                            : 'border-border-primary hover:border-border-accent'
                          }
                        `}
                      >
                        <Zap className={`w-5 h-5 mx-auto mb-1 ${model === m ? 'text-accent-cyan' : 'text-text-muted'}`} />
                        <span className="font-medium capitalize">{m}</span>
                        <p className="text-xs text-text-muted mt-0.5">
                          {m === 'opus' ? 'Most capable' : m === 'sonnet' ? 'Balanced' : 'Fastest'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Git Worktree Option */}
                <div className="p-4 rounded-xl border border-border-primary bg-bg-tertiary/30">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setUseWorktree(!useWorktree)}
                      className={`
                        mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0
                        ${useWorktree
                          ? 'bg-accent-purple border-accent-purple'
                          : 'border-border-primary hover:border-accent-purple'
                        }
                      `}
                    >
                      {useWorktree && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <GitFork className="w-4 h-4 text-accent-purple" />
                        <span className="font-medium text-sm">Use Git Worktree</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Create an isolated branch for this agent. Perfect for running multiple agents on the same project without conflicts.
                      </p>

                      {/* Branch Name Input */}
                      <AnimatePresence>
                        {useWorktree && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border-primary">
                              <label className="block text-xs font-medium mb-2 flex items-center gap-2">
                                <GitBranch className="w-3.5 h-3.5 text-accent-cyan" />
                                Branch Name
                              </label>
                              <input
                                type="text"
                                value={branchName}
                                onChange={(e) => setBranchName(e.target.value.replace(/\s+/g, '-'))}
                                placeholder="feature/my-task"
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-bg-primary border border-border-primary focus:border-accent-cyan focus:outline-none"
                              />
                              <p className="text-xs text-text-muted mt-1.5">
                                The agent will work in a separate worktree on this branch
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Skip Permissions Option */}
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setSkipPermissions(!skipPermissions)}
                      className={`
                        mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0
                        ${skipPermissions
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-amber-500/50 hover:border-amber-500'
                        }
                      `}
                    >
                      {skipPermissions && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-sm">Skip Permission Prompts</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Run without asking for permission on each action. Use with caution - the agent will have full autonomy.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Task / Prompt {selectedSkills.length > 0 && <span className="text-text-muted font-normal">(optional with skills)</span>}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={selectedSkills.length > 0
                      ? "Optional: Add specific instructions or leave empty to use skills"
                      : "What would you like Claude to help you with?"
                    }
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                  />
                  {selectedSkills.length > 0 && !prompt && (
                    <p className="text-xs text-accent-purple mt-2">
                      Agent will start with selected skills: {selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? ` +${selectedSkills.length - 3} more` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between bg-bg-tertiary/30">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !projectPath}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-cyan text-bg-primary font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={(!prompt.trim() && selectedSkills.length === 0) || (useWorktree && !branchName.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-green text-bg-primary font-medium rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Start Agent
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Skill Installation Terminal Modal */}
        <AnimatePresence>
          {showInstallTerminal && installingSkill && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={closeInstallTerminal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      installComplete
                        ? installExitCode === 0
                          ? 'bg-accent-green/20'
                          : 'bg-accent-red/20'
                        : 'bg-accent-cyan/20'
                    }`}>
                      {installComplete ? (
                        installExitCode === 0 ? (
                          <CheckCircle className="w-4 h-4 text-accent-green" />
                        ) : (
                          <XCircle className="w-4 h-4 text-accent-red" />
                        )
                      ) : (
                        <Loader2 className="w-4 h-4 text-accent-cyan animate-spin" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {installComplete
                          ? installExitCode === 0
                            ? 'Installation Complete'
                            : 'Installation Failed'
                          : `Installing ${installingSkill.name}...`}
                      </h3>
                      <p className="text-xs text-text-muted font-mono">
                        {installingSkill.repo}/{installingSkill.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeInstallTerminal}
                    className="p-2 hover:bg-bg-tertiary rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4">
                  <p className="text-xs text-text-muted mb-3">
                    Interactive terminal - type your responses and press Enter when prompted.
                  </p>
                  <div
                    ref={terminalRef}
                    className="bg-[#0a0a0f] rounded-lg overflow-hidden"
                    style={{ height: '350px' }}
                  />
                </div>

                <div className="px-5 py-4 border-t border-border-primary flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    {installComplete
                      ? `Exited with code ${installExitCode}`
                      : 'Waiting for installation to complete...'}
                  </p>
                  <button
                    onClick={closeInstallTerminal}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      installComplete
                        ? 'bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90'
                        : 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                    }`}
                  >
                    {installComplete ? 'Done' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
