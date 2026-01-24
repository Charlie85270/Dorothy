'use client';

import { motion } from 'framer-motion';
import { FolderKanban, MessageSquare, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ClaudeProject } from '@/lib/claude-code';

interface ProjectsOverviewProps {
  projects: ClaudeProject[];
}

// Generate consistent colors for projects based on name
const getProjectColor = (name: string) => {
  const colors = [
    '#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#f472b6', '#34d399',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-accent-amber" />
          <h3 className="text-sm font-medium">Projects</h3>
        </div>
        <Link href="/projects" className="text-xs text-accent-cyan hover:underline">
          View all →
        </Link>
      </div>

      {/* Projects List */}
      <div className="divide-y divide-border-primary max-h-80 overflow-y-auto">
        {projects.slice(0, 6).map((project, index) => {
          const color = getProjectColor(project.name);

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative px-5 py-4 hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
            >
              {/* Color indicator */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: color }}
              />

              <div className="pl-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{project.name}</h4>
                    <p className="text-xs text-text-muted mt-0.5 truncate font-mono">
                      {project.path}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{project.sessions.length} sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(project.lastActivity)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {projects.length === 0 && (
          <div className="py-8 text-center text-text-muted">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No projects found</p>
          </div>
        )}
      </div>
    </div>
  );
}
