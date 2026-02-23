import { SCHEDULE_PRESETS, DAY_OPTIONS, type ScheduleFormFields } from '../types';

interface ScheduleFieldPickerProps {
  value: ScheduleFormFields;
  onChange: (fields: Partial<ScheduleFormFields>) => void;
}

export function ScheduleFieldPicker({ value, onChange }: ScheduleFieldPickerProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Schedule</label>
          <select
            value={value.schedulePreset}
            onChange={(e) => onChange({ schedulePreset: e.target.value })}
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
          >
            {SCHEDULE_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </div>
        {value.schedulePreset !== 'hourly' && (
          <div>
            <label className="block text-sm font-medium mb-2">Time</label>
            <input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ time: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
            />
          </div>
        )}
      </div>

      {value.schedulePreset === 'every_n_days' && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <input
            type="number"
            min={2}
            max={30}
            value={value.intervalDays}
            onChange={(e) => onChange({ intervalDays: parseInt(e.target.value) || 2 })}
            className="w-16 px-2 py-1.5 bg-secondary border border-border rounded text-sm text-center"
          />
          <span className="text-sm text-muted-foreground">days</span>
          <div className="flex items-center gap-1 ml-1">
            {[2, 3, 7, 14].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ intervalDays: n })}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  value.intervalDays === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 border border-border'
                }`}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
      )}

      {value.schedulePreset === 'specific_days' && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {DAY_OPTIONS.map(day => {
              const isSelected = value.selectedDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? value.selectedDays.filter(d => d !== day.value)
                      : [...value.selectedDays, day.value];
                    if (next.length > 0) onChange({ selectedDays: next });
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80 border border-border'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.schedulePreset === 'custom' && (
        <div className="mt-3">
          <input
            type="text"
            value={value.customCron}
            onChange={(e) => onChange({ customCron: e.target.value })}
            placeholder="0 9 * * 1-5"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Format: minute hour day month weekday (e.g., &apos;0 9 * * 1-5&apos; for weekdays at 9am)
          </p>
        </div>
      )}
    </div>
  );
}
