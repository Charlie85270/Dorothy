'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';

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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
  });
  const [showBotToken, setShowBotToken] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [info, setInfo] = useState<ClaudeInfo | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
        setAppSettings(appSettingsData);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-4" />
          <p className="text-text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-accent-red">
          <AlertCircle className="w-8 h-8 mx-auto mb-4" />
          <p className="mb-2">Failed to load settings</p>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 pt-4 lg:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2 lg:gap-3">
              <Settings className="w-6 h-6 lg:w-7 lg:h-7 text-accent-blue" />
              Settings
            </h1>
            <p className="text-text-secondary text-xs lg:text-sm mt-1 hidden sm:block">
              Configure Claude Code preferences
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={fetchSettings}
              className="px-3 lg:px-4 py-2 rounded-none border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-3 lg:px-4 py-2 rounded-none flex items-center gap-2 transition-all text-sm ${
                hasChanges
                  ? 'bg-accent-blue text-bg-primary hover:bg-accent-blue/90'
                  : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
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
      </div>

      {/* Error message */}
      {error && settings && (
        <div className="p-4 rounded-none bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
          {error}
        </div>
      )}

      {/* Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Git Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-none bg-accent-purple/20 flex items-center justify-center">
              <GitCommit className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <h2 className="font-semibold">Git Settings</h2>
              <p className="text-xs text-text-muted">Configure git commit behavior</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border-primary">
              <div>
                <p className="text-sm font-medium">Include Co-Authored-By</p>
                <p className="text-xs text-text-muted">Add Claude as co-author in commits</p>
              </div>
              <button
                onClick={() => updateSettings({ includeCoAuthoredBy: !settings?.includeCoAuthoredBy })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings?.includeCoAuthoredBy ? 'bg-accent-blue' : 'bg-bg-tertiary'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings?.includeCoAuthoredBy ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-none bg-accent-amber/20 flex items-center justify-center">
              {appSettings.notificationsEnabled ? (
                <Bell className="w-5 h-5 text-accent-amber" />
              ) : (
                <BellOff className="w-5 h-5 text-accent-amber" />
              )}
            </div>
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-xs text-text-muted">Configure desktop notifications for agents</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border-primary">
              <div>
                <p className="text-sm font-medium">Enable Notifications</p>
                <p className="text-xs text-text-muted">Receive desktop notifications for agent events</p>
              </div>
              <button
                onClick={() => handleSaveAppSettings({ notificationsEnabled: !appSettings.notificationsEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  appSettings.notificationsEnabled ? 'bg-accent-blue' : 'bg-bg-tertiary'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    appSettings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className={`space-y-4 ${!appSettings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between py-3 border-b border-border-primary">
                <div>
                  <p className="text-sm font-medium">Waiting for Input</p>
                  <p className="text-xs text-text-muted">Notify when an agent needs user input</p>
                </div>
                <button
                  onClick={() => handleSaveAppSettings({ notifyOnWaiting: !appSettings.notifyOnWaiting })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    appSettings.notifyOnWaiting ? 'bg-accent-blue' : 'bg-bg-tertiary'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      appSettings.notifyOnWaiting ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border-primary">
                <div>
                  <p className="text-sm font-medium">Task Complete</p>
                  <p className="text-xs text-text-muted">Notify when an agent completes a task</p>
                </div>
                <button
                  onClick={() => handleSaveAppSettings({ notifyOnComplete: !appSettings.notifyOnComplete })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    appSettings.notifyOnComplete ? 'bg-accent-blue' : 'bg-bg-tertiary'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      appSettings.notifyOnComplete ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Error Alerts</p>
                  <p className="text-xs text-text-muted">Notify when an agent encounters an error</p>
                </div>
                <button
                  onClick={() => handleSaveAppSettings({ notifyOnError: !appSettings.notifyOnError })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    appSettings.notifyOnError ? 'bg-accent-blue' : 'bg-bg-tertiary'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      appSettings.notifyOnError ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Telegram Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-none bg-blue-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold">Telegram Integration</h2>
              <p className="text-xs text-text-muted">Control agents remotely via Telegram</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-border-primary">
              <div>
                <p className="text-sm font-medium">Enable Telegram Bot</p>
                <p className="text-xs text-text-muted">Receive notifications and send commands via Telegram</p>
              </div>
              <button
                onClick={() => handleSaveAppSettings({ telegramEnabled: !appSettings.telegramEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  appSettings.telegramEnabled ? 'bg-blue-500' : 'bg-bg-tertiary'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    appSettings.telegramEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Bot Token */}
            <div className="py-3 border-b border-border-primary">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Bot Token</label>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
                  className="w-full px-3 py-2 pr-10 rounded-none bg-bg-tertiary border border-border-primary text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                >
                  {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted mt-1.5">
                1. Message @BotFather on Telegram → 2. Send /newbot → 3. Copy the token here
              </p>
            </div>

            {/* Chat ID (auto-detected) */}
            <div className="py-3 border-b border-border-primary">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Chat ID</label>
                {appSettings.telegramChatId && (
                  <span className="text-xs text-accent-green flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <input
                type="text"
                value={appSettings.telegramChatId || 'Not connected yet'}
                readOnly
                className="w-full px-3 py-2 rounded-none bg-bg-tertiary border border-border-primary text-sm font-mono text-text-muted"
              />
              <p className="text-[10px] text-text-muted mt-1.5">
                Auto-detected when you send /start to your bot
              </p>
            </div>

            {/* Test Connection */}
            <div className="py-3">
              <div className="flex items-center gap-3">
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
                    } catch (err) {
                      setTelegramTestResult({ success: false, message: 'Failed to test connection' });
                    } finally {
                      setTestingTelegram(false);
                    }
                  }}
                  disabled={!appSettings.telegramBotToken || testingTelegram}
                  className="px-4 py-2 rounded-none bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
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
                    } catch (err) {
                      setTelegramTestResult({ success: false, message: 'Failed to send test message' });
                    } finally {
                      setTestingTelegram(false);
                    }
                  }}
                  disabled={!appSettings.telegramChatId || testingTelegram}
                  className="px-4 py-2 rounded-none bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Test
                </button>
              </div>
              {telegramTestResult && (
                <div className={`mt-3 p-2 rounded-none text-xs ${
                  telegramTestResult.success
                    ? 'bg-accent-green/10 text-accent-green'
                    : 'bg-accent-red/10 text-accent-red'
                }`}>
                  {telegramTestResult.message}
                </div>
              )}
            </div>

            {/* Help */}
            <div className="p-3 rounded-none bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs text-blue-300 font-medium mb-1">Quick Setup:</p>
              <ol className="text-[10px] text-text-muted space-y-0.5 list-decimal list-inside">
                <li>Open Telegram and search for @BotFather</li>
                <li>Send /newbot and follow the instructions</li>
                <li>Copy the bot token and paste it above</li>
                <li>Open your new bot and send /start</li>
                <li>You are ready to control agents remotely!</li>
              </ol>
            </div>
          </div>
        </motion.div>

        {/* Permissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-none bg-accent-green/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <h2 className="font-semibold">Permissions</h2>
              <p className="text-xs text-text-muted">Manage allowed and denied actions</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Allowed Permissions</label>
              <div className="p-3 rounded-none bg-bg-tertiary border border-border-primary min-h-[60px]">
                {settings?.permissions?.allow && settings.permissions.allow.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.allow.map((perm, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-none bg-accent-green/20 text-accent-green text-xs font-mono"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No custom permissions set</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">Denied Permissions</label>
              <div className="p-3 rounded-none bg-bg-tertiary border border-border-primary min-h-[60px]">
                {settings?.permissions?.deny && settings.permissions.deny.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.deny.map((perm, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-none bg-accent-red/20 text-accent-red text-xs font-mono"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No denied permissions</p>
                )}
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Permissions are managed through Claude Code CLI. Use <code className="text-accent-blue">claude config</code> to modify.
            </p>
          </div>
        </motion.div>

        {/* Skills & Plugins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-accent-amber/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-amber" />
              </div>
              <div>
                <h2 className="font-semibold">Skills & Plugins</h2>
                <p className="text-xs text-text-muted">Installed skills and plugins for Claude Code</p>
              </div>
            </div>
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-accent-amber/10 text-accent-amber text-sm hover:bg-accent-amber/20 transition-colors"
            >
              <span>skills.sh</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Skills by source */}
          <div className="space-y-6">
            {/* User Skills */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue" />
                User Skills
                <span className="text-text-muted">({skills.filter(s => s.source === 'user').length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {skills.filter(s => s.source === 'user').length > 0 ? (
                  skills.filter(s => s.source === 'user').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-2 px-3 rounded-none bg-bg-tertiary border border-border-primary"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-text-muted truncate">{skill.description}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue ml-2">
                        User
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-text-muted text-sm col-span-2">No user skills installed</p>
                )}
              </div>
            </div>

            {/* Plugin Skills */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-purple" />
                Plugin Skills
                <span className="text-text-muted">({skills.filter(s => s.source === 'plugin').length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {skills.filter(s => s.source === 'plugin').length > 0 ? (
                  skills.filter(s => s.source === 'plugin').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-2 px-3 rounded-none bg-bg-tertiary border border-border-primary"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-text-muted truncate">{skill.description}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple ml-2">
                        Plugin
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-text-muted text-sm col-span-2">No plugin skills installed</p>
                )}
              </div>
            </div>

            {/* Project Skills */}
            {skills.filter(s => s.source === 'project').length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-green" />
                  Project Skills
                  <span className="text-text-muted">({skills.filter(s => s.source === 'project').length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {skills.filter(s => s.source === 'project').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-2 px-3 rounded-none bg-bg-tertiary border border-border-primary"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.projectName && (
                          <p className="text-xs text-text-muted truncate">{skill.projectName}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green ml-2">
                        Project
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enabled in Settings */}
            {settings?.enabledPlugins && Object.keys(settings.enabledPlugins).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-amber" />
                  Enabled in Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(settings.enabledPlugins).map(([plugin, enabled]) => (
                    <div
                      key={plugin}
                      className="flex items-center justify-between py-2 px-3 rounded-none bg-bg-tertiary border border-border-primary"
                    >
                      <span className="text-sm font-mono truncate">{plugin.split('@')[0]}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                          enabled
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-accent-red/20 text-accent-red'
                        }`}
                      >
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {skills.length === 0 && (!settings?.enabledPlugins || Object.keys(settings.enabledPlugins).length === 0) && (
            <div className="text-center py-8">
              <p className="text-text-muted mb-3">No skills or plugins installed</p>
              <a
                href="https://skills.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-accent-amber hover:underline"
              >
                Browse skills on skills.sh
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-none bg-accent-blue/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-accent-blue" />
            </div>
            <div>
              <h2 className="font-semibold">System Information</h2>
              <p className="text-xs text-text-muted">Claude Code installation details</p>
            </div>
          </div>

          {info && (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-sm text-text-secondary">Claude Version</span>
                <span className="text-sm font-mono">{info.claudeVersion || 'Not found'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-sm text-text-secondary">Platform</span>
                <span className="text-sm font-mono">{info.platform} ({info.arch})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-sm text-text-secondary">Electron</span>
                <span className="text-sm font-mono">{info.electronVersion}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-sm text-text-secondary">Node.js</span>
                <span className="text-sm font-mono">{info.nodeVersion}</span>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (window.electronAPI?.shell) {
                      window.electronAPI.shell.exec({ command: `open "${info.configPath}"` });
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
                >
                  <FolderOpen className="w-4 h-4" />
                  Open Config Folder
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
