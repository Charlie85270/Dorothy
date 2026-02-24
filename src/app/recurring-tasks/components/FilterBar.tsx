import { Filter } from 'lucide-react';

interface FilterBarProps {
  projects: string[];
  filterProject: string;
  onFilterProjectChange: (value: string) => void;
  filterSchedule: string;
  onFilterScheduleChange: (value: string) => void;
}

export function FilterBar({
  projects,
  filterProject,
  onFilterProjectChange,
  filterSchedule,
  onFilterScheduleChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filters:</span>
      </div>

      <select
        value={filterProject}
        onChange={(e) => onFilterProjectChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg"
      >
        <option value="all">All Projects</option>
        {projects.map(p => (
          <option key={p} value={p}>{p.split('/').pop()}</option>
        ))}
      </select>

      <select
        value={filterSchedule}
        onChange={(e) => onFilterScheduleChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg"
      >
        <option value="all">All Schedules</option>
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
    </div>
  );
}
