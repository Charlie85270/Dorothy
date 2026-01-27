'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import {
  GitBranch,
  RefreshCw,
  Loader2,
  GitCommit,
  Plus,
  Minus,
  FileDiff,
  FileText,
  Clock,
  User,
  ChevronRight,
  ChevronDown,
  Code2,
} from 'lucide-react';
import type { GitData } from './constants';
import { INITIAL_GIT_DATA } from './constants';

interface GitPanelProps {
  projectPath: string;
  className?: string;
}

// Memoized commit item to prevent re-renders
const CommitItem = memo(function CommitItem({
  commit,
}: {
  commit: { hash: string; message: string; author: string; date: string };
}) {
  return (
    <div className="px-3 py-2 border-b border-border-primary/50 last:border-0 hover:bg-bg-tertiary/30">
      <div className="flex items-center gap-2">
        <code className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
          {commit.hash}
        </code>
        <span className="text-xs text-text-primary truncate flex-1">
          {commit.message}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <User className="w-2.5 h-2.5" />
          {commit.author}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {commit.date}
        </span>
      </div>
    </div>
  );
});

// Memoized file status item
const FileStatusItem = memo(function FileStatusItem({
  item,
}: {
  item: { status: string; file: string };
}) {
  const getStatusIcon = () => {
    switch (item.status) {
      case 'added':
        return <Plus className="w-3 h-3 text-green-400 shrink-0" />;
      case 'deleted':
        return <Minus className="w-3 h-3 text-red-400 shrink-0" />;
      case 'modified':
        return <FileDiff className="w-3 h-3 text-amber-400 shrink-0" />;
      case 'renamed':
        return <FileText className="w-3 h-3 text-blue-400 shrink-0" />;
      default:
        return <FileDiff className="w-3 h-3 text-text-muted shrink-0" />;
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'added':
        return 'text-green-400';
      case 'deleted':
        return 'text-red-400';
      case 'modified':
        return 'text-amber-400';
      case 'renamed':
        return 'text-blue-400';
      default:
        return 'text-text-secondary';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-tertiary/30">
      {getStatusIcon()}
      <span className={`truncate ${getStatusColor()}`}>{item.file}</span>
    </div>
  );
});

export default function GitPanel({ projectPath, className = '' }: GitPanelProps) {
  const [gitData, setGitData] = useState<GitData>(INITIAL_GIT_DATA);
  const [loading, setLoading] = useState(false);
  const [showCommits, setShowCommits] = useState(false);

  // Load git data
  const loadGitData = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;

    setLoading(true);

    try {
      const [branchResult, statusResult, diffResult, logResult] = await Promise.all([
        window.electronAPI.shell.exec({
          command: 'git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null',
          cwd: projectPath,
        }),
        window.electronAPI.shell.exec({
          command: 'git status --porcelain 2>/dev/null',
          cwd: projectPath,
        }),
        window.electronAPI.shell.exec({
          command: 'git diff --stat 2>/dev/null | tail -20',
          cwd: projectPath,
        }),
        window.electronAPI.shell.exec({
          command: 'git log --oneline --pretty=format:"%h|%s|%an|%ar" -10 2>/dev/null',
          cwd: projectPath,
        }),
      ]);

      const branch =
        branchResult.success && branchResult.output
          ? branchResult.output.replace(/\r/g, '').trim()
          : 'unknown';

      const status: Array<{ status: string; file: string }> = [];
      if (statusResult.success && statusResult.output) {
        const lines = statusResult.output.split('\n').filter((l) => l.trim());
        lines.forEach((line) => {
          const statusCode = line.slice(0, 2);
          const file = line.slice(3).replace(/\r/g, '').trim();
          if (file) {
            let statusText = 'modified';
            if (statusCode.includes('A') || statusCode.includes('?')) statusText = 'added';
            else if (statusCode.includes('D')) statusText = 'deleted';
            else if (statusCode.includes('R')) statusText = 'renamed';
            else if (statusCode.includes('M')) statusText = 'modified';
            status.push({ status: statusText, file });
          }
        });
      }

      const diff =
        diffResult.success && diffResult.output ? diffResult.output.replace(/\r/g, '') : '';

      const commits: Array<{ hash: string; message: string; author: string; date: string }> = [];
      if (logResult.success && logResult.output) {
        const lines = logResult.output.split('\n').filter((l) => l.trim());
        lines.forEach((line) => {
          const parts = line.split('|');
          if (parts.length >= 4) {
            commits.push({
              hash: parts[0].replace(/\r/g, ''),
              message: parts[1].replace(/\r/g, ''),
              author: parts[2].replace(/\r/g, ''),
              date: parts[3].replace(/\r/g, ''),
            });
          }
        });
      }

      setGitData({ branch, status, diff, commits });
    } catch (err) {
      console.error('Failed to load git data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // Open project in Cursor IDE
  const handleOpenInCursor = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;
    try {
      await window.electronAPI.shell.exec({
        command: `open -a "Cursor" "${projectPath}"`,
      });
    } catch (err) {
      console.error('Failed to open in Cursor:', err);
    }
  }, [projectPath]);

  // Load git data on mount and when path changes
  useEffect(() => {
    loadGitData();
  }, [loadGitData]);

  return (
    <div className={`flex flex-col bg-[#0d0d14] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-text-primary">Git</span>
          <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
            {gitData.branch || 'loading...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenInCursor}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
            title="Open project in Cursor"
          >
            <Code2 className="w-3 h-3" />
            Cursor
          </button>
          <button
            onClick={loadGitData}
            className="p-1 hover:bg-bg-tertiary rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && gitData.status.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Changed Files */}
          <div className="border-b border-border-primary shrink-0">
            <div className="px-3 py-2 bg-bg-tertiary/20">
              <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                <FileDiff className="w-3.5 h-3.5" />
                <span>Changes</span>
                {gitData.status.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                    {gitData.status.length}
                  </span>
                )}
              </div>
            </div>
            {gitData.status.length === 0 ? (
              <div className="px-3 py-3 text-xs text-text-muted text-center">No changes</div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {gitData.status.map((item, idx) => (
                  <FileStatusItem key={`${item.file}-${idx}`} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Commits - Collapsed by default */}
          <div className="shrink-0 border-t border-border-primary">
            <button
              onClick={() => setShowCommits(!showCommits)}
              className="w-full px-3 py-2 bg-bg-tertiary/20 flex items-center justify-between hover:bg-bg-tertiary/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                <GitCommit className="w-3.5 h-3.5" />
                <span>Recent Commits</span>
                {gitData.commits.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                    {gitData.commits.length}
                  </span>
                )}
              </div>
              {showCommits ? (
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
              )}
            </button>
            {showCommits && (
              <>
                {gitData.commits.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-text-muted text-center">No commits</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    {gitData.commits.map((commit, idx) => (
                      <CommitItem key={`${commit.hash}-${idx}`} commit={commit} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
