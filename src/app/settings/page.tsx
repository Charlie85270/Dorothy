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

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
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
      const [settingsData, infoData, claudeData] = await Promise.all([
        window.electronAPI.settings.get(),
        window.electronAPI.settings.getInfo(),
        window.electronAPI.claude?.getData(),
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

  const updateSettings = (updates: Partial<ClaudeSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="w-7 h-7 text-accent-cyan" />
            Settings
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Configure Claude Code preferences
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              hasChanges
                ? 'bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90'
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
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && settings && (
        <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
          {error}
        </div>
      )}

      {/* Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Git Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
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
                  settings?.includeCoAuthoredBy ? 'bg-accent-cyan' : 'bg-bg-tertiary'
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

        {/* Permissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
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
              <div className="p-3 rounded-lg bg-bg-tertiary border border-border-primary min-h-[60px]">
                {settings?.permissions?.allow && settings.permissions.allow.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.allow.map((perm, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md bg-accent-green/20 text-accent-green text-xs font-mono"
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
              <div className="p-3 rounded-lg bg-bg-tertiary border border-border-primary min-h-[60px]">
                {settings?.permissions?.deny && settings.permissions.deny.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.deny.map((perm, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md bg-accent-red/20 text-accent-red text-xs font-mono"
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
              Permissions are managed through Claude Code CLI. Use <code className="text-accent-cyan">claude config</code> to modify.
            </p>
          </div>
        </motion.div>

        {/* Skills & Plugins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-amber/20 flex items-center justify-center">
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-amber/10 text-accent-amber text-sm hover:bg-accent-amber/20 transition-colors"
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
                <span className="w-2 h-2 rounded-full bg-accent-cyan" />
                User Skills
                <span className="text-text-muted">({skills.filter(s => s.source === 'user').length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {skills.filter(s => s.source === 'user').length > 0 ? (
                  skills.filter(s => s.source === 'user').map((skill) => (
                    <div
                      key={skill.path}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary border border-border-primary"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-text-muted truncate">{skill.description}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan ml-2">
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
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary border border-border-primary"
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
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary border border-border-primary"
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
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary border border-border-primary"
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
          className="rounded-xl border border-border-primary bg-bg-secondary p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-accent-cyan" />
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
                  className="flex items-center gap-2 text-sm text-accent-cyan hover:underline"
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
