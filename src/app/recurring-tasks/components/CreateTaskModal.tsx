import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2, AlertCircle } from 'lucide-react';
import type { Agent } from '../types';
import { ScheduleFieldPicker } from './ScheduleFieldPicker';
import { TaskOptionsFields } from './TaskOptionsFields';
import { NotificationFields } from './NotificationFields';
import { PROVIDER_REGISTRY } from '@/lib/providers';

interface CreateTaskModalProps {
  show: boolean;
  onClose: () => void;
  agents: Agent[];
  formData: {
    agentId: string;
    projectPath: string;
    title: string;
    prompt: string;
    schedulePreset: string;
    customCron: string;
    time: string;
    days: string[];
    intervalDays: number;
    selectedDays: string[];
    autonomous: boolean;
    useWorktree: boolean;
    notifyTelegram: boolean;
    notifySlack: boolean;
    provider: string;
    skills: string[];
  };
  onFormChange: (data: CreateTaskModalProps['formData']) => void;
  isCreating: boolean;
  createError: string | null;
  onSubmit: () => void;
  availableSkills?: string[];
  defaultProvider?: string;
}

export function CreateTaskModal({
  show,
  onClose,
  agents,
  formData,
  onFormChange,
  isCreating,
  createError,
  onSubmit,
  availableSkills = [],
  defaultProvider = 'claude',
}: CreateTaskModalProps) {
  // Initialize provider to defaultProvider on first render if still at default
  const effectiveProvider = formData.provider || defaultProvider;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Scheduled Task</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                  placeholder="e.g. Daily code review"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                  autoFocus
                />
              </div>

              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Agent (optional)</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => {
                    const selectedAgent = agents.find(a => a.id === e.target.value);
                    onFormChange({
                      ...formData,
                      agentId: e.target.value,
                      projectPath: selectedAgent?.projectPath || formData.projectPath,
                    });
                  }}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                >
                  <option value="">No agent (use project path below)</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id} - {agent.projectPath.split('/').pop()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Path */}
              {!formData.agentId && (
                <div>
                  <label className="block text-sm font-medium mb-2">Project Path</label>
                  <input
                    type="text"
                    value={formData.projectPath}
                    onChange={(e) => onFormChange({ ...formData, projectPath: e.target.value })}
                    placeholder="/path/to/your/project"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                  />
                </div>
              )}

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium mb-2">Task Prompt</label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => onFormChange({ ...formData, prompt: e.target.value })}
                  placeholder="What should Claude do?"
                  rows={4}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg resize-none"
                />
              </div>

              {/* Schedule */}
              <ScheduleFieldPicker
                value={{
                  schedulePreset: formData.schedulePreset,
                  customCron: formData.customCron,
                  time: formData.time,
                  intervalDays: formData.intervalDays,
                  selectedDays: formData.selectedDays,
                }}
                onChange={(fields) => onFormChange({ ...formData, ...fields })}
              />

              {/* Options */}
              <TaskOptionsFields
                autonomous={formData.autonomous}
                onAutonomousChange={(v) => onFormChange({ ...formData, autonomous: v })}
                useWorktree={formData.useWorktree}
                onWorktreeChange={(v) => onFormChange({ ...formData, useWorktree: v })}
              />

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium mb-2">Provider</label>
                <select
                  value={effectiveProvider}
                  onChange={(e) => onFormChange({ ...formData, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                >
                  {PROVIDER_REGISTRY.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Skills */}
              {availableSkills.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Skills
                    <span className="ml-1 text-xs text-muted-foreground font-normal">({formData.skills.length} selected)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-secondary border border-border rounded-lg">
                    {availableSkills.map(skill => {
                      const selected = formData.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? formData.skills.filter(s => s !== skill)
                              : [...formData.skills, skill];
                            onFormChange({ ...formData, skills: next });
                          }}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-bg-tertiary text-muted-foreground hover:bg-secondary/80'
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notifications */}
              <NotificationFields
                notifyTelegram={formData.notifyTelegram}
                onTelegramChange={(v) => onFormChange({ ...formData, notifyTelegram: v })}
                notifySlack={formData.notifySlack}
                onSlackChange={(v) => onFormChange({ ...formData, notifySlack: v })}
              />

              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-500">{createError}</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={isCreating || !formData.prompt || (!formData.agentId && !formData.projectPath)}
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
                    Create Task
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
