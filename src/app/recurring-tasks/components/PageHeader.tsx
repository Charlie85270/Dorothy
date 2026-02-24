import { RefreshCw, Plus } from 'lucide-react';

interface PageHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
}

export function PageHeader({ isRefreshing, onRefresh, onCreateNew }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Scheduled Tasks</h1>
        <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
          Automate recurring tasks with your agents
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>
    </div>
  );
}
