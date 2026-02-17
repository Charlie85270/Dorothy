'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Play, Square, RefreshCw, Cpu, Server } from 'lucide-react';
import { Toggle } from './Toggle';
import { TasmaniaIcon } from './TasmaniaIcon';
import type { AppSettings } from './types';

interface TasmaniaSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

interface ServerStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  backend: string | null;
  port: number | null;
  modelName: string | null;
  modelPath: string | null;
  endpoint: string | null;
  startedAt: number | null;
  error?: string;
}

interface LocalModel {
  name: string;
  filename: string;
  path: string;
  sizeBytes: number;
  repo: string | null;
  quantization: string | null;
  parameters: string | null;
  architecture: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(startedAt: number | null): string {
  if (!startedAt) return '-';
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export const TasmaniaSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: TasmaniaSectionProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [stoppingModel, setStoppingModel] = useState(false);
  const [mcpConfigured, setMcpConfigured] = useState(false);
  const [settingUpMcp, setSettingUpMcp] = useState(false);

  // Poll server status every 5s when Tasmania is enabled
  const fetchStatus = useCallback(async () => {
    if (!window.electronAPI?.tasmania?.getStatus) return;
    try {
      const status = await window.electronAPI.tasmania.getStatus();
      setServerStatus(status);
    } catch {
      setServerStatus(null);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    if (!window.electronAPI?.tasmania?.getModels) return;
    setLoadingModels(true);
    try {
      const result = await window.electronAPI.tasmania.getModels();
      setModels(result.models || []);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const fetchMcpStatus = useCallback(async () => {
    if (!window.electronAPI?.tasmania?.getMcpStatus) return;
    try {
      const result = await window.electronAPI.tasmania.getMcpStatus();
      setMcpConfigured(result.configured);
    } catch {
      setMcpConfigured(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchModels();
    fetchMcpStatus();

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchModels, fetchMcpStatus]);

  const handleTestConnection = async () => {
    if (!window.electronAPI?.tasmania?.test) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.tasmania.test();
      if (result.success) {
        setTestResult({ success: true, message: 'MCP server found and Control API is reachable.' });
      } else {
        const parts: string[] = [];
        if (!result.serverExists) parts.push('MCP server.js not found');
        if (!result.apiReachable) parts.push('Control API not reachable (is Tasmania running?)');
        setTestResult({ success: false, message: parts.join('. ') || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Test failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadModel = async (modelPath: string) => {
    if (!window.electronAPI?.tasmania?.loadModel) return;
    setLoadingModel(modelPath);
    try {
      await window.electronAPI.tasmania.loadModel(modelPath);
      // Refresh status after a brief delay
      setTimeout(fetchStatus, 1000);
    } catch {
      // Error handled by status polling
    } finally {
      setLoadingModel(null);
    }
  };

  const handleStopModel = async () => {
    if (!window.electronAPI?.tasmania?.stopModel) return;
    setStoppingModel(true);
    try {
      await window.electronAPI.tasmania.stopModel();
      setTimeout(fetchStatus, 1000);
    } catch {
      // Error handled by status polling
    } finally {
      setStoppingModel(false);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !appSettings.tasmaniaEnabled;
    onSaveAppSettings({ tasmaniaEnabled: newEnabled });

    if (newEnabled) {
      // Setup MCP
      setSettingUpMcp(true);
      try {
        if (window.electronAPI?.tasmania?.setup) {
          await window.electronAPI.tasmania.setup();
        }
        setMcpConfigured(true);
      } catch {
        // Ignore
      } finally {
        setSettingUpMcp(false);
      }
    } else {
      // Remove MCP
      try {
        if (window.electronAPI?.tasmania?.remove) {
          await window.electronAPI.tasmania.remove();
        }
        setMcpConfigured(false);
      } catch {
        // Ignore
      }
    }
  };

  const statusColor = serverStatus?.status === 'running'
    ? 'bg-green-500'
    : serverStatus?.status === 'starting'
      ? 'bg-yellow-500'
      : 'bg-zinc-500';

  const statusText = serverStatus?.status === 'running'
    ? 'Running'
    : serverStatus?.status === 'starting'
      ? 'Starting...'
      : 'Stopped';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Tasmania Integration</h2>
        <p className="text-sm text-muted-foreground">Connect to Tasmania for local LLM inference. Agents gain access to local model tools via MCP.</p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <TasmaniaIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Tasmania</p>
              <p className="text-sm text-muted-foreground">
                Register Tasmania MCP server with Claude Code
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settingUpMcp && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Toggle
              enabled={appSettings.tasmaniaEnabled}
              onChange={handleToggleEnabled}
            />
          </div>
        </div>

        {/* MCP Server Path */}
        <div className="pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">MCP Server Path</label>
            <input
              type="text"
              value={appSettings.tasmaniaServerPath}
              onChange={(e) => onUpdateLocalSettings({ tasmaniaServerPath: e.target.value })}
              onBlur={() => {
                if (appSettings.tasmaniaServerPath) {
                  onSaveAppSettings({ tasmaniaServerPath: appSettings.tasmaniaServerPath });
                }
              }}
              placeholder="/path/to/tasmania/src/main/mcp/server.ts"
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
            />
          </div>

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              Test Connection
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

          {/* MCP Registration Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${mcpConfigured ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-muted-foreground">
              MCP: {mcpConfigured ? 'Registered with Claude Code' : 'Not registered'}
            </span>
          </div>
        </div>
      </div>

      {/* Server Status Card */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Server Status</h3>
          <button
            onClick={fetchStatus}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="font-medium">{statusText}</span>
          </div>

          {serverStatus?.status === 'running' && (
            <>
              {serverStatus.modelName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-mono text-xs">{serverStatus.modelName}</span>
                </div>
              )}
              {serverStatus.endpoint && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endpoint</span>
                  <span className="font-mono text-xs">{serverStatus.endpoint}</span>
                </div>
              )}
              {serverStatus.backend && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Backend</span>
                  <span>{serverStatus.backend}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span>{formatUptime(serverStatus.startedAt)}</span>
              </div>

              <button
                onClick={handleStopModel}
                disabled={stoppingModel}
                className="mt-2 px-3 py-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/20 transition-colors text-sm flex items-center gap-2"
              >
                {stoppingModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                Stop Model
              </button>
            </>
          )}

          {!serverStatus && (
            <p className="text-muted-foreground text-xs">Unable to reach Tasmania. Make sure the app is running.</p>
          )}
        </div>
      </div>

      {/* Model Browser */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Local Models</h3>
          <button
            onClick={fetchModels}
            disabled={loadingModels}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {loadingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>

        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loadingModels ? 'Loading models...' : 'No local models found. Make sure Tasmania is running.'}
          </p>
        ) : (
          <div className="space-y-2">
            {models.map((model) => {
              const isLoaded = serverStatus?.modelPath === model.path;
              return (
                <div
                  key={model.path}
                  className={`flex items-center justify-between p-3 border transition-colors ${
                    isLoaded ? 'border-green-600/30 bg-green-600/5' : 'border-border'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{model.name}</span>
                      {isLoaded && (
                        <span className="text-xs bg-green-600/20 text-green-500 px-1.5 py-0.5 shrink-0">Active</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatBytes(model.sizeBytes)}</span>
                      {model.quantization && <span>{model.quantization}</span>}
                      {model.architecture && <span>{model.architecture}</span>}
                      {model.parameters && <span>{model.parameters}</span>}
                    </div>
                  </div>
                  {!isLoaded && (
                    <button
                      onClick={() => handleLoadModel(model.path)}
                      disabled={loadingModel !== null}
                      className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors text-xs flex items-center gap-1.5 shrink-0"
                    >
                      {loadingModel === model.path ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Load
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available MCP Tools */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Available Agent Tools</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Once enabled, all agents will have access to these MCP tools:
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">query_llm</code>
            <span className="text-muted-foreground">Send a prompt to the local LLM and get a response</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">list_models</code>
            <span className="text-muted-foreground">List all locally available GGUF models</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">load_model</code>
            <span className="text-muted-foreground">Load and start a specific local model</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">get_server_status</code>
            <span className="text-muted-foreground">Check llama-server status, loaded model, and endpoint</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">download_model</code>
            <span className="text-muted-foreground">Download a model from HuggingFace by repo and filename</span>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Install Tasmania from <code className="bg-secondary px-1">github.com/mbaril010/tasmania</code></li>
          <li>Launch Tasmania and download a GGUF model</li>
          <li>Click &quot;Test Connection&quot; above to verify connectivity</li>
          <li>Enable the integration with the toggle</li>
          <li>Your agents can now use local LLM tools via MCP</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Tasmania runs entirely locally. No API keys or external services required.
        </p>
      </div>
    </div>
  );
};
