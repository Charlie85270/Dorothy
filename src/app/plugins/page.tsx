'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Terminal as TerminalIcon,
  X,
  Copy,
  Check,
  ExternalLink,
  Info,
  Code2,
  Globe,
  Wrench,
  Palette,
  Shield,
  Zap,
  Tag,
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';
import { isElectron } from '@/hooks/useElectron';
import { PLUGINS_DATABASE, PLUGIN_CATEGORIES, MARKETPLACES, type Plugin } from '@/lib/plugins-database';
// Import xterm CSS
import 'xterm/css/xterm.css';

const CATEGORY_ICONS: Record<string, typeof Code2> = {
  'Code Intelligence': Code2,
  'External Integrations': Globe,
  'Development Workflows': Wrench,
  'Output Styles': Palette,
  'Security': Shield,
  'Productivity': Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Code Intelligence': 'text-blue-400 bg-blue-500/20',
  'External Integrations': 'text-green-400 bg-green-500/20',
  'Development Workflows': 'text-orange-400 bg-orange-500/20',
  'Output Styles': 'text-purple-400 bg-purple-500/20',
  'Security': 'text-red-400 bg-red-500/20',
  'Productivity': 'text-cyan-400 bg-cyan-500/20',
};

export default function PluginsPage() {
  const { data, loading } = useClaude();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMarketplaceDropdown, setShowMarketplaceDropdown] = useState(false);
  const [copiedPlugin, setCopiedPlugin] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [hasElectron, setHasElectron] = useState(false);
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

  // Terminal modal for installation
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [currentInstallCommand, setCurrentInstallCommand] = useState('');
  const [currentInstallPtyId, setCurrentInstallPtyId] = useState<string | null>(null);
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [pendingInstallCommand, setPendingInstallCommand] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  useEffect(() => {
    setHasElectron(isElectron());
  }, []);

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
        if (ptyIdRef.current && window.electronAPI?.plugin?.installWrite) {
          window.electronAPI.plugin.installWrite({ id: ptyIdRef.current, data });
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ptyIdRef.current && window.electronAPI?.plugin?.installResize) {
          window.electronAPI.plugin.installResize({
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
    if (!terminalReady || !pendingInstallCommand || !window.electronAPI?.plugin?.installStart) return;

    const startPty = async () => {
      try {
        const result = await window.electronAPI?.plugin?.installStart({ command: pendingInstallCommand });
        if (!result) {
          throw new Error('Failed to start installation');
        }
        setCurrentInstallPtyId(result.id);
        ptyIdRef.current = result.id;
        setPendingInstallCommand(null);
      } catch (err) {
        setShowToast({
          message: `Failed to start installation: ${err instanceof Error ? err.message : 'Unknown error'}`,
          type: 'error',
        });
        setInstallingPlugin(null);
        setShowInstallTerminal(false);
        setTimeout(() => setShowToast(null), 4000);
      }
    };

    startPty();
  }, [terminalReady, pendingInstallCommand]);

  // Listen for PTY data - always subscribe when in electron
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyData) return;

    const unsubscribe = window.electronAPI.plugin.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit - always subscribe when in electron
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyExit) return;

    const unsubscribe = window.electronAPI.plugin.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
        setInstallingPlugin(null);
      }
    });

    return unsubscribe;
  }, []);

  // Get installed plugins from settings
  const installedPlugins = useMemo(() => {
    const enabledPlugins = data?.settings?.enabledPlugins || {};
    return Object.keys(enabledPlugins).filter(key => enabledPlugins[key]);
  }, [data?.settings?.enabledPlugins]);

  // Check if a plugin is installed
  const isPluginInstalled = (pluginName: string, marketplace: string) => {
    const fullName = `${pluginName}@${marketplace}`;
    return installedPlugins.some(p =>
      p === fullName ||
      p.toLowerCase() === fullName.toLowerCase() ||
      p.startsWith(`${pluginName}@`)
    );
  };

  // Create custom plugin entries for installed plugins not in the database
  const customInstalledPlugins = useMemo((): Plugin[] => {
    return installedPlugins
      .filter(pluginKey => {
        // Check if this plugin is already in the database
        const [name] = pluginKey.split('@');
        return !PLUGINS_DATABASE.some(p =>
          p.name === name ||
          `${p.name}@${p.marketplace}` === pluginKey ||
          `${p.name}@${p.marketplace}`.toLowerCase() === pluginKey.toLowerCase()
        );
      })
      .map(pluginKey => {
        const [name, marketplace] = pluginKey.split('@');
        return {
          name: name || pluginKey,
          description: 'Custom installed plugin',
          category: 'Productivity' as const,
          marketplace: marketplace || 'custom',
          tags: ['custom', 'installed'],
        };
      });
  }, [installedPlugins]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    // Combine database plugins with custom installed plugins
    let plugins: Plugin[] = [...PLUGINS_DATABASE, ...customInstalledPlugins];

    if (search) {
      const q = search.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      plugins = plugins.filter((p) => p.category === selectedCategory);
    }

    if (selectedMarketplace) {
      plugins = plugins.filter((p) => p.marketplace === selectedMarketplace);
    }

    // Sort installed plugins first
    plugins = [...plugins].sort((a, b) => {
      const aInstalled = installedPlugins.some(p =>
        p === `${a.name}@${a.marketplace}` ||
        p.toLowerCase() === `${a.name}@${a.marketplace}`.toLowerCase() ||
        p.startsWith(`${a.name}@`)
      );
      const bInstalled = installedPlugins.some(p =>
        p === `${b.name}@${b.marketplace}` ||
        p.toLowerCase() === `${b.name}@${b.marketplace}`.toLowerCase() ||
        p.startsWith(`${b.name}@`)
      );
      if (aInstalled && !bInstalled) return -1;
      if (!aInstalled && bInstalled) return 1;
      return 0;
    });

    return plugins;
  }, [search, selectedCategory, selectedMarketplace, installedPlugins, customInstalledPlugins]);

  const getInstallCommand = (plugin: Plugin) => {
    return `/plugin install ${plugin.name}@${plugin.marketplace}`;
  };

  const handleInstall = async (plugin: Plugin) => {
    const installCommand = getInstallCommand(plugin);

    if (hasElectron && window.electronAPI?.plugin?.installStart) {
      // Open in-app terminal with Claude Code to run the install command
      setInstallingPlugin(plugin.name);
      setCurrentInstallCommand(installCommand);
      setInstallComplete(false);
      setInstallExitCode(null);
      setShowInstallTerminal(true);
      setPendingInstallCommand(installCommand);
    } else {
      // Copy command to clipboard
      await copyInstallCommand(plugin);
    }
  };

  const closeInstallTerminal = () => {
    // Kill the PTY if still running
    if (ptyIdRef.current && window.electronAPI?.plugin?.installKill) {
      window.electronAPI.plugin.installKill({ id: ptyIdRef.current });
    }
    setShowInstallTerminal(false);
    setCurrentInstallCommand('');
    setCurrentInstallPtyId(null);
    setInstallComplete(false);
    setInstallExitCode(null);
    setInstallingPlugin(null);
    ptyIdRef.current = null;
  };

  const copyInstallCommand = async (plugin: Plugin) => {
    try {
      await navigator.clipboard.writeText(getInstallCommand(plugin));
      setCopiedPlugin(plugin.name);
      setShowToast({
        message: `Command copied! Run in Claude Code to install "${plugin.name}"`,
        type: 'success',
      });
      setTimeout(() => {
        setCopiedPlugin(null);
        setShowToast(null);
      }, 3000);
    } catch (err) {
      setShowToast({
        message: 'Failed to copy to clipboard',
        type: 'error',
      });
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Plugin Marketplace</h1>
            <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
              Extend Claude Code with plugins for code intelligence, integrations, and workflows
            </p>
          </div>
          <a
            href="https://code.claude.com/docs/en/discover-plugins"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Documentation</span>
            <span className="sm:hidden">Docs</span>
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            <span className="text-white font-medium">{PLUGINS_DATABASE.length + customInstalledPlugins.length}</span> plugins
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            <span className="text-white font-medium">{installedPlugins.length}</span> installed
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
            className={`p-4 border flex items-center justify-between mt-4 ${showToast.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : showToast.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-white/10 border-white/30 text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              {showToast.type === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : showToast.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <TerminalIcon className="w-5 h-5" />
              )}
              <p className="text-sm">{showToast.message}</p>
            </div>
            <button onClick={() => setShowToast(null)} className="p-1 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins by name, description, or tags..."
            className="w-full pl-10 pr-4 py-2.5 rounded-none text-sm bg-secondary border border-border focus:border-foreground focus:outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setShowCategoryDropdown(!showCategoryDropdown);
              setShowMarketplaceDropdown(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-none bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors w-full sm:w-auto sm:min-w-[160px] text-sm"
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
                className="absolute top-full mt-2 right-0 w-48 bg-card border border-border rounded-none shadow-lg z-20 py-2 max-h-80 overflow-y-auto"
              >
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary ${!selectedCategory ? 'text-white' : 'text-muted-foreground'
                    }`}
                >
                  All Categories
                </button>
                {PLUGIN_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat] || Puzzle;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary flex items-center gap-2 ${selectedCategory === cat ? 'text-white' : 'text-muted-foreground'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cat}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Marketplace Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setShowMarketplaceDropdown(!showMarketplaceDropdown);
              setShowCategoryDropdown(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-none bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors w-full sm:w-auto sm:min-w-[160px] text-sm"
          >
            <Puzzle className="w-4 h-4" />
            {selectedMarketplace ? MARKETPLACES.find(m => m.id === selectedMarketplace)?.name : 'All Sources'}
            <ChevronDown className="w-4 h-4 ml-auto" />
          </button>

          <AnimatePresence>
            {showMarketplaceDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-2 right-0 w-56 bg-card border border-border rounded-none shadow-lg z-20 py-2"
              >
                <button
                  onClick={() => {
                    setSelectedMarketplace(null);
                    setShowMarketplaceDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary ${!selectedMarketplace ? 'text-white' : 'text-muted-foreground'
                    }`}
                >
                  All Sources
                </button>
                {MARKETPLACES.map((marketplace) => (
                  <button
                    key={marketplace.id}
                    onClick={() => {
                      setSelectedMarketplace(marketplace.id);
                      setShowMarketplaceDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-secondary ${selectedMarketplace === marketplace.id ? 'text-white' : 'text-muted-foreground'
                      }`}
                  >
                    <div className="font-medium">{marketplace.name}</div>
                    <div className="text-xs text-muted-foreground">{marketplace.description}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="flex-1 overflow-y-auto mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => {
            const installed = isPluginInstalled(plugin.name, plugin.marketplace);
            const justCopied = copiedPlugin === plugin.name;
            const isInstalling = installingPlugin === plugin.name;
            const isCustom = customInstalledPlugins.some(p => p.name === plugin.name && p.marketplace === plugin.marketplace);
            const Icon = CATEGORY_ICONS[plugin.category] || Puzzle;
            const colorClass = CATEGORY_COLORS[plugin.category] || 'text-zinc-400 bg-zinc-500/20';

            return (
              <motion.div
                key={`${plugin.marketplace}-${plugin.name}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border bg-card p-4 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${installed ? 'bg-green-500/20' : colorClass.split(' ')[1]
                    }`}>
                    {installed ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Icon className={`w-5 h-5 ${colorClass.split(' ')[0]}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm truncate">{plugin.name}</h3>
                      {isCustom && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 font-medium">
                          Custom
                        </span>
                      )}
                      {installed && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400">
                          Installed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isCustom ? plugin.marketplace : MARKETPLACES.find(m => m.id === plugin.marketplace)?.name || plugin.marketplace}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {plugin.description}
                </p>

                {plugin.binaryRequired && (
                  <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 mb-3">
                    <Info className="w-3 h-3" />
                    <span>Requires: <code className="bg-secondary px-1 py-0.5">{plugin.binaryRequired}</code></span>
                  </div>
                )}

                {plugin.tags && plugin.tags.filter(t => t !== 'custom' && t !== 'installed').length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {plugin.tags.filter(t => t !== 'custom' && t !== 'installed').slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
                  {installed ? (
                    <span className="flex-1 text-center text-xs text-green-400 py-1.5">
                      Already installed
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleInstall(plugin)}
                        disabled={isInstalling}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${isInstalling
                            ? 'bg-secondary text-muted-foreground'
                            : 'bg-white text-black hover:bg-white/90'
                          }`}
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Installing...
                          </>
                        ) : hasElectron ? (
                          'Install'
                        ) : (
                          'Copy Command'
                        )}
                      </button>
                      <button
                        onClick={() => copyInstallCommand(plugin)}
                        className={`p-1.5 transition-colors ${justCopied
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        title="Copy install command"
                      >
                        {justCopied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredPlugins.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64">
            <Puzzle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No plugins found matching your search</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory(null);
                setSelectedMarketplace(null);
              }}
              className="mt-3 text-sm text-foreground hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Plugin Details Modal */}
      <AnimatePresence>
        {selectedPlugin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPlugin(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card border border-border rounded-none p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{selectedPlugin.name}</h3>
                <button onClick={() => setSelectedPlugin(null)} className="p-1 hover:bg-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{selectedPlugin.description}</p>
              <div className="p-3 bg-secondary border border-border font-mono text-xs mb-4">
                {getInstallCommand(selectedPlugin)}
              </div>
              <button
                onClick={() => {
                  handleInstall(selectedPlugin);
                  setSelectedPlugin(null);
                }}
                className="w-full py-2.5 bg-white text-black font-medium hover:bg-white/90 transition-colors"
              >
                {hasElectron ? 'Install Plugin' : 'Copy Install Command'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Installation Terminal Modal */}
      <AnimatePresence>
        {showInstallTerminal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeInstallTerminal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-[#0a0a0f] border border-border rounded-none overflow-hidden"
            >
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <TerminalIcon className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="font-medium text-sm">Installing Plugin</h3>
                    <p className="text-xs text-muted-foreground font-mono">{currentInstallCommand}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {installComplete && (
                    <span className={`text-xs px-2 py-1 ${installExitCode === 0
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                      }`}>
                      {installExitCode === 0 ? 'Completed' : `Failed (${installExitCode})`}
                    </span>
                  )}
                  {!installComplete && (
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running
                    </span>
                  )}
                  <button
                    onClick={closeInstallTerminal}
                    className="p-1.5 hover:bg-secondary rounded-none transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Terminal Content */}
              <div
                ref={terminalRef}
                className="h-[400px] p-2"
                style={{ backgroundColor: '#0a0a0f' }}
              />

              {/* Terminal Footer */}
              <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {installComplete
                    ? 'Installation finished. You can close this window.'
                    : 'Installation in progress... You can interact with the terminal if needed.'}
                </p>
                <button
                  onClick={closeInstallTerminal}
                  className="px-4 py-1.5 text-sm bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
