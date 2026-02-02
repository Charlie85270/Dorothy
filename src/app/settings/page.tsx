'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Shield,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Info,
  FolderOpen,
  GitCommit,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Bell,
  BellOff,
  Send,
  MessageCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Monitor,
  Brain,
  CheckCircle,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';
// Import xterm CSS
import 'xterm/css/xterm.css';

// Custom Slack Icon component
const SlackIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 512 512"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M126.12,315.1A47.06,47.06,0,1,1,79.06,268h47.06Z"/>
    <path d="M149.84,315.1a47.06,47.06,0,0,1,94.12,0V432.94a47.06,47.06,0,1,1-94.12,0Z"/>
    <path d="M196.9,126.12A47.06,47.06,0,1,1,244,79.06v47.06Z"/>
    <path d="M196.9,149.84a47.06,47.06,0,0,1,0,94.12H79.06a47.06,47.06,0,0,1,0-94.12Z"/>
    <path d="M385.88,196.9A47.06,47.06,0,1,1,432.94,244H385.88Z"/>
    <path d="M362.16,196.9a47.06,47.06,0,0,1-94.12,0V79.06a47.06,47.06,0,1,1,94.12,0Z"/>
    <path d="M315.1,385.88A47.06,47.06,0,1,1,268,432.94V385.88Z"/>
    <path d="M315.1,362.16a47.06,47.06,0,0,1,0-94.12H432.94a47.06,47.06,0,1,1,0,94.12Z"/>
  </svg>
);

interface ClaudeSettings {
  enabledPlugins: Record<string, boolean>;
  env: Record<string, string>;
  hooks: Record<string, unknown>;
  includeCoAuthoredBy: boolean;
  permissions: { allow: string[]; deny: string[] };
}

interface ClaudeInfo {
  claudeVersion: string;
  configPath: string;
  settingsPath: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
}

interface Skill {
  name: string;
  source: 'project' | 'user' | 'plugin';
  path: string;
  description?: string;
  projectName?: string;
}

interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  slackEnabled: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  slackChannelId: string;
}

type SettingsSection = 'general' | 'memory' | 'git' | 'notifications' | 'telegram' | 'slack' | 'permissions' | 'skills' | 'system';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'git', label: 'Git', icon: GitCommit },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'slack', label: 'Slack', icon: SlackIcon },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'skills', label: 'Skills & Plugins', icon: Sparkles },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    slackEnabled: false,
    slackBotToken: '',
    slackAppToken: '',
    slackSigningSecret: '',
    slackChannelId: '',
  });
  const [showBotToken, setShowBotToken] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSlackBotToken, setShowSlackBotToken] = useState(false);
  const [showSlackAppToken, setShowSlackAppToken] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [info, setInfo] = useState<ClaudeInfo | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Terminal modal for plugin installation
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [currentInstallCommand, setCurrentInstallCommand] = useState('');
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [pendingInstallCommand, setPendingInstallCommand] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

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

      // Terminal is ready
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
        const result = await window.electronAPI!.plugin.installStart({ command: pendingInstallCommand });
        ptyIdRef.current = result.id;
        setPendingInstallCommand(null);
      } catch (err) {
        console.error('Failed to start plugin installation:', err);
        setShowInstallTerminal(false);
      }
    };

    startPty();
  }, [terminalReady, pendingInstallCommand]);

  // Listen for PTY data
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyData) return;

    const unsubscribe = window.electronAPI.plugin.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyExit) return;

    const unsubscribe = window.electronAPI.plugin.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
      }
    });

    return unsubscribe;
  }, []);

  const openPluginInstallTerminal = (command: string) => {
    setCurrentInstallCommand(command);
    setInstallComplete(false);
    setInstallExitCode(null);
    setShowInstallTerminal(true);
    setPendingInstallCommand(command);
  };

  const closeInstallTerminal = () => {
    if (ptyIdRef.current && window.electronAPI?.plugin?.installKill) {
      window.electronAPI.plugin.installKill({ id: ptyIdRef.current });
    }
    setShowInstallTerminal(false);
    setCurrentInstallCommand('');
    setInstallComplete(false);
    setInstallExitCode(null);
    ptyIdRef.current = null;
    // Refresh settings to pick up newly installed plugin
    fetchSettings();
  };

  const fetchSettings = useCallback(async () => {
    if (!isElectron() || !window.electronAPI?.settings) {
      setError('Settings are only available in the desktop app');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [settingsData, infoData, claudeData, appSettingsData] = await Promise.all([
        window.electronAPI.settings.get(),
        window.electronAPI.settings.getInfo(),
        window.electronAPI.claude?.getData(),
        window.electronAPI.appSettings?.get(),
      ]);

      if (settingsData) {
        setSettings(settingsData);
      }
      if (infoData) {
        setInfo(infoData);
      }
      if (claudeData?.skills) {
        setSkills(claudeData.skills);
      }
      if (appSettingsData) {
        // Merge with defaults to handle new fields that might not exist in saved settings
        setAppSettings(prev => ({ ...prev, ...appSettingsData }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings || !window.electronAPI?.settings) return;

    try {
      setSaving(true);
      const result = await window.electronAPI.settings.save(settings);

      if (result.success) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error || 'Failed to save settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...newSettings };
    setAppSettings(updated);

    if (!window.electronAPI?.appSettings) return;

    try {
      const result = await window.electronAPI.appSettings.save(updated);
      if (!result.success) {
        setError(result.error || 'Failed to save notification settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification settings');
    }
  };

  const updateSettings = (updates: Partial<ClaudeSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
    setHasChanges(true);
  };

  // Toggle component
  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors relative ${
        enabled ? 'bg-white' : 'bg-secondary'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full shadow transition-all absolute top-1 ${
          enabled ? 'bg-black left-6' : 'bg-muted-foreground left-1'
        }`}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-4" />
          <p className="mb-2">Failed to load settings</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">General Settings</h2>
              <p className="text-sm text-muted-foreground">Configure general application preferences</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center">
                  <Settings className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">Claude Manager</h3>
                  <p className="text-sm text-muted-foreground">Version 0.0.8</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-refresh Dashboard</p>
                    <p className="text-xs text-muted-foreground">Automatically refresh agent status every 5 seconds</p>
                  </div>
                  <Toggle enabled={true} onChange={() => {}} />
                </div>
              </div>
            </div>

            {info && (
              <div className="border border-border bg-card p-6">
                <h3 className="font-medium mb-4">Quick Info</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Claude Version</p>
                    <p className="font-mono">{info.claudeVersion || 'Not found'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Platform</p>
                    <p className="font-mono">{info.platform} ({info.arch})</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'memory':
        const isClaudeMemInstalled = settings?.enabledPlugins?.['claude-mem@thedotmack'] === true;
        const isClaudeMemDisabled = settings?.enabledPlugins?.['claude-mem@thedotmack'] === false;
        const isClaudeMemKnown = 'claude-mem@thedotmack' in (settings?.enabledPlugins || {});

        const handleInstallClaudeMem = () => {
          openPluginInstallTerminal('/plugin marketplace add thedotmack/claude-mem && /plugin install claude-mem');
        };

        const handleToggleClaudeMem = async () => {
          if (!settings) return;

          const newEnabled = !isClaudeMemInstalled;
          const updatedPlugins = {
            ...settings.enabledPlugins,
            'claude-mem@thedotmack': newEnabled,
          };

          updateSettings({ enabledPlugins: updatedPlugins });
        };

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Memory</h2>
              <p className="text-sm text-muted-foreground">Persistent memory for Claude Code agents</p>
            </div>

            {/* Restart Notice */}
            {hasChanges && isClaudeMemKnown && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Restart Required</p>
                    <p className="text-yellow-400/80">
                      Save changes and restart Claude Manager and all running Claude Code instances for this change to take effect.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 flex items-center justify-center shrink-0 ${isClaudeMemInstalled ? 'bg-green-500/20' : isClaudeMemDisabled ? 'bg-red-500/20' : 'bg-secondary'}`}>
                  <Brain className={`w-6 h-6 ${isClaudeMemInstalled ? 'text-green-400' : isClaudeMemDisabled ? 'text-red-400' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">Claude-Mem</h3>
                      {isClaudeMemInstalled ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Enabled
                        </span>
                      ) : isClaudeMemDisabled ? (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium">
                          Disabled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs font-medium">
                          Not Installed
                        </span>
                      )}
                    </div>
                    {isClaudeMemKnown && (
                      <Toggle
                        enabled={isClaudeMemInstalled}
                        onChange={handleToggleClaudeMem}
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Claude-Mem seamlessly preserves context across sessions by automatically capturing tool usage observations,
                    generating semantic summaries, and making them available to future sessions. This enables Claude to maintain
                    continuity of knowledge about projects even after sessions end or reconnect.
                  </p>
                </div>
              </div>

              {!isClaudeMemKnown && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="bg-secondary/50 border border-border p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="mb-3">Click the button below to open Claude Code and install the memory plugin. This will run:</p>
                        <div className="space-y-1.5">
                          <code className="block bg-black/50 px-3 py-1.5 font-mono text-xs text-foreground">
                            /plugin marketplace add thedotmack/claude-mem
                          </code>
                          <code className="block bg-black/50 px-3 py-1.5 font-mono text-xs text-foreground">
                            /plugin install claude-mem
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleInstallClaudeMem}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-white/90 transition-colors text-sm font-medium"
                    >
                      <Brain className="w-4 h-4" />
                      Activate Memory
                    </button>
                    <a
                      href="https://github.com/thedotmack/claude-mem"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm"
                    >
                      Learn More
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {isClaudeMemKnown && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="text-sm font-medium mb-3">How It Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                      <span>Automatically captures observations when Claude uses tools</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                      <span>Generates semantic summaries at the end of each session</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                      <span>Injects relevant context at the start of new sessions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                      <span>Stores memories locally in ~/.claude-mem</span>
                    </li>
                  </ul>
                  <a
                    href="https://github.com/thedotmack/claude-mem"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Learn More
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        );

      case 'git':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Git Settings</h2>
              <p className="text-sm text-muted-foreground">Configure git commit behavior and preferences</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <p className="font-medium">Include Co-Authored-By</p>
                    <p className="text-sm text-muted-foreground">Add Claude as co-author in git commits</p>
                  </div>
                  <Toggle
                    enabled={settings?.includeCoAuthoredBy ?? false}
                    onChange={() => updateSettings({ includeCoAuthoredBy: !settings?.includeCoAuthoredBy })}
                  />
                </div>

                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    When enabled, commits made with Claude&apos;s assistance will include a co-authored-by trailer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Notifications</h2>
              <p className="text-sm text-muted-foreground">Configure desktop notifications for agent events</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {appSettings.notificationsEnabled ? (
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <BellOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Enable Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive desktop notifications for agent events</p>
                  </div>
                </div>
                <Toggle
                  enabled={appSettings.notificationsEnabled}
                  onChange={() => handleSaveAppSettings({ notificationsEnabled: !appSettings.notificationsEnabled })}
                />
              </div>

              <div className={`space-y-4 pt-4 ${!appSettings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Waiting for Input</p>
                    <p className="text-xs text-muted-foreground">Notify when an agent needs user input</p>
                  </div>
                  <Toggle
                    enabled={appSettings.notifyOnWaiting}
                    onChange={() => handleSaveAppSettings({ notifyOnWaiting: !appSettings.notifyOnWaiting })}
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Task Complete</p>
                    <p className="text-xs text-muted-foreground">Notify when an agent completes a task</p>
                  </div>
                  <Toggle
                    enabled={appSettings.notifyOnComplete}
                    onChange={() => handleSaveAppSettings({ notifyOnComplete: !appSettings.notifyOnComplete })}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Error Alerts</p>
                    <p className="text-xs text-muted-foreground">Notify when an agent encounters an error</p>
                  </div>
                  <Toggle
                    enabled={appSettings.notifyOnError}
                    onChange={() => handleSaveAppSettings({ notifyOnError: !appSettings.notifyOnError })}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'telegram':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Telegram Integration</h2>
              <p className="text-sm text-muted-foreground">Control agents remotely via Telegram bot</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Enable Telegram Bot</p>
                    <p className="text-sm text-muted-foreground">Receive notifications and send commands via Telegram</p>
                  </div>
                </div>
                <Toggle
                  enabled={appSettings.telegramEnabled}
                  onChange={() => handleSaveAppSettings({ telegramEnabled: !appSettings.telegramEnabled })}
                />
              </div>

              <div className="space-y-6 pt-6">
                {/* Bot Token */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Bot Token</label>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      Get from @BotFather
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showBotToken ? 'text' : 'password'}
                      value={appSettings.telegramBotToken}
                      onChange={(e) => setAppSettings({ ...appSettings, telegramBotToken: e.target.value })}
                      onBlur={() => {
                        if (appSettings.telegramBotToken) {
                          handleSaveAppSettings({ telegramBotToken: appSettings.telegramBotToken });
                        }
                      }}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                      className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => setShowBotToken(!showBotToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Chat ID */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Chat ID</label>
                    {appSettings.telegramChatId && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Connected
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={appSettings.telegramChatId || 'Not connected yet'}
                    readOnly
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-detected when you send /start to your bot
                  </p>
                </div>

                {/* Test Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={async () => {
                      if (!window.electronAPI?.telegram?.test) return;
                      setTestingTelegram(true);
                      setTelegramTestResult(null);
                      try {
                        const result = await window.electronAPI.telegram.test();
                        if (result.success) {
                          setTelegramTestResult({ success: true, message: `Bot @${result.botName} is valid!` });
                        } else {
                          setTelegramTestResult({ success: false, message: result.error || 'Invalid token' });
                        }
                      } catch {
                        setTelegramTestResult({ success: false, message: 'Failed to test connection' });
                      } finally {
                        setTestingTelegram(false);
                      }
                    }}
                    disabled={!appSettings.telegramBotToken || testingTelegram}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                  >
                    {testingTelegram ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    Test Token
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.electronAPI?.telegram?.sendTest) return;
                      setTestingTelegram(true);
                      setTelegramTestResult(null);
                      try {
                        const result = await window.electronAPI.telegram.sendTest();
                        if (result.success) {
                          setTelegramTestResult({ success: true, message: 'Test message sent!' });
                        } else {
                          setTelegramTestResult({ success: false, message: result.error || 'Failed to send' });
                        }
                      } catch {
                        setTelegramTestResult({ success: false, message: 'Failed to send test message' });
                      } finally {
                        setTestingTelegram(false);
                      }
                    }}
                    disabled={!appSettings.telegramChatId || testingTelegram}
                    className="px-4 py-2 bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Test
                  </button>
                </div>

                {telegramTestResult && (
                  <div className={`p-3 text-sm ${
                    telegramTestResult.success
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {telegramTestResult.message}
                  </div>
                )}
              </div>
            </div>

            {/* Setup Guide */}
            <div className="border border-border bg-card p-6">
              <h3 className="font-medium mb-4">Setup Guide</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Open Telegram and search for @BotFather</li>
                <li>Send /newbot and follow the instructions</li>
                <li>Copy the bot token and paste it above</li>
                <li>Open your new bot and send /start</li>
                <li>You&apos;re ready to control agents remotely!</li>
              </ol>
            </div>
          </div>
        );

      case 'slack':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Slack Integration</h2>
              <p className="text-sm text-muted-foreground">Control agents remotely via Slack</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <SlackIcon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Enable Slack Bot</p>
                    <p className="text-sm text-muted-foreground">Receive notifications and send commands via Slack</p>
                  </div>
                </div>
                <Toggle
                  enabled={appSettings.slackEnabled}
                  onChange={() => handleSaveAppSettings({ slackEnabled: !appSettings.slackEnabled })}
                />
              </div>

              <div className="space-y-6 pt-6">
                {/* Bot Token */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Bot Token (xoxb-...)</label>
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      Get from Slack App
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showSlackBotToken ? 'text' : 'password'}
                      value={appSettings.slackBotToken}
                      onChange={(e) => setAppSettings({ ...appSettings, slackBotToken: e.target.value })}
                      onBlur={() => {
                        if (appSettings.slackBotToken) {
                          handleSaveAppSettings({ slackBotToken: appSettings.slackBotToken });
                        }
                      }}
                      placeholder="xoxb-..."
                      className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => setShowSlackBotToken(!showSlackBotToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showSlackBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* App Token */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">App Token (xapp-...)</label>
                    <span className="text-xs text-muted-foreground">Required for Socket Mode</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showSlackAppToken ? 'text' : 'password'}
                      value={appSettings.slackAppToken}
                      onChange={(e) => setAppSettings({ ...appSettings, slackAppToken: e.target.value })}
                      onBlur={() => {
                        if (appSettings.slackAppToken) {
                          handleSaveAppSettings({ slackAppToken: appSettings.slackAppToken });
                        }
                      }}
                      placeholder="xapp-..."
                      className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => setShowSlackAppToken(!showSlackAppToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showSlackAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Channel ID */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Channel ID</label>
                    {appSettings.slackChannelId && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Connected
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={appSettings.slackChannelId || 'Not connected yet'}
                    readOnly
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-detected when you mention the bot or DM it
                  </p>
                </div>

                {/* Test Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={async () => {
                      if (!window.electronAPI?.slack?.test) return;
                      setTestingSlack(true);
                      setSlackTestResult(null);
                      try {
                        const result = await window.electronAPI.slack.test();
                        if (result.success) {
                          setSlackTestResult({ success: true, message: `Bot @${result.botName} is valid!` });
                        } else {
                          setSlackTestResult({ success: false, message: result.error || 'Invalid tokens' });
                        }
                      } catch {
                        setSlackTestResult({ success: false, message: 'Failed to test connection' });
                      } finally {
                        setTestingSlack(false);
                      }
                    }}
                    disabled={!appSettings.slackBotToken || !appSettings.slackAppToken || testingSlack}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                  >
                    {testingSlack ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <SlackIcon className="w-4 h-4" />
                    )}
                    Test Tokens
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.electronAPI?.slack?.sendTest) return;
                      setTestingSlack(true);
                      setSlackTestResult(null);
                      try {
                        const result = await window.electronAPI.slack.sendTest();
                        if (result.success) {
                          setSlackTestResult({ success: true, message: 'Test message sent!' });
                        } else {
                          setSlackTestResult({ success: false, message: result.error || 'Failed to send' });
                        }
                      } catch {
                        setSlackTestResult({ success: false, message: 'Failed to send test message' });
                      } finally {
                        setTestingSlack(false);
                      }
                    }}
                    disabled={!appSettings.slackChannelId || testingSlack}
                    className="px-4 py-2 bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                  >
                    <SlackIcon className="w-4 h-4" />
                    Send Test
                  </button>
                </div>

                {slackTestResult && (
                  <div className={`p-3 text-sm ${
                    slackTestResult.success
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {slackTestResult.message}
                  </div>
                )}
              </div>
            </div>

            {/* Setup Guide */}
            <div className="border border-border bg-card p-6">
              <h3 className="font-medium mb-4">Setup Guide</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">api.slack.com/apps</a> and click &quot;Create New App&quot;</li>
                <li>Choose &quot;From scratch&quot;, name it &quot;Claude Manager&quot;, select workspace</li>
                <li>Go to &quot;Socket Mode&quot; → Enable → Generate App Token with scope &quot;connections:write&quot; (xapp-...)</li>
                <li>Go to &quot;OAuth & Permissions&quot; → Add Bot Token Scopes:
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li className="text-xs">• app_mentions:read, chat:write, im:history, im:read, im:write</li>
                  </ul>
                </li>
                <li>Install to Workspace → Copy Bot Token (xoxb-...)</li>
                <li>Go to &quot;Event Subscriptions&quot; → Enable → Subscribe to: app_mention, message.im</li>
                <li>Go to &quot;App Home&quot; → Scroll to &quot;Show Tabs&quot;:
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li className="text-xs">• Enable &quot;Messages Tab&quot;</li>
                    <li className="text-xs">• Check &quot;Allow users to send Slash commands and messages from the messages tab&quot;</li>
                  </ul>
                </li>
                <li>Paste both tokens above and enable the integration</li>
                <li>Mention @Claude Manager in any channel or DM the bot to start!</li>
              </ol>
            </div>
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Permissions</h2>
              <p className="text-sm text-muted-foreground">Manage allowed and denied actions for Claude</p>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Allowed Permissions</label>
                  <div className="p-4 bg-secondary border border-border min-h-[80px]">
                    {settings?.permissions?.allow && settings.permissions.allow.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {settings.permissions.allow.map((perm, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No custom permissions set</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Denied Permissions</label>
                  <div className="p-4 bg-secondary border border-border min-h-[80px]">
                    {settings?.permissions?.deny && settings.permissions.deny.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {settings.permissions.deny.map((perm, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-mono"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No denied permissions</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Permissions are managed through Claude Code CLI. Use <code className="text-foreground bg-secondary px-1 py-0.5">claude config</code> to modify.
                </p>
              </div>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">Skills & Plugins</h2>
                <p className="text-sm text-muted-foreground">Installed skills and plugins for Claude Code</p>
              </div>
              <a
                href="https://skills.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-colors"
              >
                <span>skills.sh</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* User Skills */}
            <div className="border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                User Skills
                <span className="text-muted-foreground">({skills.filter(s => s.source === 'user').length})</span>
              </h3>
              <div className="space-y-2">
                {skills.filter(s => s.source === 'user').length > 0 ? (
                  skills.filter(s => s.source === 'user').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm py-4">No user skills installed</p>
                )}
              </div>
            </div>

            {/* Plugin Skills */}
            <div className="border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Plugin Skills
                <span className="text-muted-foreground">({skills.filter(s => s.source === 'plugin').length})</span>
              </h3>
              <div className="space-y-2">
                {skills.filter(s => s.source === 'plugin').length > 0 ? (
                  skills.filter(s => s.source === 'plugin').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm py-4">No plugin skills installed</p>
                )}
              </div>
            </div>

            {/* Project Skills */}
            {skills.filter(s => s.source === 'project').length > 0 && (
              <div className="border border-border bg-card p-6">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  Project Skills
                  <span className="text-muted-foreground">({skills.filter(s => s.source === 'project').length})</span>
                </h3>
                <div className="space-y-2">
                  {skills.filter(s => s.source === 'project').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.projectName && (
                          <p className="text-xs text-muted-foreground truncate">{skill.projectName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skills.length === 0 && (
              <div className="border border-border bg-card p-8 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No skills or plugins installed</p>
                <a
                  href="https://skills.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-foreground hover:underline"
                >
                  Browse skills on skills.sh
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        );

      case 'system':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">System Information</h2>
              <p className="text-sm text-muted-foreground">Claude Code installation details</p>
            </div>

            {info && (
              <div className="border border-border bg-card p-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Claude Version</span>
                    <span className="text-sm font-mono">{info.claudeVersion || 'Not found'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Platform</span>
                    <span className="text-sm font-mono">{info.platform} ({info.arch})</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Electron</span>
                    <span className="text-sm font-mono">{info.electronVersion}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Node.js</span>
                    <span className="text-sm font-mono">{info.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Config Path</span>
                    <span className="text-sm font-mono text-muted-foreground truncate max-w-[200px]">{info.configPath}</span>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        if (window.electronAPI?.shell) {
                          window.electronAPI.shell.exec({ command: `open "${info.configPath}"` });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open Config Folder
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Configure Claude Manager preferences
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={fetchSettings}
            className="px-3 lg:px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-3 lg:px-4 py-2 flex items-center gap-2 transition-all text-sm ${
              hasChanges
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
            <span className="sm:hidden">{saving ? '...' : saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && settings && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4 shrink-0">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 hidden lg:block">
          <div className="space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground border-l-2 border-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Section Selector */}
        <div className="lg:hidden mb-4 shrink-0">
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value as SettingsSection)}
            className="w-full px-3 py-2 bg-secondary border border-border text-sm"
          >
            {SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </div>

        {/* Content Area */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-y-auto pr-2"
        >
          {renderContent()}
        </motion.div>
      </div>

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
                    <span className={`text-xs px-2 py-1 ${
                      installExitCode === 0
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
