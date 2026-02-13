'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  Zap,
  MessageSquare,
  Clock,
  TrendingUp,
  Bot,
  Calendar,
  Activity,
  Loader2,
  AlertCircle,
  DollarSign,
  ChevronDown,
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
  // Opus 4.5
  'claude-opus-4-5-20251101': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  'claude-opus-4-5': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25, cache1hWritePerMTok: 10 },
  // Opus 4.1
  'claude-opus-4-1-20250501': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  'claude-opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  // Opus 4
  'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
  'claude-opus-4': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75, cache1hWritePerMTok: 30 },
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
  if (lowerModel.includes('opus-4-5') || lowerModel.includes('opus-4.5')) return 'Claude Opus 4.5';
  if (lowerModel.includes('opus-4-1') || lowerModel.includes('opus-4.1')) return 'Claude Opus 4.1';
  if (lowerModel.includes('opus-4') || lowerModel.includes('opus4')) return 'Claude Opus 4';
  if (lowerModel.includes('opus-3') || lowerModel.includes('opus3')) return 'Claude Opus 3';
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
  const [costTimeRange, setCostTimeRange] = useState<TimeRange>('weekly');
  const [showPricingTable, setShowPricingTable] = useState(false);

  // Get today's stats - use the most recent available
  const todayActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity || data.stats.dailyActivity.length === 0) return null;

    const sorted = [...data.stats.dailyActivity].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0];
  }, [data?.stats?.dailyActivity]);

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

      // Calculate cost using our pricing
      totalCost += calculateModelCost(
        modelId,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheReadInputTokens || 0,
        usage.cacheCreationInputTokens || 0
      );
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

  // Calculate total tokens from daily data and use proportional cost allocation
  const { totalDailyTokens, dailyTokensData } = useMemo(() => {
    if (!data?.stats?.dailyModelTokens) return { totalDailyTokens: 0, dailyTokensData: [] };

    const sorted = [...data.stats.dailyModelTokens].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let total = 0;
    const dailyData = sorted.map(day => {
      const dayTokens = Object.values(day.tokensByModel).reduce((sum, t) => sum + t, 0);
      total += dayTokens;
      return { date: day.date, tokens: dayTokens };
    });

    return { totalDailyTokens: total, dailyTokensData: dailyData };
  }, [data?.stats?.dailyModelTokens]);

  // Get cost data for charts based on time range - using proportional allocation
  const costChartData = useMemo(() => {
    if (dailyTokensData.length === 0 || totalDailyTokens === 0) return [];

    // Calculate each day's cost as a proportion of total cost
    const calculateDayCost = (dayTokens: number) => {
      const proportion = dayTokens / totalDailyTokens;
      return proportion * totalUsage.totalCost;
    };

    if (costTimeRange === 'daily') {
      // Last 7 days
      return dailyTokensData.slice(-7).map(day => ({
        date: day.date,
        label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
        cost: calculateDayCost(day.tokens),
      }));
    } else if (costTimeRange === 'weekly') {
      // Last 4 weeks
      const weeks: { [key: string]: { tokens: number; startDate: string } } = {};
      dailyTokensData.forEach(day => {
        const date = new Date(day.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeks[weekKey]) {
          weeks[weekKey] = { tokens: 0, startDate: weekKey };
        }

        weeks[weekKey].tokens += day.tokens;
      });

      return Object.values(weeks)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(-4)
        .map(week => ({
          date: week.startDate,
          label: `Week of ${new Date(week.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          cost: calculateDayCost(week.tokens),
        }));
    } else {
      // Last 6 months
      const months: { [key: string]: { tokens: number; monthKey: string } } = {};
      dailyTokensData.forEach(day => {
        const date = new Date(day.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!months[monthKey]) {
          months[monthKey] = { tokens: 0, monthKey };
        }

        months[monthKey].tokens += day.tokens;
      });

      return Object.values(months)
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .slice(-6)
        .map(month => ({
          date: month.monthKey,
          label: new Date(month.monthKey + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          cost: calculateDayCost(month.tokens),
        }));
    }
  }, [dailyTokensData, totalDailyTokens, costTimeRange, totalUsage.totalCost]);

  // Get last 7 days of activity for the chart
  const weeklyActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity) return [];

    const last7Days = [...data.stats.dailyActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7)
      .reverse();

    return last7Days;
  }, [data?.stats?.dailyActivity]);

  // Today's estimated cost using proportional allocation
  const todayCost = useMemo(() => {
    if (!todayTokens.byModel || Object.keys(todayTokens.byModel).length === 0 || totalDailyTokens === 0) return 0;

    const todayTotalTokens = Object.values(todayTokens.byModel).reduce((sum, t) => sum + t, 0);
    const proportion = todayTotalTokens / totalDailyTokens;
    return proportion * totalUsage.totalCost;
  }, [todayTokens.byModel, totalDailyTokens, totalUsage.totalCost]);

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
          <span className="hidden sm:inline">Usage & Cost Analytics</span>
          <span className="sm:hidden">Usage & Costs</span>
        </h1>
        <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
          Monitor your Claude API usage and estimated costs
        </p>
      </div>

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
              <p className="text-xl lg:text-2xl font-bold text-accent-green">${totalUsage.totalCost.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Since {stats?.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString() : 'N/A'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-none bg-accent-amber/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-amber" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Today's Cost</p>
              <p className="text-xl lg:text-2xl font-bold text-accent-amber">${todayCost.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {todayTokens.date || 'No data today'}
          </p>
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
              <p className="text-xl lg:text-2xl font-bold">{(totalUsage.totalTokens / 1000000).toFixed(2)}M</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {(totalUsage.totalInput / 1000000).toFixed(2)}M in / {(totalUsage.totalOutput / 1000000).toFixed(2)}M out
          </p>
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
        className="rounded-none border border-border-primary bg-bg-secondary p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-accent-green" />
            Cost Over Time
          </h3>
          <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-none border border-border-primary">
            {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setCostTimeRange(range)}
                className={`
                  px-3 py-1 rounded text-xs font-medium transition-all capitalize
                  ${costTimeRange === range
                    ? 'bg-accent-green/20 text-accent-green'
                    : 'text-text-muted hover:text-text-primary'
                  }
                `}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2 h-48">
          {costChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              No cost data available
            </div>
          ) : (
            costChartData.map((item, i) => {
              const height = (item.cost / maxCost) * 100;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-40">
                    <span className="text-xs text-accent-green font-medium mb-1">
                      ${item.cost.toFixed(2)}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 4)}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                      className="w-full max-w-12 bg-gradient-to-t from-accent-green to-accent-cyan rounded-none"
                    />
                  </div>
                  <span className="text-[10px] text-text-muted text-center">{item.label}</span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Model Cost Breakdown */}
      {modelCostBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-text-muted" />
            Cost by Model
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modelCostBreakdown.map((model) => {
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
            })}
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
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            Messages (Last 7 Days)
          </h3>
          <div className="flex items-end gap-2 h-32">
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
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-24">
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
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-text-muted" />
            Session Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Total Sessions</p>
              <p className="text-2xl font-bold">{stats?.totalSessions?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Total Messages</p>
              <p className="text-2xl font-bold">{stats?.totalMessages?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Recent Sessions</p>
              <p className="text-2xl font-bold">{todayActivity?.sessionCount || 0}</p>
            </div>
            <div className="p-4 rounded-none bg-bg-tertiary">
              <p className="text-xs text-text-muted mb-1">Recent Tool Calls</p>
              <p className="text-2xl font-bold">{todayActivity?.toolCallCount || 0}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Activity by Hour */}
      {stats?.hourCounts && Object.keys(stats.hourCounts).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-none border border-border-primary bg-bg-secondary p-5"
        >
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            Activity by Hour of Day
          </h3>
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 24 }, (_, hour) => {
              const count = stats.hourCounts[hour.toString()] || 0;
              const maxCount = Math.max(...Object.values(stats.hourCounts));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 4)}%` }}
                    transition={{ delay: 0.4 + hour * 0.02, duration: 0.3 }}
                    className={`w-full rounded-none transition-all ${count > 0 ? 'bg-accent-blue' : 'bg-bg-tertiary'}`}
                    title={`${hour}:00 - ${count} sessions`}
                  />
                  {hour % 4 === 0 && (
                    <span className="text-[10px] text-text-muted">{hour}</span>
                  )}
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
          className="w-full flex items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-text-muted" />
            Pricing Reference
          </span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${showPricingTable ? 'rotate-180' : ''}`} />
        </button>

        {showPricingTable && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary">
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Model</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Input</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Output</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">Cache Hits</th>
                  <th className="text-right py-2 px-2 text-text-muted font-medium">5m Cache Write</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Claude Opus 4.5', key: 'claude-opus-4-5' },
                  { name: 'Claude Opus 4.1', key: 'claude-opus-4-1' },
                  { name: 'Claude Opus 4', key: 'claude-opus-4' },
                  { name: 'Claude Sonnet 4.5', key: 'claude-sonnet-4-5' },
                  { name: 'Claude Sonnet 4', key: 'claude-sonnet-4' },
                  { name: 'Claude Haiku 4.5', key: 'claude-haiku-4-5' },
                  { name: 'Claude Haiku 3.5', key: 'claude-haiku-3-5' },
                  { name: 'Claude Haiku 3', key: 'claude-haiku-3' },
                ].map((model) => {
                  const pricing = MODEL_PRICING[model.key];
                  return (
                    <tr key={model.key} className="border-b border-border-primary/50 hover:bg-bg-tertiary/50">
                      <td className="py-2 px-2 font-medium">{model.name}</td>
                      <td className="text-right py-2 px-2">${pricing.inputPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.outputPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.cacheHitsPerMTok}/MTok</td>
                      <td className="text-right py-2 px-2">${pricing.cache5mWritePerMTok}/MTok</td>
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
