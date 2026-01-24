'use client';

import { useMemo } from 'react';
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
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';

export default function UsagePage() {
  const { data, loading, error } = useClaude();

  // Get today's stats - use the most recent available
  const todayActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity || data.stats.dailyActivity.length === 0) return null;

    // Sort by date descending and get the most recent
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

    // Sort by date descending and get the most recent
    const sorted = [...data.stats.dailyModelTokens].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const tokenData = sorted[0];

    const total = Object.values(tokenData.tokensByModel).reduce((a, b) => a + b, 0);
    return { total, byModel: tokenData.tokensByModel, date: tokenData.date };
  }, [data?.stats?.dailyModelTokens]);

  // Calculate total usage from model stats
  const totalUsage = useMemo(() => {
    if (!data?.stats?.modelUsage) return { totalCost: 0, totalTokens: 0, totalInput: 0, totalOutput: 0 };

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;

    Object.values(data.stats.modelUsage).forEach(usage => {
      totalCost += usage.costUSD || 0;
      totalInput += usage.inputTokens || 0;
      totalOutput += usage.outputTokens || 0;
    });

    return {
      totalCost,
      totalTokens: totalInput + totalOutput,
      totalInput,
      totalOutput,
    };
  }, [data?.stats?.modelUsage]);

  // Get last 7 days of activity for the chart
  const weeklyActivity = useMemo(() => {
    if (!data?.stats?.dailyActivity) return [];

    const last7Days = [...data.stats.dailyActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7)
      .reverse();

    return last7Days;
  }, [data?.stats?.dailyActivity]);

  // Get last 7 days of token usage
  const weeklyTokens = useMemo(() => {
    if (!data?.stats?.dailyModelTokens) return [];

    const last7Days = [...data.stats.dailyModelTokens]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7)
      .reverse();

    return last7Days.map(d => ({
      date: d.date,
      tokens: Object.values(d.tokensByModel).reduce((a, b) => a + b, 0),
    }));
  }, [data?.stats?.dailyModelTokens]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <BarChart2 className="w-7 h-7 text-accent-purple" />
          Usage Statistics
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Monitor your Claude Code usage and token consumption
        </p>
      </div>

      {/* Total Usage Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border-primary bg-bg-secondary p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Total Usage (All Time)</h2>
            <p className="text-sm text-text-muted">
              Since {stats?.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-bg-tertiary">
            <p className="text-xs text-text-muted mb-1">Total Cost</p>
            <p className="text-2xl font-bold text-accent-green">${totalUsage.totalCost.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary">
            <p className="text-xs text-text-muted mb-1">Total Tokens</p>
            <p className="text-2xl font-bold">{(totalUsage.totalTokens / 1000000).toFixed(2)}M</p>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary">
            <p className="text-xs text-text-muted mb-1">Input Tokens</p>
            <p className="text-2xl font-bold text-accent-cyan">{(totalUsage.totalInput / 1000000).toFixed(2)}M</p>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary">
            <p className="text-xs text-text-muted mb-1">Output Tokens</p>
            <p className="text-2xl font-bold text-accent-purple">{(totalUsage.totalOutput / 1000000).toFixed(2)}M</p>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Recent Messages</p>
              <p className="text-2xl font-bold">{todayActivity?.messageCount || 0}</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {todayActivity?.date || 'No data'} - {todayActivity?.toolCallCount || 0} tool calls
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Recent Tokens</p>
              <p className="text-2xl font-bold">{(todayTokens.total / 1000).toFixed(0)}k</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {todayTokens.date || 'No data'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Sessions</p>
              <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {todayActivity?.sessionCount || 0} recent sessions
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-amber/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-amber" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Messages</p>
              <p className="text-2xl font-bold">{stats?.totalMessages?.toLocaleString() || 0}</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            All time
          </p>
        </motion.div>
      </div>

      {/* Model Usage Breakdown */}
      {stats?.modelUsage && Object.keys(stats.modelUsage).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-text-muted" />
            Model Usage Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(stats.modelUsage).map(([model, usage]) => {
              const modelName = model.includes('opus') ? 'Claude Opus 4.5'
                : model.includes('sonnet') ? 'Claude Sonnet 4.5'
                : model;
              const totalTokens = usage.inputTokens + usage.outputTokens;
              const isOpus = model.includes('opus');

              return (
                <div key={model} className="p-4 rounded-lg bg-bg-tertiary border border-border-primary">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isOpus ? 'bg-accent-purple' : 'bg-accent-cyan'}`} />
                      <span className={`font-medium ${isOpus ? 'text-accent-purple' : 'text-accent-cyan'}`}>
                        {modelName}
                      </span>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {usage.costUSD?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Input</span>
                        <span>{(usage.inputTokens / 1000).toFixed(0)}k</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Output</span>
                        <span>{(usage.outputTokens / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Cache Read</span>
                        <span>{(usage.cacheReadInputTokens / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Cache Write</span>
                        <span>{(usage.cacheCreationInputTokens / 1000000).toFixed(2)}M</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border-primary flex justify-between text-xs text-text-muted">
                    <span>Total: {(totalTokens / 1000000).toFixed(2)}M tokens</span>
                    {usage.webSearchRequests > 0 && (
                      <span>{usage.webSearchRequests} web searches</span>
                    )}
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
          transition={{ delay: 0.35 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
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
                        transition={{ delay: 0.35 + i * 0.05, duration: 0.5 }}
                        className="w-full max-w-8 bg-gradient-to-t from-accent-cyan to-accent-purple rounded-t"
                      />
                    </div>
                    <span className="text-[10px] text-text-muted">{dayLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Weekly Tokens Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-text-muted" />
            Tokens (Last 7 Days)
          </h3>
          <div className="flex items-end gap-2 h-32">
            {weeklyTokens.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                No token data
              </div>
            ) : (
              weeklyTokens.map((day, i) => {
                const maxTokens = Math.max(...weeklyTokens.map(d => d.tokens));
                const height = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
                const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-24">
                      <span className="text-xs text-text-muted mb-1">{(day.tokens / 1000).toFixed(0)}k</span>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, 4)}%` }}
                        transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                        className="w-full max-w-8 bg-gradient-to-t from-accent-purple to-accent-amber rounded-t"
                      />
                    </div>
                    <span className="text-[10px] text-text-muted">{dayLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Activity by Hour */}
      {stats?.hourCounts && Object.keys(stats.hourCounts).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
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
                    transition={{ delay: 0.45 + hour * 0.02, duration: 0.3 }}
                    className={`w-full rounded-t transition-all ${count > 0 ? 'bg-accent-cyan' : 'bg-bg-tertiary'}`}
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
    </div>
  );
}
