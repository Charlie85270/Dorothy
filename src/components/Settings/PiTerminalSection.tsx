'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Terminal, ExternalLink } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface PiTerminalSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const PiTerminalSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: PiTerminalSectionProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null);

  const enabled = (appSettings as unknown as Record<string, unknown>).piEnabled === true;

  const handleToggle = () => {
    const newValue = !enabled;
    onUpdateLocalSettings({ piEnabled: newValue } as Partial<AppSettings>);
    onSaveAppSettings({ piEnabled: newValue } as Partial<AppSettings>);
  };

  const handleTestCli = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI?.shell?.exec?.({
        command: `${appSettings.cliPaths?.pi || 'pi'} --version 2>&1 || echo "not found"`,
      });
      if (result?.success && result.output && !result.output.includes('not found')) {
        setTestResult({ success: true, version: result.output.trim() });
      } else {
        setTestResult({ success: false, error: result?.output || result?.error || 'Pi CLI not found' });
      }
    } catch (error) {
      setTestResult({ success: false, error: String(error) });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Pi Terminal</h2>
        <p className="text-sm text-muted-foreground">
          Configure Pi coding agent — a minimal terminal coding harness supporting 15+ AI providers
        </p>
      </div>

      {/* Enable/Disable */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-md font-medium">Enable Pi Terminal</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Show Pi as an available agent provider
            </p>
          </div>
          <Toggle enabled={enabled} onChange={handleToggle} />
        </div>
      </div>

      {/* Test CLI */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-md font-medium">Test Pi CLI</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Verify that the Pi CLI is installed and accessible
            </p>
          </div>
          <button
            onClick={handleTestCli}
            disabled={testing}
            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Terminal className="w-4 h-4" />
            )}
            {testing ? 'Testing...' : 'Test CLI'}
          </button>
        </div>

        {testResult && (
          <div className={`p-3 text-sm flex items-start gap-2 ${
            testResult.success
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              {testResult.success ? (
                <span>Pi CLI found: {testResult.version}</span>
              ) : (
                <div>
                  <span>Pi CLI not found</span>
                  <p className="text-xs mt-1 opacity-80">{testResult.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-md font-medium mb-3">Setup Guide</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">1. Install Pi</p>
            <code className="block px-3 py-2 bg-secondary text-xs font-mono">
              npm install -g @mariozechner/pi-coding-agent
            </code>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">2. Configure API Key</p>
            <p className="text-xs">
              Set your API key via environment variable (e.g. ANTHROPIC_API_KEY) or use OAuth login with <code>/login</code> inside Pi.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">3. Configure CLI Path</p>
            <p className="text-xs">
              Go to Settings &gt; CLI Paths and set the Pi Terminal path, or use auto-detect.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-md font-medium mb-3">Features</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>15+ AI providers (Anthropic, OpenAI, Google, Azure, Bedrock, Mistral, Groq...)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>Switch models mid-session with <code>/model</code> or Ctrl+P</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>Tree-structured session history with export & sharing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>Extensible via TypeScript extensions (tools, commands, keyboard shortcuts)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span>MIT Licensed, open source</span>
          </li>
        </ul>
        <div className="mt-4">
          <a
            href="https://shittycodingagent.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-blue hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            shittycodingagent.ai
          </a>
          <span className="mx-2 text-muted-foreground">•</span>
          <a
            href="https://github.com/badlogic/pi-mono"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-blue hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};
