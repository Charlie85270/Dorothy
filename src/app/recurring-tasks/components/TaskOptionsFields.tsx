interface TaskOptionsFieldsProps {
  autonomous: boolean;
  onAutonomousChange: (value: boolean) => void;
  useWorktree?: boolean;
  onWorktreeChange?: (value: boolean) => void;
}

export function TaskOptionsFields({
  autonomous,
  onAutonomousChange,
  useWorktree,
  onWorktreeChange,
}: TaskOptionsFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={autonomous}
          onChange={(e) => onAutonomousChange(e.target.checked)}
          className="w-4 h-4 rounded border-border"
        />
        <div>
          <span className="text-sm font-medium">Run autonomously</span>
          <p className="text-xs text-muted-foreground">Skip permission prompts during execution</p>
        </div>
      </label>

      {onWorktreeChange !== undefined && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useWorktree ?? false}
            onChange={(e) => onWorktreeChange(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <div>
            <span className="text-sm font-medium">Use git worktree</span>
            <p className="text-xs text-muted-foreground">Run in isolated branch</p>
          </div>
        </label>
      )}
    </div>
  );
}
