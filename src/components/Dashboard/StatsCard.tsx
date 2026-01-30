'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'amber' | 'purple' | 'red' | 'blue';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const colorMap = {
  cyan: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
  green: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
  amber: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
  purple: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
  red: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
  blue: {
    bg: 'bg-white/5',
    text: 'text-white',
    border: 'hover:border-white/30',
  },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color, trend }: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden border border-border
        bg-card p-6 transition-all duration-200
        hover:border-white/30 hover:shadow-elevated
      `}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">vs yesterday</span>
            </div>
          )}
        </div>
        <div className={`${colors.bg} ${colors.text} p-3`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
