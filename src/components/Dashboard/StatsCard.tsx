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
    bg: 'bg-accent-cyan/10',
    text: 'text-accent-cyan',
    border: 'border-accent-cyan/30',
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]',
  },
  green: {
    bg: 'bg-accent-green/10',
    text: 'text-accent-green',
    border: 'border-accent-green/30',
    glow: 'shadow-[0_0_15px_rgba(74,222,128,0.15)]',
  },
  amber: {
    bg: 'bg-accent-amber/10',
    text: 'text-accent-amber',
    border: 'border-accent-amber/30',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.15)]',
  },
  purple: {
    bg: 'bg-accent-purple/10',
    text: 'text-accent-purple',
    border: 'border-accent-purple/30',
    glow: 'shadow-[0_0_15px_rgba(167,139,250,0.15)]',
  },
  red: {
    bg: 'bg-accent-red/10',
    text: 'text-accent-red',
    border: 'border-accent-red/30',
    glow: 'shadow-[0_0_15px_rgba(248,113,113,0.15)]',
  },
  blue: {
    bg: 'bg-accent-blue/10',
    text: 'text-accent-blue',
    border: 'border-accent-blue/30',
    glow: 'shadow-[0_0_15px_rgba(96,165,250,0.15)]',
  },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color, trend }: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`
        relative overflow-hidden rounded-xl border ${colors.border} ${colors.glow}
        bg-bg-secondary p-5 card-hover
      `}
    >
      {/* Background decoration */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 ${colors.bg} rounded-full blur-2xl opacity-50`} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-text-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-text-muted">vs yesterday</span>
            </div>
          )}
        </div>
        <div className={`${colors.bg} ${colors.text} p-3 rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
