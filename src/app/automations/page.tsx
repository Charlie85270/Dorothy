'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Plus,
  RefreshCw,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  Bot,
  FolderOpen,
  Send,
  Play,
  Pause,
  X,
  Github,
  Globe,
  MessageSquare,
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';

// Slack Icon component
const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor">
    <path d="M126.12,315.1A47.06,47.06,0,1,1,79.06,268h47.06Z"/>
    <path d="M149.84,315.1a47.06,47.06,0,0,1,94.12,0V432.94a47.06,47.06,0,1,1-94.12,0Z"/>
    <path d="M196.9,126.12A47.06,47.06,0,1,1,244,79.06v47.06Z"/>
    <path d="M196.9,149.84a47.06,47.06,0,0,1,0,94.12H79.06a47.06,47.06,0,0,1,0-94.12Z"/>
    <path d="M385.88,196.9A47.06,47.06,0,1,1,432.94,244H385.88Z"/>
    <path d="M362.16,196.9a47.06,47.06,0,0,1-94.12,0V79.06a47.06,47.06,0,1,1,94.12,0Z"/>
    <path d="M315.1,385.88A47.06,47.06,0,1,1,268,432.94V385.88Z"/>
    <path d="M315.1,362.16a47.06,47.06,0,0,1,0-94.12H432.94a47.06,47.06,0,1,1,0,94.12Z"/>
  </svg>
);

interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: {
    type: 'cron' | 'interval';
    cron?: string;
    intervalMinutes?: number;
  };
  source: {
    type: string;
    config: Record<string, unknown>;
  };
  trigger: {
    eventTypes: string[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: string;
  };
  outputs: Array<{
    type: string;
    enabled: boolean;
    template?: string;
  }>;
}

interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  itemsFound: number;
  itemsProcessed: number;
  error?: string;
}

type IconComponent = React.ComponentType<{ className?: string }>;

function getSourceIcon(type: string): IconComponent {
  const icons: Record<string, IconComponent> = {
    github: Github,
    jira: Globe,
    pipedrive: Globe,
    twitter: MessageSquare,
    rss: Globe,
    custom: Globe,
  };
  return icons[type] || Globe;
}

const SCHEDULE_PRESETS = [
  { value: '15', label: 'Every 15 minutes', minutes: 15 },
  { value: '30', label: 'Every 30 minutes', minutes: 30 },
  { value: '60', label: 'Every hour', minutes: 60 },
  { value: '120', label: 'Every 2 hours', minutes: 120 },
  { value: '360', label: 'Every 6 hours', minutes: 360 },
  { value: '1440', label: 'Daily', minutes: 1440 },
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<{ automation: Automation; runs: AutomationRun[] } | null>(null);
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourceType: 'github' as Automation['source']['type'],
    repos: '',
    pollFor: ['pull_requests'] as string[],
    scheduleMinutes: '30',
    eventTypes: ['pr'] as string[],
    onNewItem: true,
    agentEnabled: true,
    agentPrompt: '',
    projectPath: '',
    outputTelegram: false,
    outputSlack: false,
    outputGitHubComment: false,
    outputTemplate: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load automations via MCP call (simulated via fetch to API that calls MCP)
  const loadAutomations = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI?.automation?.list();
      if (result?.automations) {
        setAutomations(result.automations);
      }
    } catch (err) {
      console.error('Error loading automations:', err);
      setAutomations([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadAutomations();
      setIsLoading(false);
    };
    init();
  }, [loadAutomations]);

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAutomations();
    setIsRefreshing(false);
    setToast({ message: 'Automations refreshed', type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  // Create automation
  const handleCreateAutomation = async () => {
    if (!isElectron()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const sourceConfig = {
        repos: formData.repos.split(',').map(r => r.trim()).filter(Boolean),
        pollFor: formData.pollFor,
      };

      const result = await window.electronAPI?.automation?.create({
        name: formData.name,
        description: formData.description,
        sourceType: formData.sourceType,
        sourceConfig: JSON.stringify(sourceConfig),
        scheduleMinutes: parseInt(formData.scheduleMinutes),
        eventTypes: formData.eventTypes,
        onNewItem: formData.onNewItem,
        agentEnabled: formData.agentEnabled,
        agentPrompt: formData.agentPrompt,
        agentProjectPath: formData.projectPath || undefined,
        outputTelegram: formData.outputTelegram,
        outputSlack: formData.outputSlack,
        outputGitHubComment: formData.outputGitHubComment,
        outputTemplate: formData.outputTemplate || undefined,
      });

      if (result?.success) {
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          sourceType: 'github',
          repos: '',
          pollFor: ['pull_requests'],
          scheduleMinutes: '30',
          eventTypes: ['pr'],
          onNewItem: true,
          agentEnabled: true,
          agentPrompt: '',
          projectPath: '',
          outputTelegram: false,
          outputSlack: false,
          outputGitHubComment: false,
          outputTemplate: '',
        });
        await loadAutomations();
        setToast({ message: 'Automation created successfully', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      } else {
        setCreateError(result?.error || 'Failed to create automation');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create automation');
    }
    setIsCreating(false);
  };

  // Delete automation
  const handleDeleteAutomation = async (id: string) => {
    if (!isElectron()) return;
    if (!confirm('Are you sure you want to delete this automation?')) return;
    try {
      await window.electronAPI?.automation?.delete(id);
      await loadAutomations();
      setToast({ message: 'Automation deleted', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('Error deleting automation:', err);
      setToast({ message: 'Failed to delete automation', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Toggle automation enabled/disabled
  const handleToggleAutomation = async (automation: Automation) => {
    if (!isElectron()) return;
    try {
      await window.electronAPI?.automation?.update(automation.id, { enabled: !automation.enabled });
      await loadAutomations();
      setToast({
        message: automation.enabled ? 'Automation paused' : 'Automation resumed',
        type: 'success'
      });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('Error toggling automation:', err);
    }
  };

  // Run automation now
  const handleRunAutomation = async (id: string) => {
    if (!isElectron()) return;
    setRunningAutomationId(id);
    try {
      const result = await window.electronAPI?.automation?.run(id);
      if (result?.success) {
        setToast({
          message: `Processed ${result.itemsProcessed || 0} items`,
          type: 'success'
        });
      } else {
        setToast({ message: result?.error || 'Failed to run', type: 'error' });
      }
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Error running automation:', err);
      setToast({ message: 'Failed to run automation', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
    setRunningAutomationId(null);
  };

  // View logs
  const handleViewLogs = async (automation: Automation) => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI?.automation?.getLogs(automation.id);
      setSelectedLogs({ automation, runs: result?.runs || [] });
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Format schedule
  const formatSchedule = (schedule: Automation['schedule']): string => {
    if (schedule.type === 'interval' && schedule.intervalMinutes) {
      const mins = schedule.intervalMinutes;
      if (mins < 60) return `Every ${mins} min`;
      const hours = Math.floor(mins / 60);
      if (mins % 60 === 0) return `Every ${hours}h`;
      return `Every ${hours}h ${mins % 60}m`;
    }
    if (schedule.type === 'cron' && schedule.cron) {
      return schedule.cron;
    }
    return 'Unknown';
  };

  if (!isElectron()) {
    return (
      <div className="p-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-yellow-500">This feature is only available in the desktop app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Automations</h1>
            <p className="text-sm text-muted-foreground">
              Poll external sources and trigger Claude agents automatically
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Automation
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 text-white' :
              'bg-blue-500/90 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading automations...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Automation List */}
          <div className="space-y-3">
            {automations.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No automations yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first automation to poll GitHub, JIRA, or other sources.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Automation
                </button>
              </div>
            ) : (
              automations.map((automation) => {
                const SourceIcon = getSourceIcon(automation.source.type);
                return (
                  <motion.div
                    key={automation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-card border rounded-lg p-4 hover:border-primary/30 transition-colors ${
                      automation.enabled ? 'border-border' : 'border-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <SourceIcon className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium">{automation.name}</span>
                          {automation.enabled ? (
                            <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[10px] font-medium">
                              ENABLED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-500 rounded text-[10px] font-medium">
                              PAUSED
                            </span>
                          )}
                        </div>

                        {automation.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {automation.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatSchedule(automation.schedule)}
                          </div>

                          <div className="flex items-center gap-1">
                            <SourceIcon className="w-3 h-3" />
                            {automation.source.type}
                            {automation.source.type === 'github' && (
                              <span className="text-muted-foreground/60">
                                ({(automation.source.config as { repos?: string[] })?.repos?.length || 0} repos)
                              </span>
                            )}
                          </div>

                          {automation.agent.enabled && (
                            <div className="flex items-center gap-1">
                              <Bot className="w-3 h-3" />
                              Agent enabled
                            </div>
                          )}

                          {automation.agent.projectPath && (
                            <div className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {automation.agent.projectPath.split('/').pop()}
                            </div>
                          )}

                          {automation.outputs.some(o => o.type === 'telegram' && o.enabled) && (
                            <div className="flex items-center gap-1 text-blue-400">
                              <Send className="w-3 h-3" />
                              Telegram
                            </div>
                          )}

                          {automation.outputs.some(o => o.type === 'slack' && o.enabled) && (
                            <div className="flex items-center gap-1 text-purple-400">
                              <SlackIcon className="w-3 h-3" />
                              Slack
                            </div>
                          )}

                          {automation.outputs.some(o => o.type === 'github_comment' && o.enabled) && (
                            <div className="flex items-center gap-1 text-gray-400">
                              <Github className="w-3 h-3" />
                              PR Comment
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRunAutomation(automation.id)}
                          disabled={runningAutomationId === automation.id}
                          className="p-2 hover:bg-green-500/10 text-green-500 rounded-lg transition-colors disabled:opacity-50"
                          title="Run now"
                        >
                          {runningAutomationId === automation.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleAutomation(automation)}
                          className={`p-2 rounded-lg transition-colors ${
                            automation.enabled
                              ? 'hover:bg-yellow-500/10 text-yellow-500'
                              : 'hover:bg-green-500/10 text-green-500'
                          }`}
                          title={automation.enabled ? 'Pause' : 'Resume'}
                        >
                          {automation.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleViewLogs(automation)}
                          className="p-2 hover:bg-secondary rounded-lg transition-colors"
                          title="View logs"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAutomation(automation.id)}
                          className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Create Automation Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">Create Automation</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="PR Marketing Tweets"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Generate marketing tweets for new PRs"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  />
                </div>

                {/* Source Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Source</label>
                  <select
                    value={formData.sourceType}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as Automation['source']['type'] })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  >
                    <option value="github">GitHub</option>
                    <option value="jira" disabled>JIRA (coming soon)</option>
                    <option value="pipedrive" disabled>Pipedrive (coming soon)</option>
                  </select>
                </div>

                {/* GitHub-specific config */}
                {formData.sourceType === 'github' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Repositories *</label>
                      <input
                        type="text"
                        value={formData.repos}
                        onChange={(e) => setFormData({ ...formData, repos: e.target.value })}
                        placeholder="owner/repo1, owner/repo2"
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated list of repositories to poll
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Poll for</label>
                      <div className="flex flex-wrap gap-3">
                        {['pull_requests', 'issues', 'releases'].map(type => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.pollFor.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, pollFor: [...formData.pollFor, type] });
                                } else {
                                  setFormData({ ...formData, pollFor: formData.pollFor.filter(t => t !== type) });
                                }
                              }}
                              className="w-4 h-4 rounded border-border"
                            />
                            <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-medium mb-2">Poll Interval</label>
                  <select
                    value={formData.scheduleMinutes}
                    onChange={(e) => setFormData({ ...formData, scheduleMinutes: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  >
                    {SCHEDULE_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </div>

                {/* Agent Config */}
                <div className="border-t border-border pt-4">
                  <label className="flex items-center gap-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={formData.agentEnabled}
                      onChange={(e) => setFormData({ ...formData, agentEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Enable Claude Agent</span>
                      <p className="text-xs text-muted-foreground">Process items with a Claude agent</p>
                    </div>
                  </label>

                  {formData.agentEnabled && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Agent Prompt *</label>
                        <textarea
                          value={formData.agentPrompt}
                          onChange={(e) => setFormData({ ...formData, agentPrompt: e.target.value })}
                          placeholder={`Read the PR #{{number}} "{{title}}" and write a marketing tweet about the features.

Use: gh pr view {{number}} --repo {{repo}}

Post the tweet as a comment.`}
                          rows={5}
                          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Variables: {'{{number}}'}, {'{{title}}'}, {'{{repo}}'}, {'{{author}}'}, {'{{url}}'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Project Path (optional)</label>
                        <input
                          type="text"
                          value={formData.projectPath}
                          onChange={(e) => setFormData({ ...formData, projectPath: e.target.value })}
                          placeholder="/path/to/project"
                          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Outputs */}
                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium mb-3">Send Output To</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.outputTelegram}
                        onChange={(e) => setFormData({ ...formData, outputTelegram: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <Send className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">Telegram</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.outputSlack}
                        onChange={(e) => setFormData({ ...formData, outputSlack: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <SlackIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-sm">Slack</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.outputGitHubComment}
                        onChange={(e) => setFormData({ ...formData, outputGitHubComment: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <Github className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">PR Comment</span>
                    </label>
                  </div>
                </div>

                {createError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">{createError}</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAutomation}
                  disabled={isCreating || !formData.name || !formData.repos || (formData.agentEnabled && !formData.agentPrompt)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Automation
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedLogs(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold">Logs: {selectedLogs.automation.name}</h2>
                <button
                  onClick={() => setSelectedLogs(null)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[#0a0a0f]">
                {selectedLogs.runs.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No runs yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLogs.runs.map((run) => (
                      <div key={run.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {run.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                          {run.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                          {run.status === 'running' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                          <span className="text-sm font-medium">{run.status}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Items: {run.itemsProcessed}/{run.itemsFound} processed
                          {run.error && (
                            <p className="text-red-400 mt-1">Error: {run.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
