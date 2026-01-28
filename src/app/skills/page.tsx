'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Loader2,
  Package,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Terminal as TerminalIcon,
  Plus,
  X,
  TrendingUp,
  Zap,
  Copy,
  Check,
  Download,
  MonitorDown,
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills, isElectron } from '@/hooks/useElectron';
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
// Import xterm CSS
import 'xterm/css/xterm.css';

export default function SkillsPage() {
  const { data, loading, error } = useClaude();
  const { installedSkills, installSkill, isElectron: hasElectron } = useElectronSkills();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom skill installation
  const [showCustomInstall, setShowCustomInstall] = useState(false);
  const [customRepo, setCustomRepo] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');

  // Terminal modal for installation
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [currentInstallRepo, setCurrentInstallRepo] = useState('');
  const [currentInstallPtyId, setCurrentInstallPtyId] = useState<string | null>(null);
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [pendingInstallRepo, setPendingInstallRepo] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  const installedPlugins = data?.plugins || [];
  const installedSkillsFromClaude = data?.skills || [];

  // Initialize xterm when terminal modal opens
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

      // Handle user input - send to PTY
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

      // Terminal is ready - signal that we can start the PTY
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

  // Start PTY only after terminal is ready
  useEffect(() => {
    if (!terminalReady || !pendingInstallRepo || !window.electronAPI?.skill?.installStart) return;

    const startPty = async () => {
      try {
        const result = await window.electronAPI!.skill.installStart({ repo: pendingInstallRepo });
        setCurrentInstallPtyId(result.id);
        ptyIdRef.current = result.id;
        setPendingInstallRepo(null);
      } catch (err) {
        setShowToast({
          message: `Failed to start installation: ${err instanceof Error ? err.message : 'Unknown error'}`,
          type: 'error',
        });
        setInstallingSkill(null);
        setShowInstallTerminal(false);
        setTimeout(() => setShowToast(null), 4000);
      }
    };

    startPty();
  }, [terminalReady, pendingInstallRepo]);

  // Listen for PTY data - always subscribe when in electron
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyData) return;

    const unsubscribe = window.electronAPI.skill.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit - always subscribe when in electron
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyExit) return;

    const unsubscribe = window.electronAPI.skill.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
        setInstallingSkill(null);
      }
    });

    return unsubscribe;
  }, []);
  const settings = data?.settings;

  // Get list of installed skill names (from all sources)
  const installedSkillNames = useMemo(() => {
    const fromPlugins = installedPlugins.map(p => p.name.toLowerCase());
    const fromClaudeSkills = installedSkillsFromClaude.map(s => s.name.toLowerCase());
    const fromElectron = installedSkills.map(s => s.toLowerCase());
    return [...new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron])];
  }, [installedPlugins, installedSkillsFromClaude, installedSkills]);

  // Check if a skill is installed
  const isSkillInstalled = (skillName: string) => {
    return installedSkillNames.includes(skillName.toLowerCase());
  };

  // Filter skills from database
  const filteredSkills = useMemo(() => {
    let skills = SKILLS_DATABASE;

    if (search) {
      const q = search.toLowerCase();
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
  }, [search, selectedCategory]);

  // Install skill directly (Electron only)
  const handleDirectInstall = async (repo: string, skillName: string) => {
    if (!hasElectron) {
      copyInstallCommand(repo, skillName);
      return;
    }

    const fullRepo = `${repo}/${skillName}`;
    setInstallingSkill(skillName);
    setCurrentInstallRepo(fullRepo);
    setInstallComplete(false);
    setInstallExitCode(null);
    setCurrentInstallPtyId(null);
    ptyIdRef.current = null;
    // Show terminal first, then start PTY after terminal is ready
    setShowInstallTerminal(true);
    setPendingInstallRepo(fullRepo);
  };

  const copyInstallCommand = async (repo: string, skillName: string) => {
    const command = `npx skills add https://github.com/${repo} --skill ${skillName}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedSkill(skillName);
      setShowToast({
        message: `Command copied! Open your terminal and paste to install "${skillName}"`,
        type: 'success',
      });
      setTimeout(() => {
        setCopiedSkill(null);
        setShowToast(null);
      }, 3000);
    } catch (err) {
      setShowToast({
        message: 'Failed to copy to clipboard',
        type: 'info',
      });
    }
  };

  const handleCustomInstall = async () => {
    if (!customRepo) return;

    const fullRepo = customSkillName ? `${customRepo}/${customSkillName}` : customRepo;

    if (hasElectron) {
      setInstallingSkill('custom');
      setCurrentInstallRepo(fullRepo);
      setInstallComplete(false);
      setInstallExitCode(null);
      setCurrentInstallPtyId(null);
      ptyIdRef.current = null;
      setShowCustomInstall(false);
      setCustomRepo('');
      setCustomSkillName('');
      // Show terminal first, then start PTY after terminal is ready
      setShowInstallTerminal(true);
      setPendingInstallRepo(fullRepo);
    } else {
      // Fallback to copy
      const command = customSkillName
        ? `npx skills add https://github.com/${customRepo} --skill ${customSkillName}`
        : `npx skills add https://github.com/${customRepo}`;
      try {
        await navigator.clipboard.writeText(command);
        setShowToast({
          message: 'Command copied! Open your terminal and paste to install.',
          type: 'success',
        });
        setCustomRepo('');
        setCustomSkillName('');
        setShowCustomInstall(false);
        setTimeout(() => setShowToast(null), 3000);
      } catch (err) {
        setShowToast({
          message: 'Failed to copy to clipboard',
          type: 'info',
        });
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
          <p className="text-text-secondary">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-accent-red">
          <p className="mb-2">Failed to load skills</p>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Skills Marketplace</h1>
            <p className="text-text-secondary text-xs lg:text-sm mt-1 hidden sm:block">
              {hasElectron
                ? 'Install skills directly to enhance your Claude agents'
                : 'Browse and copy install commands for skills'
              }
            </p>
          </div>
          <button
            onClick={() => setShowCustomInstall(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent-purple text-white font-medium rounded-lg hover:bg-accent-purple/90 transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Install</span>
            <span className="sm:hidden">Custom</span>
          </button>
        </div>

        {/* Badges row - below on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasElectron && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-amber/10 text-accent-amber text-xs">
              <MonitorDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desktop app for direct install</span>
              <span className="sm:hidden">Desktop only</span>
            </div>
          )}
          <div className="text-xs lg:text-sm text-text-muted">
            <span className="text-accent-purple font-medium">{SKILLS_DATABASE.length}</span> skills
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl border flex items-center justify-between ${
              showToast.type === 'success'
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : showToast.type === 'error'
                ? 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                : 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan'
            }`}
          >
            <div className="flex items-center gap-3">
              {showToast.type === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <p className="text-sm">{showToast.message}</p>
            </div>
            <button onClick={() => setShowToast(null)} className="p-1 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Install Modal */}
      <AnimatePresence>
        {showCustomInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCustomInstall(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TerminalIcon className="w-5 h-5 text-accent-cyan" />
                  Install Custom Skill
                </h3>
                <button onClick={() => setShowCustomInstall(false)} className="p-1 hover:bg-bg-tertiary rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={customRepo}
                    onChange={(e) => setCustomRepo(e.target.value)}
                    placeholder="e.g., anthropics/skills"
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Skill Name (optional)</label>
                  <input
                    type="text"
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    placeholder="e.g., frontend-design"
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Leave empty to install all skills from the repository
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-bg-tertiary/50 border border-border-primary font-mono text-xs text-text-muted">
                  npx skills add https://github.com/{customRepo}{customSkillName ? ` --skill ${customSkillName}` : ''}
                </div>

                <button
                  onClick={handleCustomInstall}
                  disabled={!customRepo || installingSkill === 'custom'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-cyan text-bg-primary font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                >
                  {installingSkill === 'custom' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : hasElectron ? (
                    <>
                      <Download className="w-4 h-4" />
                      Install Skill
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Install Command
                    </>
                  )}
                </button>

                {!hasElectron && (
                  <p className="text-xs text-text-muted text-center">
                    After copying, open your terminal and paste the command to install
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors w-full sm:w-auto sm:min-w-[140px] text-sm"
          >
            <Filter className="w-4 h-4" />
            {selectedCategory || 'All Categories'}
            <ChevronDown className="w-4 h-4 ml-auto" />
          </button>

          <AnimatePresence>
            {showCategoryDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-2 right-0 w-48 bg-bg-secondary border border-border-primary rounded-xl shadow-lg z-10 py-2 max-h-80 overflow-y-auto"
              >
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary ${
                    !selectedCategory ? 'text-accent-cyan' : 'text-text-secondary'
                  }`}
                >
                  All Categories
                </button>
                {SKILL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary ${
                      selectedCategory === cat ? 'text-accent-cyan' : 'text-text-secondary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Installed Skills Section */}
      {installedSkillsFromClaude.length > 0 && (
        <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-accent-green">
            <CheckCircle className="w-4 h-4" />
            Installed Skills ({installedSkillsFromClaude.length})
          </h3>
          <div className="space-y-3">
            {/* Group by source */}
            {['project', 'user', 'plugin'].map((sourceType) => {
              const sourceSkills = installedSkillsFromClaude.filter(s => s.source === sourceType);
              if (sourceSkills.length === 0) return null;

              const sourceLabels: Record<string, string> = {
                project: 'Project Skills',
                user: 'User Skills',
                plugin: 'Plugin Skills',
              };
              const sourceColors: Record<string, string> = {
                project: 'bg-accent-purple/20 text-accent-purple',
                user: 'bg-accent-cyan/20 text-accent-cyan',
                plugin: 'bg-accent-amber/20 text-accent-amber',
              };

              return (
                <div key={sourceType}>
                  <p className="text-xs text-text-muted mb-2">{sourceLabels[sourceType]} ({sourceSkills.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {sourceSkills.map((skill, idx) => (
                      <div
                        key={`${skill.source}-${skill.name}-${idx}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${sourceColors[sourceType]}`}
                        title={skill.description || skill.path}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{skill.name}</span>
                        {skill.projectName && (
                          <span className="text-xs opacity-60">({skill.projectName})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.map((skill, index) => {
          const installed = isSkillInstalled(skill.name);
          const justCopied = copiedSkill === skill.name;
          const isInstalling = installingSkill === skill.name;

          return (
            <motion.div
              key={`${skill.repo}-${skill.name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={`rounded-xl border bg-bg-secondary p-5 hover:border-border-accent transition-all group ${
                installed ? 'border-accent-green/30' : 'border-border-primary'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    installed
                      ? 'bg-accent-green/20'
                      : 'bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20'
                  }`}>
                    {installed ? (
                      <CheckCircle className="w-5 h-5 text-accent-green" />
                    ) : (
                      <Package className="w-5 h-5 text-accent-purple" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
                      #{skill.rank}
                    </span>
                  </div>
                </div>
                {installed ? (
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green text-xs font-medium">
                    <Check className="w-3.5 h-3.5" />
                    Installed
                  </span>
                ) : (
                  <button
                    onClick={() => handleDirectInstall(skill.repo, skill.name)}
                    disabled={isInstalling}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isInstalling
                        ? 'bg-accent-purple/20 text-accent-purple'
                        : justCopied
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'
                    }`}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Installing...
                      </>
                    ) : justCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </>
                    ) : hasElectron ? (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Install
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Install
                      </>
                    )}
                  </button>
                )}
              </div>

              <h3 className="font-semibold text-base mb-1">{skill.name}</h3>
              <p className="text-xs text-text-muted font-mono mb-3">{skill.repo}</p>

              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-1 rounded-full bg-bg-tertiary text-text-muted">
                  {skill.category}
                </span>
                <span className="flex items-center gap-1 text-accent-cyan">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {skill.installs}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-text-muted mb-4" />
          <h3 className="font-medium text-lg mb-2">No skills found</h3>
          <p className="text-text-secondary text-sm">
            Try adjusting your search or filter
          </p>
        </div>
      )}

      {/* How to Install */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-text-muted" />
          CLI Installation
        </h3>
        <div className="space-y-3 text-sm text-text-secondary">
          <p>You can also install skills using the CLI:</p>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-bg-tertiary font-mono text-xs">
              <span className="text-accent-cyan">$</span> npx skills add https://github.com/owner/repo
              <span className="text-text-muted"> # Install all skills from repo</span>
            </div>
            <div className="p-3 rounded-lg bg-bg-tertiary font-mono text-xs">
              <span className="text-accent-cyan">$</span> npx skills add https://github.com/owner/repo --skill skill-name
              <span className="text-text-muted"> # Install specific skill</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Overview */}
      {settings && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-amber" />
            Claude Code Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Co-authored By</p>
              <p className={`font-medium ${settings.includeCoAuthoredBy ? 'text-accent-green' : 'text-text-muted'}`}>
                {settings.includeCoAuthoredBy ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Permissions</p>
              <p className="font-medium">
                {settings.permissions.allow.length} allowed, {settings.permissions.deny.length} denied
              </p>
            </div>

            <div className="p-4 rounded-lg bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Environment Variables</p>
              <p className="font-medium">
                {Object.keys(settings.env).length} configured
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Installation Terminal Modal */}
      <AnimatePresence>
        {showInstallTerminal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden"
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
                        : 'Installing Skill...'}
                    </h3>
                    <p className="text-xs text-text-muted font-mono">{currentInstallRepo}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (ptyIdRef.current && !installComplete) {
                      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
                    }
                    setShowInstallTerminal(false);
                    setCurrentInstallPtyId(null);
                    setPendingInstallRepo(null);
                    ptyIdRef.current = null;
                    if (xtermRef.current) {
                      xtermRef.current.dispose();
                      xtermRef.current = null;
                    }
                  }}
                  className="p-2 hover:bg-bg-tertiary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <p className="text-xs text-text-muted mb-3">
                  This is an interactive terminal. Type your responses and press Enter when prompted.
                </p>
                <div
                  ref={terminalRef}
                  className="bg-[#0a0a0f] rounded-lg overflow-hidden"
                  style={{ height: '400px' }}
                />
              </div>

              <div className="px-5 py-4 border-t border-border-primary flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  {installComplete
                    ? `Exited with code ${installExitCode}`
                    : 'Waiting for installation to complete...'}
                </p>
                <button
                  onClick={() => {
                    if (ptyIdRef.current && !installComplete) {
                      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
                    }
                    setShowInstallTerminal(false);
                    setCurrentInstallPtyId(null);
                    setPendingInstallRepo(null);
                    ptyIdRef.current = null;
                    if (xtermRef.current) {
                      xtermRef.current.dispose();
                      xtermRef.current = null;
                    }
                    if (installComplete && installExitCode === 0) {
                      setShowToast({
                        message: `Successfully installed "${currentInstallRepo}"!`,
                        type: 'success',
                      });
                      setTimeout(() => setShowToast(null), 4000);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    installComplete
                      ? 'bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90'
                      : 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                  }`}
                >
                  {installComplete ? 'Close' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
