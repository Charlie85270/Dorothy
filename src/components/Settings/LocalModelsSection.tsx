'use client';

import { useState } from 'react';
import { Server, Loader2, CheckCircle, XCircle, Search } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface LocalModelsSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const LocalModelsSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: LocalModelsSectionProps) => {
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<{ found: boolean; url?: string } | null>(null);

  const handleDetect = async () => {
    if (!window.electronAPI?.localModel?.detect) return;
    setDetecting(true);
    setDetectResult(null);
    try {
      const result = await window.electronAPI.localModel.detect();
      setDetectResult(result);
      if (result.found && result.url) {
        onUpdateLocalSettings({ localModelBaseUrl: result.url });
        onSaveAppSettings({ localModelBaseUrl: result.url });
      }
    } catch {
      setDetectResult({ found: false });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Local Models</h2>
        <p className="text-sm text-muted-foreground">
          Point Claude Code at a local model server (Ollama, LM Studio, etc.) by overriding the base URL.
        </p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Local Model</p>
              <p className="text-sm text-muted-foreground">
                Override ANTHROPIC_BASE_URL for all agents
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.localModelEnabled}
            onChange={() => onSaveAppSettings({ localModelEnabled: !appSettings.localModelEnabled })}
          />
        </div>

        {appSettings.localModelEnabled && (
          <div className="space-y-6 pt-6">
            {/* Base URL */}
            <div>
              <label className="text-sm font-medium mb-2 block">Base URL</label>
              <input
                type="text"
                value={appSettings.localModelBaseUrl}
                onChange={(e) => onUpdateLocalSettings({ localModelBaseUrl: e.target.value })}
                onBlur={() => {
                  if (appSettings.localModelBaseUrl) {
                    onSaveAppSettings({ localModelBaseUrl: appSettings.localModelBaseUrl });
                  }
                }}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The OpenAI-compatible API endpoint of your local model server.
              </p>
            </div>

            {/* Detect Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDetect}
                disabled={detecting}
                className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
              >
                {detecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {detecting ? 'Scanning...' : 'Detect Server'}
              </button>
            </div>

            {/* Detection Result */}
            {detectResult && (
              <div className={`p-3 text-sm flex items-center gap-2 ${detectResult.found
                ? 'bg-green-700/10 text-green-700 border border-green-700/20'
                : 'bg-secondary text-muted-foreground border border-border'
              }`}>
                {detectResult.found ? (
                  <>
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Server found at {detectResult.url}
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 shrink-0" />
                    No compatible server found on common ports
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">How It Works</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Start your local model server (Ollama, LM Studio, vLLM, etc.)</li>
          <li>Enable the toggle and enter the server&apos;s base URL, or click &quot;Detect Server&quot;</li>
          <li>All new agents will route requests through your local server</li>
          <li>Disable the toggle to switch back to the default Anthropic API</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          The server must expose an OpenAI-compatible <code className="bg-secondary px-1">/v1/models</code> endpoint.
        </p>
      </div>
    </div>
  );
};
