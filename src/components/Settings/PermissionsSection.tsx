import type { ClaudeSettings } from './types';

interface PermissionsSectionProps {
  settings: ClaudeSettings | null;
}

export const PermissionsSection = ({ settings }: PermissionsSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Permissions</h2>
        <p className="text-sm text-muted-foreground">Manage allowed and denied actions for Claude</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Allowed Permissions</label>
            <div className="p-4 bg-secondary border border-border min-h-[80px]">
              {settings?.permissions?.allow && settings.permissions.allow.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.permissions.allow.map((perm, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No custom permissions set</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Denied Permissions</label>
            <div className="p-4 bg-secondary border border-border min-h-[80px]">
              {settings?.permissions?.deny && settings.permissions.deny.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.permissions.deny.map((perm, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-mono"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No denied permissions</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Permissions are managed through Claude Code CLI. Use <code className="text-foreground bg-secondary px-1 py-0.5">claude config</code> to modify.
          </p>
        </div>
      </div>
    </div>
  );
};
