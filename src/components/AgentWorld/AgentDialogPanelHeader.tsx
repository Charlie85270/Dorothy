import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AgentDialogPanelHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  isExpanded: boolean;
  badge?: React.ReactNode;
  onToggle: () => void;
}

export const AgentDialogPanelHeader = memo(function AgentDialogPanelHeader({
  icon: Icon,
  title,
  color,
  isExpanded,
  badge,
  onToggle,
}: AgentDialogPanelHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-bg-tertiary/50 ${
        isExpanded ? 'bg-bg-tertiary/30' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm font-medium">{title}</span>
        {badge}
      </div>
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
    </button>
  );
});
