'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2,
  Zap,
  MessageSquare,
  Clock,
  TrendingUp,
  TrendingDown,
  Bot,
  Calendar,
  Activity,
  Loader2,
  AlertCircle,
  DollarSign,
  ChevronDown,
  Gauge,
  Timer,
  Minus,
  FolderOpen,
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';

// Token pricing per million tokens (MTok)
const MODEL_PRICING: Record<string, {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheHitsPerMTok: number;
  cache5mWritePerMTok: number;
  cache1hWritePerMTok: number;
}> = {
  // Opus 4.6
  'claude-opus-4-6-20250514': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  // Opus 4.5
  'claude-opus-4-5-20251101': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  'claude-opus-4-5': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  // Opus 4.1
  'claude-opus-4-1-20250501': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  'claude-opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  // Opus 4
  'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  'claude-opus-4': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  // Sonnet 4.6
  'claude-sonnet-4-6-20250514': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  // Sonnet 4.5
  'claude-sonnet-4-5-20251022': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  // Sonnet 4
  'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  'claude-sonnet-4': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  // Sonnet 3.7 (deprecated)
  'claude-3-7-sonnet-20250219': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  'claude-sonnet-3-7': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75, cache1hWritePerMTok: 6 },
  // Haiku 4.5
  'claude-haiku-4-5-20251022': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25, cache1hWritePerMTok: 2 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25, cache1hWritePerMTok: 2 },
  // Haiku 3.5
  'claude-3-5-haiku-20241022': { inputPerMTok: 0.80, outputPerMTok: 4, cacheHitsPerMTok: 0.08, cache5mWritePerMTok: 1, cache1hWritePerMTok: 1.6 },
  'claude-haiku-3-5': { inputPerMTok: 0.80, outputPerMTok: 4, cacheHitsPerMTok: 0.08, cache5mWritePerMTok: 1, cache1hWritePerMTok: 1.6 },
  // Opus 3 (deprecated)
  'claude-3-opus-20240229': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  'claude-opus-3': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  // Haiku 3
  'claude-3-haiku-20240307': { inputPerMTok: 0.25, outputPerMTok: 1.25, cacheHitsPerMTok: 0.03, cache5mWritePerMTok: 0.30, cache1hWritePerMTok: 0.50 },
  'claude-haiku-3': { inputPerMTok: 0.25, outputPerMTok: 1.25, cacheHitsPerMTok: 0.03, cache5mWritePerMTok: 0.30, cache1hWritePerMTok: 0.50 },
};

// Get pricing for a model (with fallback)
function getModelPricing(modelId: string) {
  // Try exact match first
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];

  // Try partial match
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('opus-4-6') || lowerModel.includes('opus-4.6')) {
    return MODEL_PRICING['claude-opus-4-6'];
  }
  if (lowerModel.includes('opus-4-5') || lowerModel.includes('opus-4.5')) {
    return MODEL_PRICING['claude-opus-4-5'];
  }
  if (lowerModel.includes('opus-4-1') || lowerModel.includes('opus-4.1')) {
    return MODEL_PRICING['claude-opus-4-1'];
  }
  if (lowerModel.includes('opus-4') || lowerModel.includes('opus4')) {
    return MODEL_PRICING['claude-opus-4'];
  }
  if (lowerModel.includes('opus-3') || lowerModel.includes('opus3')) {
    return MODEL_PRICING['claude-opus-3'];
  }
  if (lowerModel.includes('sonnet-4-6') || lowerModel.includes('sonnet-4.6')) {
    return MODEL_PRICING['claude-sonnet-4-6'];
  }
  if (lowerModel.includes('sonnet-4-5') || lowerModel.includes('sonnet-4.5')) {
    return MODEL_PRICING['claude-sonnet-4-5'];
  }
  if (lowerModel.includes('sonnet-4') || lowerModel.includes('sonnet4')) {
    return MODEL_PRICING['claude-sonnet-4'];
  }
  if (lowerModel.includes('sonnet-3') || lowerModel.includes('sonnet3')) {
    return MODEL_PRICING['claude-sonnet-3-7'];
  }
  if (lowerModel.includes('haiku-4-5') || lowerModel.includes('haiku-4.5')) {
    return MODEL_PRICING['claude-haiku-4-5'];
  }
  if (lowerModel.includes('haiku-3-5') || lowerModel.includes('haiku-3.5')) {
    return MODEL_PRICING['claude-haiku-3-5'];
  }
  if (lowerModel.includes('haiku-3') || lowerModel.includes('haiku3')) {
    return MODEL_PRICING['claude-haiku-3'];
  }

  // Default to Sonnet 4 pricing
  return MODEL_PRICING['claude-sonnet-4'];
}

// Calculate cost for a model usage
function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0
): number {
  const pricing = getModelPricing(modelId);

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheHitsPerMTok;
  // Use 5m cache write pricing (most common)
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.cache5mWritePerMTok;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

// Get friendly model name
function getModelDisplayName(modelId: string): string {
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('opus-4-6') || lowerModel.includes('opus-4.6')) return 'Claude Opus 4.6';
  if (lowerModel.includes('opus-4-5') || lowerModel.includes('opus-4.5')) return 'Claude Opus 4.5';
  if (lowerModel.includes('opus-4-1') || lowerModel.includes('opus-4.1')) return 'Claude Opus 4.1';
  if (lowerModel.includes('opus-4') || lowerModel.includes('opus4')) return 'Claude Opus 4';
  if (lowerModel.includes('opus-3') || lowerModel.includes('opus3')) return 'Claude Opus 3';
  if (lowerModel.includes('sonnet-4-6') || lowerModel.includes('sonnet-4.6')) return 'Claude Sonnet 4.6';
  if (lowerModel.includes('sonnet-4-5') || lowerModel.includes('sonnet-4.5')) return 'Claude Sonnet 4.5';
  if (lowerModel.includes('sonnet-4') || lowerModel.includes('sonnet4')) return 'Claude Sonnet 4';
  if (lowerModel.includes('sonnet-3') || lowerModel.includes('sonnet3')) return 'Claude Sonnet 3.7';
  if (lowerModel.includes('haiku-4-5') || lowerModel.includes('haiku-4.5')) return 'Claude Haiku 4.5';
  if (lowerModel.includes('haiku-3-5') || lowerModel.includes('haiku-3.5')) return 'Claude Haiku 3.5';
  if (lowerModel.includes('haiku-3') || lowerModel.includes('haiku3')) return 'Claude Haiku 3';
  return modelId;
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

export default function UsagePage() {
  const { data, loading, error } = useClaude();
  const [costTimeRange, setCostTimeRange] = useState<TimeRange>('daily');
  const [showPricingTable, setShowPricingTable] = useState(false);

  // Get today's stats - use the most recent available
  const todayActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity || data.stats.dailyActivity.length === 0) return null;

    const sorted = [...data.stats.dailyActivity].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0];
  }, [data?.stats?.dailyActivity]);

  // Calculate weekly trends (last 7 days vs previous 7 days)
  const trends = useMemo(() => {
    if (!data?.stats?.dailyActivity || data.stats.dailyActivity.length < 2) {
      return { messages: null, sessions: null };
    }

    const now = new Date();
    const msPerDay = 86400000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * msPerDay);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * msPerDay);

    let currentMessages = 0, prevMessages = 0;
    let currentSessions = 0, prevSessions = 0;

    data.stats.dailyActivity.forEach((day) => {
      const d = new Date(day.date + 'T00:00:00');
      if (d >= sevenDaysAgo) {
        currentMessages += day.messageCount || 0;
        currentSessions += day.sessionCount || 0;
      } else if (d >= fourteenDaysAgo) {
        prevMessages += day.messageCount || 0;
        prevSessions += day.sessionCount || 0;
      }
    });

    const calcPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      messages: { current: currentMessages, prev: prevMessages, pct: calcPct(currentMessages, prevMessages) },
      sessions: { current: currentSessions, prev: prevSessions, pct: calcPct(currentSessions, prevSessions) },
    };
  }, [data?.stats?.dailyActivity]);

  // Top projects by session count
  const topProjects = useMemo(() => {
    if (!data?.projects || data.projects.length === 0) return [];
    return [...data.projects]
      .map(p => ({ name: p.name || p.path || '(unknown)', path: p.path, sessions: p.sessions.length }))
      .filter(p => p.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [data?.projects]);

  // Get today's tokens
  const todayTokens = useMemo(() => {
    if (!data?.stats?.dailyModelTokens || data.stats.dailyModelTokens.length === 0) {
      return { total: 0, byModel: {} as Record<string, number>, date: null };
    }

    const sorted = [...data.stats.dailyModelTokens].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const tokenData = sorted[0];

    const total = Object.values(tokenData.tokensByModel).reduce((a, b) => a + b, 0);
    return { total, byModel: tokenData.tokensByModel, date: tokenData.date };
  }, [data?.stats?.dailyModelTokens]);

  // Calculate total usage and cost from model stats
  const totalUsage = useMemo(() => {
    if (!data?.stats?.modelUsage) return { totalCost: 0, totalTokens: 0, totalInput: 0, totalOutput: 0, totalCacheRead: 0, totalCacheWrite: 0 };

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    Object.entries(data.stats.modelUsage).forEach(([modelId, usage]) => {
      totalInput += usage.inputTokens || 0;
      totalOutput += usage.outputTokens || 0;
      totalCacheRead += usage.cacheReadInputTokens || 0;
      totalCacheWrite += usage.cacheCreationInputTokens || 0;

      // Use actual costUSD if available (Claude tracks this natively), else estimate
      if (usage.costUSD && usage.costUSD > 0) {
        totalCost += usage.costUSD;
      } else {
        totalCost += calculateModelCost(
          modelId,
          usage.inputTokens || 0,
          usage.outputTokens || 0,
          usage.cacheReadInputTokens || 0,
          usage.cacheCreationInputTokens || 0
        );
      }
    });

    return {
      totalCost,
      totalTokens: totalInput + totalOutput,
      totalInput,
      totalOutput,
      totalCacheRead,
      totalCacheWrite,
    };
  }, [data?.stats?.modelUsage]);

  // Cost-per-(input+output)-token rate for each model.
  // dailyModelTokens only tracks input+output tokens per day (not cache).
  // We compute rate = all_time_cost / (all_time_input + all_time_output) per model.
  // This properly amortises cache costs across productive token output.
  const costPerTokenByModel = useMemo(() => {
    if (!data?.stats?.modelUsage) return new Map<string, number>();
    const rateMap = new Map<string, number>();
    Object.entries(data.stats.modelUsage).forEach(([modelId, usage]) => {
      const nonCacheTotal = (usage.inputTokens || 0) + (usage.outputTokens || 0);
      if (nonCacheTotal === 0) return;
      const cost = calculateModelCost(
        modelId,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheReadInputTokens || 0,
        usage.cacheCreationInputTokens || 0,
      );
      rateMap.set(modelId, cost / nonCacheTotal);
    });
    return rateMap;
  }, [data?.stats?.modelUsage]);

  // Per-day cost map derived from per-model daily tokens × per-model cost rate
  const dailyCostMap = useMemo(() => {
    if (!data?.stats?.dailyModelTokens) return new Map<string, number>();
    const map = new Map<string, number>();
    data.stats.dailyModelTokens.forEach(day => {
      let dayCost = 0;
      Object.entries(day.tokensByModel).forEach(([modelId, tokens]) => {
        const rate = costPerTokenByModel.get(modelId);
        if (rate !== undefined) {
          dayCost += tokens * rate;
        } else {
          // Fallback: rough estimate assuming even input/output split
          dayCost += calculateModelCost(modelId, tokens / 2, tokens / 2, 0, 0);
        }
      });
      map.set(day.date, dayCost);
    });
    return map;
  }, [data?.stats?.dailyModelTokens, costPerTokenByModel]);

  // Calculate cost breakdown by model
  const modelCostBreakdown = useMemo(() => {
    if (!data?.stats?.modelUsage) return [];

    return Object.entries(data.stats.modelUsage).map(([modelId, usage]) => {
      const cost = calculateModelCost(
        modelId,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheReadInputTokens || 0,
        usage.cacheCreationInputTokens || 0
      );

      const pricing = getModelPricing(modelId);

      return {
        modelId,
        displayName: getModelDisplayName(modelId),
        cost,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        cacheReadTokens: usage.cacheReadInputTokens || 0,
        cacheWriteTokens: usage.cacheCreationInputTokens || 0,
        webSearchRequests: usage.webSearchRequests || 0,
        pricing,
      };
    }).sort((a, b) => b.cost - a.cost);
  }, [data?.stats?.modelUsage]);

  // Latest available date in stats (stats-cache.json is updated by Claude Code on session end,
  // so it may lag behind real-time — use lastComputedDate instead of today's calendar date)
  const latestDataDate = data?.stats?.lastComputedDate ?? null;

  // Get cost data for charts based on time range.
  // Anchor to lastComputedDate (not today's calendar date) since stats-cache.json
  // is only updated by Claude Code on session completion and may lag behind real-time.
  const costChartData = useMemo(() => {
    // Anchor date: latest date that has data, fallback to today
    const anchor = latestDataDate ? new Date(latestDataDate + 'T00:00:00') : new Date();
    anchor.setHours(0, 0, 0, 0);

    if (costTimeRange === 'daily') {
      // Last 30 calendar days ending at anchor
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - (29 - i));
        const dateKey = d.toISOString().split('T')[0];
        return {
          date: dateKey,
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          cost: dailyCostMap.get(dateKey) ?? 0,
        };
      });
    } else if (costTimeRange === 'weekly') {
      // Last 12 weeks (Sun–Sat) ending at anchor's week
      return Array.from({ length: 12 }, (_, i) => {
        const weekStart = new Date(anchor);
        weekStart.setDate(anchor.getDate() - anchor.getDay() - (11 - i) * 7);
        const weekKey = weekStart.toISOString().split('T')[0];
        let cost = 0;
        for (let d = 0; d < 7; d++) {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + d);
          const dk = day.toISOString().split('T')[0];
          cost += dailyCostMap.get(dk) ?? 0;
        }
        return {
          date: weekKey,
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          cost,
        };
      });
    } else {
      // Last 12 months ending at anchor's month
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - i), 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let cost = 0;
        dailyCostMap.forEach((dayCost, dateKey) => {
          if (dateKey.startsWith(monthKey)) cost += dayCost;
        });
        return {
          date: monthKey,
          label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          cost,
        };
      });
    }
  }, [dailyCostMap, costTimeRange, latestDataDate]);

  // Get last 7 days of activity for the chart
  const weeklyActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity) return [];

    const last7Days = [...data.stats.dailyActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7)
      .reverse();

    return last7Days;
  }, [data?.stats?.dailyActivity]);

  // Cost for the latest available day
  const todayCost = useMemo(() => {
    if (!latestDataDate) return 0;
    return dailyCostMap.get(latestDataDate) ?? 0;
  }, [dailyCostMap, latestDataDate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-4" />
          <p className="text-text-secondary">Loading usage data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-accent-red">
          <AlertCircle className="w-8 h-8 mx-auto mb-4" />
          <p className="mb-2">Failed to load usage data</p>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const maxCost = Math.max(...costChartData.map(d => d.cost), 0.01);

  return (
    <div className="space-y-4 lg:space-y-6 pt-4 lg:pt-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
          <span className="hidden sm:inline">Claude Code Usage & Quota</span>
          <span className="sm:hidden">Usage & Quota</span>
        </h1>
        <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
          Track your subscription quota, session activity, and estimated API costs
        </p>
      </div>

      {/* Subscription Quota */}
      {!data?.rateLimits && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-4"
        >
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <Gauge className="w-4 h-4 text-accent-cyan shrink-0" />
            <p>
              Enable the <span className="text-text-primary font-medium">Status Line</span> in Settings and run an agent to see your subscription quota here.
            </p>
          </div>
        </motion.div>
      )}
      {data?.rateLimits && (data.rateLimits.five_hour || data.rateLimits.seven_day) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-text-muted" />
            Subscription Quota
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 5-Hour Quota */}
            {data.rateLimits.five_hour && (() => {
              const rawPct = data.rateLimits.five_hour!.used_percentage;
              const resetsAt = data.rateLimits.five_hour!.resets_at;
              const now = Date.now() / 1000;
              const isStale = resetsAt < now;
              const pct = isStale ? 0 : rawPct;
              const remainingSec = Math.max(0, resetsAt - now);
              const remainingMin = Math.floor(remainingSec / 60);
              const remainingH = Math.floor(remainingMin / 60);
              const remainingM = remainingMin % 60;
              const resetLabel = isStale
                ? 'Window reset — awaiting update'
                : remainingH > 0
                  ? `Resets in ${remainingH}h ${remainingM}m`
                  : `Resets in ${remainingM}m`;
              const barColor = pct >= 90 ? 'bg-accent-red' : pct >= 70 ? 'bg-accent-amber' : 'bg-accent-green';

              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">5-Hour Window</span>
                    <span className="text-sm font-mono font-bold">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-bg-tertiary rounded-none overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${barColor} rounded-none`}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>{resetLabel}</span>
                  </div>
                </div>
              );
            })()}

            {/* 7-Day Quota */}
            {data.rateLimits.seven_day && (() => {
              const rawPct = data.rateLimits.seven_day!.used_percentage;
              const resetsAt = data.rateLimits.seven_day!.resets_at;
              const now = Date.now() / 1000;
              const isStale = resetsAt < now;
              const pct = isStale ? 0 : rawPct;
              const remainingSec = Math.max(0, resetsAt - now);
              const remainingH = Math.floor(remainingSec / 3600);
              const remainingD = Math.floor(remainingH / 24);
              const remainingHMod = remainingH % 24;
              const resetLabel = isStale
                ? 'Window reset — awaiting update'
                : remainingD > 0
                  ? `Resets in ${remainingD}d ${remainingHMod}h`
                  : `Resets in ${remainingH}h`;
              const barColor = pct >= 90 ? 'bg-accent-red' : pct >= 70 ? 'bg-accent-amber' : 'bg-accent-green';

              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">7-Day Window</span>
                    <span className="text-sm font-mono font-bold">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-bg-tertiary rounded-none overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${barColor} rounded-none`}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>{resetLabel}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-none bg-accent-green/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Cost (All Time)</p>
              <p className="text-xl lg:text-2xl font-bold text-accent-green">
                ${totalUsage.totalCost > 0 ? totalUsage.totalCost.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
          {data?.tokenStats?.extraCostUsd && data.tokenStats.extraCostUsd > 0 ? (
            <p className="text-xs text-accent-red">
              ~${data.tokenStats.extraCostUsd.toFixed(2)} estimated extra usage
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              {totalUsage.totalCost > 0
                ? `Since ${stats?.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString() : 'N/A'}`
                : 'Included in subscription'
              }
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          {(() => {
            // Use API dailyCostMap first, fall back to tokenStats.dailyCosts
            let dayCost = todayCost;
            let dayLabel = latestDataDate ?? 'No data';
            let isDorothyOnly = false;
            if (dayCost === 0 && data?.tokenStats?.dailyCosts) {
              const days = Object.keys(data.tokenStats.dailyCosts).sort();
              if (days.length > 0) {
                const latest = days[days.length - 1];
                const dc = data.tokenStats.dailyCosts[latest];
                if (dc.extraCost > 0) {
                  dayCost = dc.extraCost;
                  dayLabel = latest;
                  isDorothyOnly = true;
                }
              }
            }
            return (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-none bg-accent-amber/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-accent-amber" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Latest Day Cost</p>
                    <p className="text-xl lg:text-2xl font-bold text-accent-amber">${dayCost.toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  {dayLabel}{isDorothyOnly && ' (extra usage est.)'}
                </p>
              </>
            );
          })()}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-none bg-accent-purple/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Tokens</p>
              {(() => {
                const hasModelTokens = totalUsage.totalTokens > 0;
                const ts = data?.tokenStats;
                const totalTok = hasModelTokens ? totalUsage.totalTokens : (ts ? ts.totalInputTokens + ts.totalOutputTokens : 0);
                const inTok = hasModelTokens ? totalUsage.totalInput : (ts?.totalInputTokens ?? 0);
                const outTok = hasModelTokens ? totalUsage.totalOutput : (ts?.totalOutputTokens ?? 0);
                return <p className="text-xl lg:text-2xl font-bold">{(totalTok / 1000000).toFixed(2)}M</p>;
              })()}
            </div>
          </div>
          {(() => {
            const hasModelTokens = totalUsage.totalTokens > 0;
            const ts = data?.tokenStats;
            const inTok = hasModelTokens ? totalUsage.totalInput : (ts?.totalInputTokens ?? 0);
            const outTok = hasModelTokens ? totalUsage.totalOutput : (ts?.totalOutputTokens ?? 0);
            const dorothyOnly = !hasModelTokens && ts && (ts.totalInputTokens + ts.totalOutputTokens) > 0;
            return (
              <p className="text-xs text-text-muted">
                {(inTok / 1000000).toFixed(2)}M in / {(outTok / 1000000).toFixed(2)}M out
                {dorothyOnly && ' (Dorothy only)'}
              </p>
            );
          })()}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-none bg-accent-blue/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-accent-blue" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Cache Savings</p>
              <p className="text-xl lg:text-2xl font-bold text-accent-blue">{(totalUsage.totalCacheRead / 1000000).toFixed(2)}M</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Tokens served from cache
          </p>
        </motion.div>
      </div>

      {/* Cost Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-none border border-border-primary bg-bg-secondary p-5 h-[340px] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            Cost Over Time
          </div>
          <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-none border border-border-primary relative">
            {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setCostTimeRange(range)}
                className="px-3 py-1 text-xs font-medium capitalize relative z-10 transition-colors duration-200 cursor-pointer"
                style={{ borderRadius: '10px' }}
              >
                {costTimeRange === range && (
                  <motion.div
                    layoutId="costTimeRangeIndicator"
                    className="absolute inset-0 bg-accent-green/20"
                    style={{ borderRadius: '10px' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${costTimeRange === range ? 'text-accent-green' : 'text-text-muted hover:text-text-primary'}`}>
                  {range}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={costTimeRange}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-stretch gap-1 flex-1"
          >
            {costChartData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                No cost data available
              </div>
            ) : (
              costChartData.map((item, i) => {
                const height = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                const isDaily = costTimeRange === 'daily';
                const showCostLabel = isDaily ? height > 8 : true;
                const showDateLabel = isDaily
                  ? (i === 0 || i === 7 || i === 14 || i === 21 || i === 29 || item.cost === Math.max(...costChartData.map(d => d.cost)))
                  : true;
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-0.5 relative">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      {showCostLabel && (
                        <span className={`${isDaily ? 'text-[9px]' : 'text-xs'} text-accent-green font-medium mb-0.5 whitespace-nowrap`}>
                          ${item.cost < 1 ? item.cost.toFixed(2) : item.cost.toFixed(0)}
                        </span>
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, item.cost > 0 ? 3 : 0)}%` }}
                        transition={{ delay: 0.05 + i * 0.02, duration: 0.35 }}
                        className={`w-full bg-gradient-to-t from-accent-green to-accent-cyan rounded-none ${item.cost === 0 ? 'opacity-20' : ''}`}
                        title={`${item.label}: $${item.cost.toFixed(2)}`}
                      />
                    </div>
                    <span className={`${isDaily ? 'text-[8px]' : 'text-[10px]'} text-text-muted text-center leading-tight ${!showDateLabel ? 'invisible' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Model Cost Breakdown */}
      {(modelCostBreakdown.length > 0 || (data?.tokenStats?.modelTokens && Object.values(data.tokenStats.modelTokens).some(t => (t.in + t.out) > 0))) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5 flex flex-col"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-text-muted" />
            Model Usage Breakdown
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* Pie Chart */}
            <div className="flex flex-col items-center justify-center">
              {(() => {
                const MODEL_COLORS: Record<string, string> = {
                  opus: '#c084fc',
                  sonnet: '#22d3ee',
                  haiku: '#fbbf24',
                };

                // Build family map from modelCostBreakdown or tokenStats.modelTokens
                const familyMap: Record<string, number> = {};
                if (modelCostBreakdown.length > 0) {
                  modelCostBreakdown.forEach((m) => {
                    const lower = m.displayName.toLowerCase();
                    const family = lower.includes('opus') ? 'Opus' : lower.includes('sonnet') ? 'Sonnet' : 'Haiku';
                    familyMap[family] = (familyMap[family] || 0) + m.inputTokens + m.outputTokens;
                  });
                } else if (data?.tokenStats?.modelTokens) {
                  Object.entries(data.tokenStats.modelTokens).forEach(([modelId, tokens]) => {
                    const lower = modelId.toLowerCase();
                    const family = lower.includes('opus') ? 'Opus' : lower.includes('sonnet') ? 'Sonnet' : lower.includes('haiku') ? 'Haiku' : 'Other';
                    familyMap[family] = (familyMap[family] || 0) + tokens.in + tokens.out;
                  });
                }

                const totalTokensAll = Object.values(familyMap).reduce((sum, t) => sum + t, 0);
                if (totalTokensAll === 0) return null;

                const families: { name: string; tokens: number; color: string }[] = [];
                Object.entries(familyMap).forEach(([name, tokens]) => {
                  if (tokens <= 0) return;
                  const key = name.toLowerCase();
                  families.push({ name, tokens, color: MODEL_COLORS[key] || '#94a3b8' });
                });
                families.sort((a, b) => b.tokens - a.tokens);

                // Build pie slices
                const radius = 70;
                const cx = 80;
                const cy = 80;
                let startAngle = -Math.PI / 2;
                const slices = families.map((f) => {
                  const pct = f.tokens / totalTokensAll;
                  const angle = pct * 2 * Math.PI;
                  const endAngle = startAngle + angle;
                  const largeArc = angle > Math.PI ? 1 : 0;
                  const x1 = cx + radius * Math.cos(startAngle);
                  const y1 = cy + radius * Math.sin(startAngle);
                  const x2 = cx + radius * Math.cos(endAngle);
                  const y2 = cy + radius * Math.sin(endAngle);
                  const d = families.length === 1
                    ? `M ${cx} ${cy} m -${radius} 0 a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 -${radius * 2} 0`
                    : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  const slice = { ...f, d, pct };
                  startAngle = endAngle;
                  return slice;
                });

                return (
                  <div className="flex flex-col items-center gap-3">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      {slices.map((s, i) => (
                        <path key={i} d={s.d} fill={s.color} opacity={0.85} stroke="var(--bg-secondary)" strokeWidth="2" />
                      ))}
                      <circle cx={cx} cy={cy} r="40" fill="var(--bg-secondary)" />
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">
                        {totalTokensAll >= 1000000 ? `${(totalTokensAll / 1000000).toFixed(1)}M` : `${(totalTokensAll / 1000).toFixed(0)}k`}
                      </text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
                        tokens
                      </text>
                    </svg>
                    <div className="flex flex-wrap justify-center gap-3">
                      {slices.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-text-muted">{s.name}</span>
                          <span className="font-medium">{(s.pct * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Model details */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelCostBreakdown.length > 0 ? modelCostBreakdown.map((model) => {
                const isOpus = model.displayName.toLowerCase().includes('opus');
                const isSonnet = model.displayName.toLowerCase().includes('sonnet');
                const colorClass = isOpus ? 'accent-purple' : isSonnet ? 'accent-cyan' : 'accent-amber';

                return (
                  <div key={model.modelId} className="p-4 rounded-none bg-bg-tertiary border border-border-primary">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-${colorClass}`} />
                        <span className={`font-medium text-${colorClass}`}>
                          {model.displayName}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-accent-green">
                        ${model.cost.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Input</span>
                          <span>{(model.inputTokens / 1000).toFixed(0)}k</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Output</span>
                          <span>{(model.outputTokens / 1000).toFixed(0)}k</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Cache Read</span>
                          <span>{(model.cacheReadTokens / 1000000).toFixed(2)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Cache Write</span>
                          <span>{(model.cacheWriteTokens / 1000000).toFixed(2)}M</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border-primary text-xs text-text-muted">
                      <div className="flex justify-between">
                        <span>Rate: ${model.pricing.inputPerMTok}/MTok in, ${model.pricing.outputPerMTok}/MTok out</span>
                      </div>
                    </div>
                  </div>
                );
              }) : data?.tokenStats?.modelTokens && Object.entries(data.tokenStats.modelTokens).filter(([, tokens]) => (tokens.in + tokens.out) > 0).map(([modelId, tokens]) => {
                const displayName = getModelDisplayName(modelId);
                const lower = displayName.toLowerCase();
                const isOpus = lower.includes('opus');
                const isSonnet = lower.includes('sonnet');
                const colorClass = isOpus ? 'accent-purple' : isSonnet ? 'accent-cyan' : 'accent-amber';
                const totalTok = tokens.in + tokens.out;

                return (
                  <div key={modelId} className="p-4 rounded-none bg-bg-tertiary border border-border-primary">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-${colorClass}`} />
                        <span className={`font-medium text-${colorClass}`}>
                          {displayName}
                        </span>
                      </div>
                      <span className="text-sm font-bold">
                        {(totalTok / 1000000).toFixed(2)}M
                      </span>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Input</span>
                        <span>{(tokens.in / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Output</span>
                        <span>{(tokens.out / 1000000).toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5 flex flex-col"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            Messages (Last 7 Days)
          </div>
          <div className="flex items-end gap-2 flex-1 min-h-0 pb-2">
            {weeklyActivity.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                No activity data
              </div>
            ) : (
              weeklyActivity.map((day, i) => {
                const maxMessages = Math.max(...weeklyActivity.map(d => d.messageCount));
                const height = maxMessages > 0 ? (day.messageCount / maxMessages) * 100 : 0;
                const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      <span className="text-xs text-text-muted mb-1">{day.messageCount}</span>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, 4)}%` }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                        className="w-full max-w-8 bg-gradient-to-t from-accent-cyan to-accent-purple rounded-none"
                      />
                    </div>
                    <span className="text-[10px] text-text-muted">{dayLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Session Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-text-muted" />
            Session Statistics
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Total Sessions</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats?.totalSessions?.toLocaleString() || 0}</p>
                {trends.sessions && trends.sessions.pct !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs ${trends.sessions.pct > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {trends.sessions.pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(trends.sessions.pct)}%
                  </span>
                )}
              </div>
              {trends.sessions && <p className="text-[10px] text-text-muted mt-1">vs prev. 7 days</p>}
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Total Messages</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats?.totalMessages?.toLocaleString() || 0}</p>
                {trends.messages && trends.messages.pct !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs ${trends.messages.pct > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {trends.messages.pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(trends.messages.pct)}%
                  </span>
                )}
              </div>
              {trends.messages && <p className="text-[10px] text-text-muted mt-1">vs prev. 7 days</p>}
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Recent Sessions</p>
              <p className="text-2xl font-bold">{todayActivity?.sessionCount || 0}</p>
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Recent Tool Calls</p>
              <p className="text-2xl font-bold">{todayActivity?.toolCallCount || 0}</p>
            </div>
            {data?.tokenStats && data.tokenStats.sessionCount > 0 && (
              <div className="p-4 rounded-none bg-bg-tertiary col-span-2">
                <p className="text-xs text-text-muted mb-1">Avg Tokens / Session</p>
                <p className="text-2xl font-bold">
                  {(() => {
                    const avg = (data.tokenStats.totalInputTokens + data.tokenStats.totalOutputTokens) / data.tokenStats.sessionCount;
                    return avg >= 1000000 ? `${(avg / 1000000).toFixed(1)}M` : avg >= 1000 ? `${(avg / 1000).toFixed(1)}k` : Math.round(avg).toString();
                  })()}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Top Projects by Sessions */}
      {topProjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5 h-[340px] flex flex-col"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-text-muted" />
            Top Projects
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2 min-h-0">
            {topProjects.map((project, i) => {
              const maxSessions = topProjects[0].sessions;
              const barWidth = (project.sessions / maxSessions) * 100;
              return (
                <div key={project.path} className="flex items-center gap-3 group">
                  <span className="text-xs text-text-muted w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium truncate mr-2">{project.name}</span>
                      <span className="text-xs text-text-muted whitespace-nowrap">{project.sessions} session{project.sessions !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary rounded-none overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
                        className="h-full bg-accent-blue rounded-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Activity by Hour */}
      {stats?.hourCounts && Object.keys(stats.hourCounts).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="text-sm font-medium mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            Activity by Hour of Day
          </div>
          <div className="flex gap-1 h-24">
            {Array.from({ length: 24 }, (_, hour) => {
              const count = stats.hourCounts[hour.toString()] || 0;
              const maxCount = Math.max(...Object.values(stats.hourCounts));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 4)}%` }}
                      transition={{ delay: 0.4 + hour * 0.02, duration: 0.3 }}
                      className={`w-full rounded-none transition-all relative ${count > 0 ? 'bg-accent-blue hover:bg-accent-blue/80' : 'bg-bg-tertiary'}`}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-bg-primary border border-border-primary text-[10px] text-text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {count} msg{count !== 1 ? 's' : ''} · {hour}h
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-[10px] text-text-muted h-3 leading-3">
                    {hour % 4 === 0 ? hour : '\u00A0'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </motion.div>
      )}

      {/* Pricing Reference Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-none border border-border-primary bg-bg-secondary p-5"
      >
        <button
          onClick={() => setShowPricingTable(!showPricingTable)}
          className="w-full flex items-center justify-between text-sm font-medium cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            Pricing Reference
          </span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${showPricingTable ? 'rotate-180' : ''}`} />
        </button>

        {showPricingTable && (
          <div className="mt-4 overflow-x-auto space-y-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary">
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Model</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Input</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Output</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Cache Hits</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">5m Cache Write</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">1h Cache Write</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Claude Opus 4.6', key: 'claude-opus-4-6' },
                  { name: 'Claude Opus 4.6 (Fast Mode)', key: 'fast-opus-4-6', fast: true },
                  { name: 'Claude Opus 4.5', key: 'claude-opus-4-5' },
                  { name: 'Claude Opus 4.1', key: 'claude-opus-4-1' },
                  { name: 'Claude Opus 4', key: 'claude-opus-4' },
                  { name: 'Claude Sonnet 4.6', key: 'claude-sonnet-4-6' },
                  { name: 'Claude Sonnet 4.5', key: 'claude-sonnet-4-5' },
                  { name: 'Claude Sonnet 4', key: 'claude-sonnet-4' },
                  { name: 'Claude Haiku 4.5', key: 'claude-haiku-4-5' },
                  { name: 'Claude Haiku 3.5', key: 'claude-haiku-3-5' },
                  { name: 'Claude Haiku 3', key: 'claude-haiku-3' },
                ].map((model) => {
                  if ('fast' in model) {
                    return (
                      <tr key={model.key} className="border-b border-border-primary/50 hover:bg-bg-tertiary/50">
                        <td className="py-2 px-2 font-medium">{model.name}</td>
                        <td className="text-right py-2 px-2">$30/MTok</td>
                        <td className="text-right py-2 px-2">$150/MTok</td>
                        <td className="text-right py-2 px-2">$3/MTok</td>
                        <td className="text-right py-2 px-2">$37.50/MTok</td>
                        <td className="text-right py-2 px-2">$60/MTok</td>
                      </tr>
                    );
                  }
                  const pricing = MODEL_PRICING[model.key];
                  return (
                    <tr key={model.key} className="border-b border-border-primary/50 hover:bg-bg-tertiary/50">
                      <td className="py-2 px-2 font-medium">{model.name}</td>
                      <td className="text-right py-2 px-2">${pricing.inputPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.outputPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.cacheHitsPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.cache5mWritePerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.cache1hWritePerMTok}/MTok</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
