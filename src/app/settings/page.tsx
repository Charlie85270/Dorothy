'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Key,
  Bell,
  Palette,
  Terminal,
  Database,
  Shield,
  Save,
  RotateCcw,
} from 'lucide-react';

const sections = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'data', label: 'Data & Storage', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [settings, setSettings] = useState({
    // General
    defaultModel: 'sonnet',
    autoSave: true,
    confirmDelete: true,
    // API
    anthropicKey: '',
    // Notifications
    taskComplete: true,
    agentError: true,
    dailyDigest: false,
    // Appearance
    theme: 'dark',
    accentColor: 'cyan',
    compactMode: false,
    // Terminal
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    cursorStyle: 'block',
    // Data
    retainLogs: 30,
    autoBackup: true,
  });

  const handleSave = () => {
    // Save settings
    console.log('Settings saved:', settings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-text-secondary text-sm mt-1">
            Configure your claude.mgr preferences
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all
                  ${activeSection === section.id
                    ? 'bg-accent-cyan/10 text-accent-cyan'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }
                `}
              >
                <section.icon className="w-4 h-4" />
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 rounded-xl border border-border-primary bg-bg-secondary p-6">
          {activeSection === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">General Settings</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Default Model</label>
                    <select
                      value={settings.defaultModel}
                      onChange={(e) => setSettings(s => ({ ...s, defaultModel: e.target.value }))}
                      className="w-full max-w-xs px-4 py-2.5 rounded-lg"
                    >
                      <option value="opus">Opus (Most Capable)</option>
                      <option value="sonnet">Sonnet (Balanced)</option>
                      <option value="haiku">Haiku (Fastest)</option>
                    </select>
                    <p className="text-xs text-text-muted mt-1">Default model for new agents</p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-border-primary">
                    <div>
                      <p className="text-sm font-medium">Auto-save</p>
                      <p className="text-xs text-text-muted">Automatically save changes</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, autoSave: !s.autoSave }))}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.autoSave ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.autoSave ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-border-primary">
                    <div>
                      <p className="text-sm font-medium">Confirm deletions</p>
                      <p className="text-xs text-text-muted">Show confirmation before deleting items</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, confirmDelete: !s.confirmDelete }))}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.confirmDelete ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.confirmDelete ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'api' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">API Configuration</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Anthropic API Key</label>
                    <input
                      type="password"
                      value={settings.anthropicKey}
                      onChange={(e) => setSettings(s => ({ ...s, anthropicKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      className="w-full px-4 py-2.5 rounded-lg font-mono"
                    />
                    <p className="text-xs text-text-muted mt-1">Your API key is stored securely and never shared</p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent-amber/10 border border-accent-amber/30">
                    <p className="text-sm text-accent-amber">
                      Make sure you have sufficient API credits. Usage is tracked per agent.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>

                <div className="space-y-1">
                  {[
                    { key: 'taskComplete', label: 'Task completion', desc: 'Notify when a task is completed' },
                    { key: 'agentError', label: 'Agent errors', desc: 'Notify when an agent encounters an error' },
                    { key: 'dailyDigest', label: 'Daily digest', desc: 'Receive a daily summary of activity' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-border-primary last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-text-muted">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof settings] }))}
                        className={`w-12 h-6 rounded-full transition-colors ${settings[item.key as keyof typeof settings] ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">Appearance</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-text-secondary mb-3">Theme</label>
                    <div className="flex gap-3">
                      {['dark', 'light', 'system'].map((theme) => (
                        <button
                          key={theme}
                          onClick={() => setSettings(s => ({ ...s, theme }))}
                          className={`px-4 py-3 rounded-lg border capitalize ${
                            settings.theme === theme
                              ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                              : 'border-border-primary hover:border-border-accent'
                          }`}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-3">Accent Color</label>
                    <div className="flex gap-3">
                      {[
                        { name: 'cyan', color: '#22d3ee' },
                        { name: 'purple', color: '#a78bfa' },
                        { name: 'green', color: '#4ade80' },
                        { name: 'amber', color: '#fbbf24' },
                        { name: 'blue', color: '#60a5fa' },
                      ].map((accent) => (
                        <button
                          key={accent.name}
                          onClick={() => setSettings(s => ({ ...s, accentColor: accent.name }))}
                          className={`w-10 h-10 rounded-lg transition-transform ${
                            settings.accentColor === accent.name ? 'ring-2 ring-offset-2 ring-offset-bg-secondary ring-white scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: accent.color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-border-primary">
                    <div>
                      <p className="text-sm font-medium">Compact mode</p>
                      <p className="text-xs text-text-muted">Reduce spacing and padding</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, compactMode: !s.compactMode }))}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.compactMode ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.compactMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'terminal' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">Terminal Settings</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Font Size</label>
                    <input
                      type="number"
                      value={settings.fontSize}
                      onChange={(e) => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                      min={10}
                      max={20}
                      className="w-24 px-4 py-2.5 rounded-lg"
                    />
                    <span className="ml-2 text-text-muted">px</span>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Font Family</label>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                      className="w-full max-w-xs px-4 py-2.5 rounded-lg"
                    >
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Fira Code">Fira Code</option>
                      <option value="Monaco">Monaco</option>
                      <option value="Menlo">Menlo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Cursor Style</label>
                    <div className="flex gap-3">
                      {['block', 'line', 'underline'].map((style) => (
                        <button
                          key={style}
                          onClick={() => setSettings(s => ({ ...s, cursorStyle: style }))}
                          className={`px-4 py-2 rounded-lg border capitalize ${
                            settings.cursorStyle === style
                              ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                              : 'border-border-primary hover:border-border-accent'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'data' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">Data & Storage</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Retain logs for</label>
                    <select
                      value={settings.retainLogs}
                      onChange={(e) => setSettings(s => ({ ...s, retainLogs: parseInt(e.target.value) }))}
                      className="w-full max-w-xs px-4 py-2.5 rounded-lg"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                      <option value={365}>1 year</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-border-primary">
                    <div>
                      <p className="text-sm font-medium">Auto-backup</p>
                      <p className="text-xs text-text-muted">Automatically backup data daily</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, autoBackup: !s.autoBackup }))}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.autoBackup ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.autoBackup ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-border-primary">
                    <button className="px-4 py-2 rounded-lg border border-accent-red/50 text-accent-red hover:bg-accent-red/10 transition-colors">
                      Clear All Data
                    </button>
                    <p className="text-xs text-text-muted mt-2">This will permanently delete all agents, projects, and tasks</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold mb-4">Security</h2>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-bg-tertiary border border-border-primary">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-accent-green" />
                      <p className="font-medium">Encryption Status</p>
                    </div>
                    <p className="text-sm text-text-secondary">All sensitive data is encrypted at rest using AES-256</p>
                  </div>

                  <div className="p-4 rounded-lg bg-bg-tertiary border border-border-primary">
                    <p className="font-medium mb-2">API Key Security</p>
                    <ul className="text-sm text-text-secondary space-y-1">
                      <li>- Keys are stored securely in your system keychain</li>
                      <li>- Keys are never transmitted to our servers</li>
                      <li>- Keys are encrypted in memory during runtime</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
