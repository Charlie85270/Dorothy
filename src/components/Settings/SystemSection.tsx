import { FolderOpen } from 'lucide-react';
import type { ClaudeInfo, AppSettings } from './types';

interface SystemSectionProps {
  info: ClaudeInfo | null;
  appSettings: AppSettings;
  onSaveAppSettings: (settings: Partial<AppSettings>) => void;
}

export const SystemSection = ({ info, appSettings, onSaveAppSettings }: SystemSectionProps) => {
  const handleOpenConfigFolder = () => {
    if (info?.configPath && window.electronAPI?.shell) {
      window.electronAPI.shell.exec({ command: `open "${info.configPath}"` });
    }
  };

  const handleVerboseModeToggle = () => {
    onSaveAppSettings({ verboseModeEnabled: !appSettings.verboseModeEnabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">System Information</h2>
        <p className="text-sm text-muted-foreground">Claude Code installation details</p>
      </div>

      {/* Agent Settings */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-md font-medium mb-4">Agent Settings</h3>
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <span className="text-sm">Verbose Mode</span>
            <p className="text-xs text-muted-foreground mt-1">
              Start agents with --verbose flag for detailed output
            </p>
          </div>
          <button
            onClick={handleVerboseModeToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              appSettings.verboseModeEnabled ? 'bg-white' : 'bg-white/20'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                appSettings.verboseModeEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {info && (
        <div className="border border-border bg-card p-6">
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Claude Version</span>
              <span className="text-sm font-mono">{info.claudeVersion || 'Not found'}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Platform</span>
              <span className="text-sm font-mono">{info.platform} ({info.arch})</span>
            </div>
            <div className="flex justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Electron</span>
              <span className="text-sm font-mono">{info.electronVersion}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Node.js</span>
              <span className="text-sm font-mono">{info.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Config Path</span>
              <span className="text-sm font-mono text-muted-foreground truncate max-w-[200px]">{info.configPath}</span>
            </div>
            <div className="pt-4">
              <button
                onClick={handleOpenConfigFolder}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Open Config Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
