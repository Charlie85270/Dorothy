'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { LinearIcon } from './LinearIcon';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface LinearSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const LinearSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: LinearSectionProps) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!window.electronAPI?.linear?.test) return;
    setTesting(true);
    setTestResult(null);
    try {
      onSaveAppSettings({
        linearApiKey: appSettings.linearApiKey,
      });
      await new Promise(r => setTimeout(r, 300));

      const result = await window.electronAPI.linear.test();
      if (result.success) {
        setTestResult({ success: true, message: `Connected as ${result.displayName} (${result.email})` });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(false);
    }
  };

  const canEnable = !!appSettings.linearApiKey;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Linear Integration</h2>
        <p className="text-sm text-muted-foreground">Connect to Linear to poll issues and update status</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <LinearIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Linear Integration</p>
              <p className="text-sm text-muted-foreground">
                {canEnable
                  ? 'Poll Linear issues and let agents update them'
                  : 'Enter your API key below to enable'}
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.linearEnabled}
            onChange={() => onSaveAppSettings({ linearEnabled: !appSettings.linearEnabled })}
            disabled={!canEnable}
          />
        </div>

        <div className="space-y-6 pt-6">
          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">API Key</label>
              <a
                href="https://linear.app/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Create API key
              </a>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={appSettings.linearApiKey}
                onChange={(e) => onUpdateLocalSettings({ linearApiKey: e.target.value })}
                onBlur={() => {
                  if (appSettings.linearApiKey) {
                    onSaveAppSettings({ linearApiKey: appSettings.linearApiKey });
                  }
                }}
                placeholder="lin_api_..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={!canEnable || testing}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LinearIcon className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>

          {testResult && (
            <div className={`p-3 text-sm flex items-center gap-2 ${
              testResult.success
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
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
          <li>Go to your Linear workspace settings</li>
          <li>Navigate to <code className="bg-secondary px-1">Settings &gt; API</code> or visit <code className="bg-secondary px-1">linear.app/settings/api</code></li>
          <li>Create a new personal API key</li>
          <li>Paste the API key above and click &quot;Test Connection&quot;</li>
          <li>Create an automation with Linear as the source</li>
        </ol>
      </div>
    </div>
  );
};
