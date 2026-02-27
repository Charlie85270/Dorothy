import { useState, useEffect } from 'react';
import { Settings, RefreshCw, Download, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Toggle } from './Toggle';
import type { ClaudeInfo, AppSettings } from './types';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseNotes: string;
  hasUpdate: boolean;
}

type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

interface GeneralSectionProps {
  info: ClaudeInfo | null;
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
}

export const GeneralSection = ({ info, appSettings, onSaveAppSettings }: GeneralSectionProps) => {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [installedProviders, setInstalledProviders] = useState<Record<string, boolean>>({ claude: true, codex: true, gemini: true });

  useEffect(() => {
    window.electronAPI?.cliPaths?.detect().then((paths) => {
      if (paths) {
        setInstalledProviders({
          claude: !!paths.claude,
          codex: !!paths.codex,
          gemini: !!paths.gemini,
        });
      }
    });
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI?.updates) return;

    setUpdateState('checking');
    setUpdateError(null);

    try {
      const result = await window.electronAPI.updates.check();
      if (result) {
        setUpdateInfo(result);
        setUpdateState(result.hasUpdate ? 'update-available' : 'up-to-date');
      } else {
        setUpdateState('error');
        setUpdateError('Could not reach GitHub. Check your internet connection.');
      }
    } catch (err) {
      setUpdateState('error');
      setUpdateError(err instanceof Error ? err.message : 'Failed to check for updates');
    }
  };

  const handleOpenLink = (url: string) => {
    if (window.electronAPI?.updates?.openExternal) {
      window.electronAPI.updates.openExternal(url);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">General Settings</h2>
        <p className="text-sm text-muted-foreground">Configure general application preferences</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-secondary flex items-center justify-center">
            <Settings className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">Dorothy</h3>
            <p className="text-sm text-muted-foreground">
              Version {updateInfo?.currentVersion || '1.1.2'}
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-check for updates</p>
              <p className="text-xs text-muted-foreground">Check for new versions when Dorothy starts</p>
            </div>
            <Toggle
              enabled={appSettings.autoCheckUpdates !== false}
              onChange={() => onSaveAppSettings({ autoCheckUpdates: !appSettings.autoCheckUpdates })}
            />
          </div>
        </div>
      </div>

      {/* Update Checker */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Software Updates</h3>
          <button
            onClick={handleCheckForUpdates}
            disabled={updateState === 'checking'}
            className="px-3 py-1.5 text-sm border border-border hover:border-foreground hover:text-foreground text-muted-foreground transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateState === 'checking' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {updateState === 'checking' ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {updateState === 'up-to-date' && (
          <div className="flex items-center rounded-md gap-3 p-3 bg-green-700/10 border border-green-700/20">
            <CheckCircle className="w-5 h-5 text-green-700 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700">You&apos;re up to date!</p>
              <p className="text-xs text-muted-foreground">Dorothy {updateInfo?.currentVersion} is the latest version.</p>
            </div>
          </div>
        )}

        {updateState === 'update-available' && updateInfo && (
          <div className="space-y-3">
            <div className="p-4 rounded-md bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-blue-400">
                    Dorothy {updateInfo.latestVersion} is available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You&apos;re currently on version {updateInfo.currentVersion}
                  </p>
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="mt-3 pt-3 border-t border-blue-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Release notes:</p>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap line-clamp-4">
                    {updateInfo.releaseNotes.slice(0, 300)}
                    {updateInfo.releaseNotes.length > 300 ? '...' : ''}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleOpenLink(updateInfo.downloadUrl || updateInfo.releaseUrl)}
                  className="px-3 py-1.5 text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  onClick={() => handleOpenLink(updateInfo.releaseUrl)}
                  className="px-3 py-1.5 text-sm border border-border hover:border-foreground text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Release
                </button>
              </div>
            </div>
          </div>
        )}

        {updateState === 'error' && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Failed to check for updates</p>
              <p className="text-xs text-muted-foreground">{updateError}</p>
            </div>
          </div>
        )}

        {updateState === 'idle' && (
          <p className="text-xs text-muted-foreground">
            Click &quot;Check for Updates&quot; to see if a newer version is available.
          </p>
        )}
      </div>

      {/* Default Provider */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Default Provider</h3>
        <p className="text-xs text-muted-foreground mb-4">
          CLI provider used for scheduled tasks, automations, and Telegram-spawned agents when no specific agent is selected.
        </p>
        <select
          value={appSettings.defaultProvider || 'claude'}
          onChange={(e) => onSaveAppSettings({ defaultProvider: e.target.value })}
          className="w-full sm:w-64 px-3 py-2 bg-background border border-border text-sm text-foreground focus:outline-none focus:border-foreground"
        >
          <option value="claude" disabled={!installedProviders.claude}>
            Claude{!installedProviders.claude ? ' (not installed)' : ''}
          </option>
          <option value="codex" disabled={!installedProviders.codex}>
            Codex{!installedProviders.codex ? ' (not installed)' : ''}
          </option>
          <option value="gemini" disabled={!installedProviders.gemini}>
            Gemini{!installedProviders.gemini ? ' (not installed)' : ''}
          </option>
        </select>
      </div>

      {info && (
        <div className="border border-border bg-card p-6">
          <h3 className="font-medium mb-4">Quick Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Claude Version</p>
              <p className="font-mono">{info.claudeVersion || 'Not found'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Platform</p>
              <p className="font-mono">{info.platform} ({info.arch})</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
