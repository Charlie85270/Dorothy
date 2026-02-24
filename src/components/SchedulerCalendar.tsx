'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Play, FileText, Pencil, Trash2, Clock } from 'lucide-react';
import type { ScheduledTask } from '@/app/recurring-tasks/types';

export type { ScheduledTask };

const TOOLTIP_WIDTH = 288;

const START_HOUR = 0;
const END_HOUR = 23;
const HOUR_HEIGHT = 52; // px per hour
const DEFAULT_DURATION_MIN = 30;

const TASK_COLORS = [
  { classes: 'bg-blue-500/15 border-blue-500/40 text-blue-400 hover:bg-blue-500/22', dot: 'bg-blue-500' },
  { classes: 'bg-violet-500/15 border-violet-500/40 text-violet-400 hover:bg-violet-500/22', dot: 'bg-violet-500' },
  { classes: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/22', dot: 'bg-emerald-500' },
  { classes: 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/22', dot: 'bg-amber-500' },
  { classes: 'bg-rose-500/15 border-rose-500/40 text-rose-400 hover:bg-rose-500/22', dot: 'bg-rose-500' },
  { classes: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/22', dot: 'bg-cyan-500' },
  { classes: 'bg-pink-500/15 border-pink-500/40 text-pink-400 hover:bg-pink-500/22', dot: 'bg-pink-500' },
];

interface CalendarEvent {
  task: ScheduledTask;
  dayOffset: number;
  hour: number;
  minute: number;
  durationMin: number;
  colorIdx: number;
}

interface AllDayEvent {
  task: ScheduledTask;
  dayOffset: number;
  colorIdx: number;
  label: string; // e.g. "Hourly"
}

interface SchedulerCalendarProps {
  tasks: ScheduledTask[];
  runningTasks?: Set<string>;
  onRunTask: (taskId: string) => void;
  onEditTask: (task: ScheduledTask) => void;
  onDeleteTask: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
}

// ── Cron helpers ──────────────────────────────────────────────────────────────

function expandField(field: string, min: number, max: number): number[] {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  if (field.includes('/')) {
    const [startStr, stepStr] = field.split('/');
    const start = startStr === '*' ? min : parseInt(startStr, 10);
    const step = parseInt(stepStr, 10);
    const result: number[] = [];
    for (let i = start; i <= max; i += step) result.push(i);
    return result;
  }
  if (field.includes(',')) return field.split(',').map(Number);
  if (field.includes('-')) {
    const [s, e] = field.split('-').map(Number);
    return Array.from({ length: e - s + 1 }, (_, i) => i + s);
  }
  const n = parseInt(field, 10);
  return isNaN(n) ? [] : [n];
}

interface ParsedCronResult {
  timedOccurrences: Array<{ hour: number; minute: number; dows: number[]; doms: number[] | null }>;
  allDayOccurrences: Array<{ dows: number[]; label: string }>;
}

function parseCron(cronStr: string): ParsedCronResult {
  const parts = cronStr.trim().split(/\s+/);
  if (parts.length < 5) return { timedOccurrences: [], allDayOccurrences: [] };

  const [minStr, hourStr, domStr, , dowStr] = parts;

  // Every-minute schedules → skip (too frequent to display)
  if (minStr === '*') return { timedOccurrences: [], allDayOccurrences: [] };

  const isDomSpecific = domStr !== '*';
  const isDowSpecific = dowStr !== '*';

  // Resolve day-of-week values (normalize 7 → 0 for Sunday)
  const getRawDows = (): number[] => {
    if (!isDowSpecific) return [0, 1, 2, 3, 4, 5, 6];
    return expandField(dowStr, 0, 7).map(d => (d === 7 ? 0 : d));
  };

  // ── All-day: hourStr is '*' or has many hours (e.g. */2) ───────────────────
  if (hourStr === '*' || hourStr.startsWith('*/')) {
    const stepLabel = hourStr.startsWith('*/') ? `Every ${hourStr.split('/')[1]}h` : 'Hourly';
    const dows = getRawDows();
    // For dom-specific, we handle it in timed (skip here for clarity)
    return {
      timedOccurrences: [],
      allDayOccurrences: isDomSpecific ? [] : [{ dows, label: stepLabel }],
    };
  }

  // ── Timed events ───────────────────────────────────────────────────────────
  const hours = expandField(hourStr, 0, 23);
  const minutes = expandField(minStr, 0, 59);

  const timedOccurrences: ParsedCronResult['timedOccurrences'] = [];

  for (const hour of hours) {
    for (const minute of minutes) {
      if (isDomSpecific && !isDowSpecific) {
        const doms = expandField(domStr, 1, 31);
        timedOccurrences.push({ hour, minute, dows: [0, 1, 2, 3, 4, 5, 6], doms });
      } else {
        const dows = getRawDows();
        timedOccurrences.push({ hour, minute, dows, doms: null });
      }
    }
  }

  return { timedOccurrences, allDayOccurrences: [] };
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const s = weekStart;
  const e = weekEnd;
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en', { month: 'short' })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`;
}

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Overlap layout ────────────────────────────────────────────────────────────

interface LayoutEvent extends CalendarEvent {
  laneIdx: number;
  laneCount: number;
}

function layoutEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute),
  );

  // Greedy lane assignment: find the first lane whose last event has ended
  const laneEnds: number[] = [];
  const laneOf: number[] = [];

  for (const event of sorted) {
    const startMin = event.hour * 60 + event.minute;
    const endMin = startMin + event.durationMin;
    const free = laneEnds.findIndex(end => end <= startMin);
    const lane = free === -1 ? laneEnds.length : free;
    if (free === -1) laneEnds.push(endMin); else laneEnds[lane] = endMin;
    laneOf.push(lane);
  }

  // For each event, find the max lane index of all events it overlaps with
  const result: LayoutEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const startA = sorted[i].hour * 60 + sorted[i].minute;
    const endA = startA + sorted[i].durationMin;
    let maxLane = laneOf[i];
    for (let j = 0; j < sorted.length; j++) {
      if (i === j) continue;
      const startB = sorted[j].hour * 60 + sorted[j].minute;
      const endB = startB + sorted[j].durationMin;
      if (startA < endB && startB < endA) maxLane = Math.max(maxLane, laneOf[j]);
    }
    result.push({ ...sorted[i], laneIdx: laneOf[i], laneCount: maxLane + 1 });
  }

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SchedulerCalendar({
  tasks,
  runningTasks,
  onRunTask,
  onEditTask,
  onDeleteTask,
  onViewLogs,
}: SchedulerCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [taskDurations, setTaskDurations] = useState<Map<string, number>>(new Map());
  const [tooltip, setTooltip] = useState<{ event: CalendarEvent | AllDayEvent; anchor: DOMRect } | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close tooltip on Escape
  useEffect(() => {
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTooltip(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tooltip]);

  // Tick current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Scroll so current time (or 8am) is visible on mount
  useEffect(() => {
    if (!gridRef.current) return;
    const scrollHour = Math.max(0, now.getHours() - 1);
    gridRef.current.scrollTop = scrollHour * HOUR_HEIGHT;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load average run durations from logs
  useEffect(() => {
    if (!tasks.length) return;
    const load = async () => {
      const durations = new Map<string, number>();
      await Promise.all(
        tasks
          .filter(t => t.lastRun)
          .map(async task => {
            try {
              const result = await window.electronAPI?.scheduler?.getLogs(task.id);
              const runs: Array<{ startedAt: string; completedAt?: string }> = result?.runs ?? [];
              const completed = runs.filter(r => r.startedAt && r.completedAt);
              if (completed.length > 0) {
                const totalMs = completed.reduce(
                  (sum, r) => sum + (new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime()),
                  0,
                );
                const avgMin = totalMs / completed.length / 60_000;
                durations.set(task.id, Math.max(15, Math.round(avgMin)));
              }
            } catch {
              // ignore
            }
          }),
      );
      setTaskDurations(durations);
    };
    load();
  }, [tasks]);

  // Stable color per task
  const taskColorMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t, i) => map.set(t.id, i % TASK_COLORS.length));
    return map;
  }, [tasks]);

  // Generate events for current week
  const { timedEvents, allDayEvents } = useMemo(() => {
    const timed: CalendarEvent[] = [];
    const allDay: AllDayEvent[] = [];

    for (const task of tasks) {
      const colorIdx = taskColorMap.get(task.id) ?? 0;
      const durationMin = taskDurations.get(task.id) ?? DEFAULT_DURATION_MIN;
      const { timedOccurrences, allDayOccurrences } = parseCron(task.schedule);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + dayOffset);
        const dayDow = day.getDay();
        const dayDom = day.getDate();

        // All-day events
        for (const occ of allDayOccurrences) {
          if (occ.dows.includes(dayDow)) {
            allDay.push({ task, dayOffset, colorIdx, label: occ.label });
          }
        }

        // Timed events
        for (const occ of timedOccurrences) {
          const runs = occ.doms !== null ? occ.doms.includes(dayDom) : occ.dows.includes(dayDow);
          if (runs) {
            timed.push({ task, dayOffset, hour: occ.hour, minute: occ.minute, durationMin, colorIdx });
          }
        }
      }
    }

    return { timedEvents: timed, allDayEvents: allDay };
  }, [tasks, weekStart, taskDurations, taskColorMap]);

  // Navigation
  const navigate = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
    setTooltip(null);
  };
  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
    setTooltip(null);
  };

  // Compute tooltip position anchored to the clicked event rect
  const getTooltipStyle = (anchor: DOMRect): React.CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOOLTIP_H = 220;
    let left = anchor.right + 10;
    let top = anchor.top;
    if (left + TOOLTIP_WIDTH > vw - 12) left = anchor.left - TOOLTIP_WIDTH - 10;
    left = Math.max(8, left);
    if (top + TOOLTIP_H > vh - 12) top = Math.max(8, vh - TOOLTIP_H - 12);
    return { position: 'fixed', left, top, width: TOOLTIP_WIDTH, zIndex: 9999 };
  };

  const todayWeekStart = getWeekStart(new Date());
  const isCurrentWeek = weekStart.toDateString() === todayWeekStart.toDateString();
  const todayOffset = isCurrentWeek ? new Date().getDay() : -1;

  // Current time line
  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();
  const nowTop = (nowHour * 60 + nowMinute) / 60 * HOUR_HEIGHT;
  const showNowLine = isCurrentWeek;

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
  const hasAllDay = allDayEvents.length > 0;

  const isCalendarEvent = (e: CalendarEvent | AllDayEvent): e is CalendarEvent => 'hour' in e;

  const isSelected = (e: CalendarEvent | AllDayEvent) => {
    if (!tooltip) return false;
    const sel = tooltip.event;
    if (isCalendarEvent(e) && isCalendarEvent(sel)) {
      return e.task.id === sel.task.id && e.dayOffset === sel.dayOffset && e.hour === sel.hour && e.minute === sel.minute;
    }
    if (!isCalendarEvent(e) && !isCalendarEvent(sel)) {
      return e.task.id === sel.task.id && e.dayOffset === sel.dayOffset;
    }
    return false;
  };

  const openTooltip = (e: React.MouseEvent<HTMLButtonElement>, event: CalendarEvent | AllDayEvent) => {
    e.stopPropagation();
    const anchor = e.currentTarget.getBoundingClientRect();
    setTooltip(prev => {
      if (!prev) return { event, anchor };
      // Toggle off if clicking the same event
      const same = isCalendarEvent(event) && isCalendarEvent(prev.event)
        ? event.task.id === prev.event.task.id && event.dayOffset === prev.event.dayOffset && event.hour === prev.event.hour
        : !isCalendarEvent(event) && !isCalendarEvent(prev.event) && event.task.id === prev.event.task.id && event.dayOffset === prev.event.dayOffset;
      return same ? null : { event, anchor };
    });
  };

  const totalEvents = timedEvents.length + allDayEvents.length;

  return (
    <>
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors font-medium ${
              isCurrentWeek
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border hover:bg-secondary text-foreground'
            }`}
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalEvents === 0 ? 'No tasks this week' : `${totalEvents} occurrence${totalEvents !== 1 ? 's' : ''} this week`}
        </span>
      </div>

      {/* Day headers */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
        <div className="border-r border-border" />
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + i);
          const isToday = i === todayOffset;
          return (
            <div
              key={i}
              className={`py-2 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}
            >
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {DAY_NAMES[day.getDay()]}
              </div>
              <div
                className={`text-sm font-bold mt-0.5 w-6 h-6 flex items-center justify-center mx-auto rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' : ''
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day / hourly row */}
      {hasAllDay && (
        <div className="grid border-b border-border" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
          <div className="border-r border-border flex items-center justify-end pr-1.5">
            <span className="text-[9px] text-muted-foreground/60 rotate-0 leading-tight">all‑day</span>
          </div>
          {Array.from({ length: 7 }, (_, dayOffset) => {
            const dayAllDay = allDayEvents.filter(e => e.dayOffset === dayOffset);
            const isToday = dayOffset === todayOffset;
            return (
              <div
                key={dayOffset}
                className={`border-r border-border last:border-r-0 min-h-[28px] p-0.5 flex flex-col gap-0.5 ${isToday ? 'bg-primary/5' : ''}`}
              >
                {dayAllDay.map((event, idx) => {
                  const color = TASK_COLORS[event.colorIdx];
                  const sel = isSelected(event);
                  return (
                    <button
                      key={`${event.task.id}-${idx}`}
                      onClick={(e) => openTooltip(e, event)}
                      className={`w-full rounded border text-left px-1 py-0.5 transition-all ${color.classes} ${sel ? 'ring-1 ring-current' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        {runningTasks?.has(event.task.id) ? (
                          <div className="relative shrink-0 w-1.5 h-1.5">
                            <div className={`absolute inset-0 rounded-full ${color.dot} animate-ping opacity-75`} />
                            <div className={`relative rounded-full w-1.5 h-1.5 ${color.dot}`} />
                          </div>
                        ) : (
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                        )}
                        <span className="text-[9px] font-medium truncate">{event.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: '480px' }}>
        <div className="grid relative" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
          {/* Time labels */}
          <div className="border-r border-border">
            {hours.map(hour => (
              <div
                key={hour}
                className="border-b border-border/40 flex items-start justify-end pr-1.5 pt-0.5"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-[9px] text-muted-foreground/50 tabular-nums">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {Array.from({ length: 7 }, (_, dayOffset) => {
            const colEvents = timedEvents.filter(e => e.dayOffset === dayOffset);
            const isToday = dayOffset === todayOffset;

            return (
              <div
                key={dayOffset}
                className={`relative border-r border-border last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`}
                style={{ height: `${24 * HOUR_HEIGHT}px` }}
              >
                {/* Hour lines */}
                {hours.map((_, hIdx) => (
                  <div
                    key={hIdx}
                    className="absolute w-full border-b border-border/25"
                    style={{ top: `${hIdx * HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Current time line */}
                {isToday && showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 -translate-x-0.5" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}

                {/* Timed events */}
                {layoutEvents(colEvents).map((event, idx) => {
                  const topPx = (event.hour * 60 + event.minute) / 60 * HOUR_HEIGHT;
                  const heightPx = Math.max(22, (event.durationMin / 60) * HOUR_HEIGHT);
                  const color = TASK_COLORS[event.colorIdx];
                  const sel = isSelected(event);
                  const GAP = 2;
                  const colW = 100 / event.laneCount;
                  const leftPct = event.laneIdx * colW;

                  return (
                    <button
                      key={`${event.task.id}-${idx}`}
                      onClick={(e) => openTooltip(e, event)}
                      className={`absolute rounded border text-left overflow-hidden transition-all cursor-pointer ${color.classes} ${sel ? 'ring-1 ring-offset-0 ring-current z-20' : 'z-10 hover:z-20'}`}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + ${GAP}px)`,
                        width: `calc(${colW}% - ${GAP * 2}px)`,
                      }}
                    >
                      {heightPx < 38 ? (
                        // Single-line compact: dot · title · time
                        <div className="px-1.5 h-full flex items-center gap-1 min-w-0">
                          {runningTasks?.has(event.task.id) ? (
                            <div className="relative shrink-0 w-1.5 h-1.5">
                              <div className={`absolute inset-0 rounded-full ${color.dot} animate-ping opacity-75`} />
                              <div className={`relative rounded-full w-1.5 h-1.5 ${color.dot}`} />
                            </div>
                          ) : (
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                          )}
                          <span className="text-[10px] font-medium leading-none truncate flex-1 min-w-0">
                            {event.task.title || `${event.hour.toString().padStart(2, '0')}:${event.minute.toString().padStart(2, '0')}`}
                          </span>
                        </div>
                      ) : (
                        // Two-line: title prominent, time secondary
                        <div className="px-1.5 pt-1 h-full flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            {runningTasks?.has(event.task.id) ? (
                              <div className="relative shrink-0 w-1.5 h-1.5">
                                <div className={`absolute inset-0 rounded-full ${color.dot} animate-ping opacity-75`} />
                                <div className={`relative rounded-full w-1.5 h-1.5 ${color.dot}`} />
                              </div>
                            ) : (
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                            )}
                            <span className="text-[10px] font-semibold tabular-nums leading-none opacity-70">
                              {`${event.hour.toString().padStart(2, '0')}:${event.minute.toString().padStart(2, '0')}`}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium leading-tight truncate opacity-90 pl-0.5">
                            {event.task.title || event.task.prompt}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

    </div>

    {/* Floating tooltip portal */}
    {mounted && tooltip && createPortal(
      <>
        {/* Invisible backdrop to close on outside click */}
        <div className="fixed inset-0 z-[9998]" onClick={() => setTooltip(null)} />
        {/* Tooltip card */}
        <div
          className="bg-card border border-border rounded-xl shadow-2xl p-4"
          style={getTooltipStyle(tooltip.anchor)}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${TASK_COLORS[tooltip.event.colorIdx].dot}`} />
              <div className="min-w-0">
                {tooltip.event.task.title && (
                  <p className="text-sm font-bold leading-tight mb-0.5 truncate">{tooltip.event.task.title}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`${tooltip.event.task.title ? 'text-xs text-muted-foreground' : 'text-sm font-semibold'} leading-tight`}>
                    {isCalendarEvent(tooltip.event)
                      ? `${DAY_NAMES[new Date(weekStart.getTime() + tooltip.event.dayOffset * 86_400_000).getDay()]} at ${tooltip.event.hour.toString().padStart(2, '0')}:${tooltip.event.minute.toString().padStart(2, '0')}`
                      : `${DAY_NAMES[new Date(weekStart.getTime() + tooltip.event.dayOffset * 86_400_000).getDay()]} · ${(tooltip.event as AllDayEvent).label}`}
                  </span>
                  {tooltip.event.task.lastRunStatus && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tooltip.event.task.lastRunStatus === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {tooltip.event.task.lastRunStatus === 'success' ? 'SUCCESS' : 'FAILED'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{tooltip.event.task.scheduleHuman || tooltip.event.task.schedule}</span>
                  {isCalendarEvent(tooltip.event) && (
                    <span className="shrink-0">· ~{taskDurations.get(tooltip.event.task.id) ?? DEFAULT_DURATION_MIN}min</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setTooltip(null)}
              className="p-1 hover:bg-secondary rounded-lg transition-colors shrink-0 -mr-1 -mt-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Prompt */}
          <p className="text-xs text-muted-foreground mb-3 line-clamp-3 ml-4">
            {tooltip.event.task.prompt}
          </p>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5 ml-4">
            <button
              onClick={() => { onRunTask(tooltip.event.task.id); setTooltip(null); }}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors col-span-2"
            >
              <Play className="w-3 h-3" />
              Run Now
            </button>
            <button
              onClick={() => { onViewLogs(tooltip.event.task.id); setTooltip(null); }}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <FileText className="w-3 h-3" />
              Logs
            </button>
            <button
              onClick={() => { onEditTask(tooltip.event.task); setTooltip(null); }}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={() => { onDeleteTask(tooltip.event.task.id); setTooltip(null); }}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors col-span-2"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </>,
      document.body,
    )}
    </>
  );
}
