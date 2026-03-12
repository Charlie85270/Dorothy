'use client';

import { useState } from 'react';
import { Cpu, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface OpenCodeSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const OpenCodeSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: OpenCodeSectionProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const opencodeEnabled = appSettings.opencodeEnabled ?? false;
  const opencodeDefaultModel = appSettings.opencodeDefaultModel ?? '';

  const handleToggleEnabled = () => {
    onSaveAppSettings({ opencodeEnabled: !opencodeEnabled });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI?.shell?.exec({ command: 'opencode --version' });
      if (result?.success && result.output) {
        setTestResult({ success: true, message: `OpenCode found: ${result.output.trim()}` });
      } else {
        setTestResult({ success: false, message: result?.error || 'OpenCode CLI not found. Make sure it is installed and in your PATH.' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Test failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">OpenCode Integration</h2>
        <p className="text-sm text-muted-foreground">
          Configure OpenCode as an agent provider. OpenCode supports 75+ LLM providers including Anthropic, OpenAI, Google, and more.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-500" />
            <div>
              <p className="font-medium">Enable OpenCode</p>
              <p className="text-sm text-muted-foreground">
                Use OpenCode CLI as an agent provider in Dorothy
              </p>
            </div>
          </div>
          <Toggle
            enabled={opencodeEnabled}
            onChange={handleToggleEnabled}
          />
        </div>

        {/* Test Connection */}
        <div className="pt-4 space-y-4">
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              Test CLI
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

      {/* Default Model */}
      {opencodeEnabled && (
        <div className="border border-border bg-card p-6">
          <h3 className="font-medium mb-4">Default Model</h3>
          <div>
            <label className="text-sm font-medium mb-2 block">Model (provider/model format)</label>
            <input
              type="text"
              value={opencodeDefaultModel}
              onChange={(e) => onUpdateLocalSettings({ opencodeDefaultModel: e.target.value })}
              onBlur={() => {
                onSaveAppSettings({ opencodeDefaultModel });
              }}
              placeholder="anthropic/claude-sonnet-4-20250514"
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Format: <code className="bg-secondary px-1">provider/model-name</code>. Leave empty to use the default configured in <code className="bg-secondary px-1">.opencode.json</code>.
            </p>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium text-muted-foreground">Common models:</p>
            <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground font-mono">
              <span>anthropic/claude-sonnet-4-20250514</span>
              <span>anthropic/claude-opus-4-20250514</span>
              <span>openai/gpt-4o</span>
              <span>google/gemini-2.5-pro</span>
              <span>xai/grok-3</span>
            </div>
          </div>
        </div>
      )}

      {/* CLI Reference */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">CLI Reference</h3>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">opencode run [msg]</code>
            <span className="text-muted-foreground">Run opencode with a message</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">--model</code>
            <span className="text-muted-foreground">Model in provider/model format</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">opencode mcp</code>
            <span className="text-muted-foreground">Manage MCP servers</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">opencode models</code>
            <span className="text-muted-foreground">List all available models</span>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Install OpenCode: <code className="bg-secondary px-1">curl -fsSL https://opencode.ai/install | bash</code></li>
          <li>Run <code className="bg-secondary px-1">opencode auth</code> to configure credentials for your LLM provider</li>
          <li>Click &quot;Test CLI&quot; above to verify the installation</li>
          <li>Enable the integration with the toggle</li>
          <li>Select OpenCode as provider when creating new agents</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          OpenCode supports 75+ LLM providers. Configure your preferred provider via <code className="bg-secondary px-1">.opencode.json</code> in your project root.
        </p>
      </div>
    </div>
  );
};
