interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export const Toggle = ({ enabled, onChange, disabled }: ToggleProps) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`w-11 h-6 rounded-full transition-colors relative ${
      enabled ? 'bg-white' : 'bg-secondary'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div
      className={`w-4 h-4 rounded-full shadow transition-all absolute top-1 ${
        enabled ? 'bg-black left-6' : 'bg-muted-foreground left-1'
      }`}
    />
  </button>
);
