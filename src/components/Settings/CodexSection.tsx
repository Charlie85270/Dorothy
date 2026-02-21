'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Terminal, Eye, EyeOff } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface CodexSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

const CODEX_MODELS = [
  { value: 'o4-mini', label: 'o4-mini', description: 'Fast & affordable' },
  { value: 'o3', label: 'o3', description: 'Most capable' },
  { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Balanced' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Lightweight' },
];

const SANDBOX_MODES = [
  { value: 'read-only' as const, label: 'Read Only', description: 'Can only read files' },
  { value: 'workspace-write' as const, label: 'Workspace Write', description: 'Can write within the project directory' },
  { value: 'full-auto' as const, label: 'Full Auto', description: 'Full system access (use with caution)' },
];

export const CodexSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: CodexSectionProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleTestConnection = async () => {
    if (!window.electronAPI?.codex?.test) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.codex.test();
      if (result.success) {
        setTestResult({ success: true, message: `Codex CLI found: ${result.version}` });
      } else {
        setTestResult({ success: false, message: result.error || 'Codex CLI not found' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Test failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(false);
    }
  };

  const handleDetectPath = async () => {
    if (!window.electronAPI?.codex?.detectPath) return;
    setDetecting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.codex.detectPath();
      if (result.found && result.path) {
        onSaveAppSettings({
          cliPaths: { ...appSettings.cliPaths, codex: result.path },
        });
        setTestResult({ success: true, message: `Detected: ${result.path}` });
      } else {
        setTestResult({ success: false, message: 'Codex CLI not found in common locations' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Detection failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setDetecting(false);
    }
  };

  const handleToggleEnabled = () => {
    onSaveAppSettings({ codexEnabled: !appSettings.codexEnabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">OpenAI Codex</h2>
        <p className="text-sm text-muted-foreground">
          Use OpenAI Codex CLI as an alternative agent provider. Agents can be powered by Codex models instead of Claude.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Codex Provider</p>
              <p className="text-sm text-muted-foreground">
                Allow creating agents powered by OpenAI Codex
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.codexEnabled}
            onChange={handleToggleEnabled}
          />
        </div>

        {/* API Key */}
        <div className="pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">OpenAI API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={appSettings.codexApiKey}
                onChange={(e) => onUpdateLocalSettings({ codexApiKey: e.target.value })}
                onBlur={() => {
                  onSaveAppSettings({ codexApiKey: appSettings.codexApiKey });
                }}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your OpenAI API key. Required for Codex CLI to authenticate.
            </p>
          </div>

          {/* Codex CLI Path */}
          <div>
            <label className="text-sm font-medium mb-2 block">Codex CLI Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appSettings.cliPaths?.codex || ''}
                onChange={(e) => onUpdateLocalSettings({
                  cliPaths: { ...appSettings.cliPaths, codex: e.target.value },
                })}
                onBlur={() => {
                  onSaveAppSettings({ cliPaths: appSettings.cliPaths });
                }}
                placeholder="/usr/local/bin/codex"
                className="flex-1 px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={handleDetectPath}
                disabled={detecting}
                className="px-3 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors text-sm"
              >
                {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Detect'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use &apos;codex&apos; from PATH.
            </p>
          </div>

          {/* Default Model */}
          <div>
            <label className="text-sm font-medium mb-2 block">Default Model</label>
            <select
              value={appSettings.codexDefaultModel || 'o4-mini'}
              onChange={(e) => onSaveAppSettings({ codexDefaultModel: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border text-sm focus:border-foreground focus:outline-none"
            >
              {CODEX_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} - {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* Default Sandbox Mode */}
          <div>
            <label className="text-sm font-medium mb-2 block">Default Sandbox Mode</label>
            <select
              value={appSettings.codexSandboxMode || 'workspace-write'}
              onChange={(e) => onSaveAppSettings({ codexSandboxMode: e.target.value as AppSettings['codexSandboxMode'] })}
              className="w-full px-3 py-2 bg-secondary border border-border text-sm focus:border-foreground focus:outline-none"
            >
              {SANDBOX_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} - {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              Test Codex CLI
            </button>
          </div>

          {testResult && (
            <div className={`p-3 text-sm flex items-center gap-2 ${testResult.success
              ? 'bg-green-700/10 text-green-700 border border-green-700/20'
              : 'bg-red-700/10 text-red-700 border border-red-700/20'
              }`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Install Codex CLI: <code className="bg-secondary px-1">npm install -g @openai/codex</code></li>
          <li>Add your OpenAI API key above</li>
          <li>Click &quot;Test Codex CLI&quot; to verify the installation</li>
          <li>Enable the integration with the toggle</li>
          <li>When creating new agents, select &quot;Codex&quot; as the provider</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Codex CLI requires an OpenAI API key with access to Codex models.
        </p>
      </div>
    </div>
  );
};
