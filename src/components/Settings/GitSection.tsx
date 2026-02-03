import { Toggle } from './Toggle';
import type { ClaudeSettings } from './types';

interface GitSectionProps {
  settings: ClaudeSettings | null;
  onUpdateSettings: (updates: Partial<ClaudeSettings>) => void;
}

export const GitSection = ({ settings, onUpdateSettings }: GitSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Git Settings</h2>
        <p className="text-sm text-muted-foreground">Configure git commit behavior and preferences</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <p className="font-medium">Include Co-Authored-By</p>
              <p className="text-sm text-muted-foreground">Add Claude as co-author in git commits</p>
            </div>
            <Toggle
              enabled={settings?.includeCoAuthoredBy ?? false}
              onChange={() => onUpdateSettings({ includeCoAuthoredBy: !settings?.includeCoAuthoredBy })}
            />
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              When enabled, commits made with Claude&apos;s assistance will include a co-authored-by trailer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
