import { Settings } from 'lucide-react';
import { Toggle } from './Toggle';
import type { ClaudeInfo } from './types';

interface GeneralSectionProps {
  info: ClaudeInfo | null;
}

export const GeneralSection = ({ info }: GeneralSectionProps) => {
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
            <h3 className="font-medium">Claude Manager</h3>
            <p className="text-sm text-muted-foreground">Version 0.0.8</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-refresh Dashboard</p>
              <p className="text-xs text-muted-foreground">Automatically refresh agent status every 5 seconds</p>
            </div>
            <Toggle enabled={true} onChange={() => {}} />
          </div>
        </div>
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
