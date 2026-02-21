'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface CodexSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

const CODEX_MODELS = [
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'Latest frontier agentic coding model' },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', description: 'Frontier agentic coding model' },
  { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', description: 'Deep and fast reasoning' },
  { value: 'gpt-5.2', label: 'GPT-5.2', description: 'Frontier model, reasoning and coding' },
  { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', description: 'Cheaper, faster' },
];

export const CodexSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: CodexSectionProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
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

        <div className="pt-4 space-y-4">
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
              value={appSettings.codexDefaultModel || 'gpt-5.3-codex'}
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
          <li>Authenticate: run <code className="bg-secondary px-1">codex auth</code> in your terminal</li>
          <li>Click &quot;Test Codex CLI&quot; to verify the installation</li>
          <li>Enable the integration with the toggle</li>
          <li>When creating new agents, select &quot;Codex&quot; as the provider</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Codex CLI handles its own authentication. Run <code className="bg-secondary px-1">codex auth</code> or set <code className="bg-secondary px-1">OPENAI_API_KEY</code> in your shell environment.
        </p>
      </div>
    </div>
  );
};
