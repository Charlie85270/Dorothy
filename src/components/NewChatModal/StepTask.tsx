import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Check,
  Zap,
  GitBranch,
  GitFork,
  ChevronDown,
  ChevronRight,
  Settings2,
  FolderOpen,
  Sparkles,
  BookOpen,
  Shield,
  ShieldOff,
  Bot,
  Gauge,
} from 'lucide-react';
import type { AgentProvider } from '@/types/electron';
import type { AgentPermissionMode, AgentEffort } from '@/types/agent';
import OrchestratorModeToggle from './OrchestratorModeToggle';

interface StepTaskProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  selectedSkills: string[];
  useWorktree: boolean;
  onToggleWorktree: () => void;
  branchName: string;
  onBranchNameChange: (name: string) => void;
  permissionMode: AgentPermissionMode;
  onPermissionModeChange: (mode: AgentPermissionMode) => void;
  effort: AgentEffort;
  onEffortChange: (effort: AgentEffort) => void;
  isOrchestrator: boolean;
  onOrchestratorToggle: (enabled: boolean) => void;
  // Summary data
  projectPath: string;
  provider: AgentProvider;
  model: string;
  selectedObsidianVaults: string[];
}

const PERMISSION_MODES: { value: AgentPermissionMode; label: string; description: string; icon: React.ReactNode; iconColor: string; accent: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Asks before each tool',    icon: <Shield className="w-5 h-5 mx-auto mb-1" />,    iconColor: 'text-accent-blue',  accent: 'border-accent-blue bg-accent-blue/10' },
  { value: 'auto',   label: 'Auto',   description: 'Autonomous — recommended', icon: <Bot className="w-5 h-5 mx-auto mb-1" />,        iconColor: 'text-amber-400',    accent: 'border-amber-400 bg-amber-400/10' },
  { value: 'bypass', label: 'Bypass', description: 'Skips all restrictions',   icon: <ShieldOff className="w-5 h-5 mx-auto mb-1" />, iconColor: 'text-red-400',      accent: 'border-red-400 bg-red-400/10' },
];

const EFFORT_LEVELS: { value: AgentEffort; label: string; description: string }[] = [
  { value: 'low',    label: 'Low',    description: 'Fast, minimal' },
  { value: 'medium', label: 'Medium', description: 'Balanced (default)' },
  { value: 'high',   label: 'High',   description: 'Extended reasoning' },
];

const StepTask = React.memo(function StepTask({
  prompt,
  onPromptChange,
  selectedSkills,
  useWorktree,
  onToggleWorktree,
  branchName,
  onBranchNameChange,
  permissionMode,
  onPermissionModeChange,
  effort,
  onEffortChange,
  isOrchestrator,
  onOrchestratorToggle,
  projectPath,
  provider,
  model,
  selectedObsidianVaults,
}: StepTaskProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-green" />
          Define Task
        </h3>
        <p className="text-text-secondary text-sm">
          Describe the task or leave empty to start an interactive session
        </p>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-2">
          What should this agent do?
          <span className="text-text-muted font-normal ml-1">(optional)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the task, or leave empty to start an interactive session"
          rows={4}
          className="w-full px-4 py-3 rounded-lg text-sm resize-none"
        />
        {selectedSkills.length > 0 && !prompt && (
          <p className="text-xs text-accent-purple mt-2">
            Agent will start with selected skills: {selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? ` +${selectedSkills.length - 3} more` : ''}
          </p>
        )}
      </div>

      {/* Advanced Options (collapsible) */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setShowAdvanced(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary/80 transition-colors"
        >
          <span className="font-medium text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-text-muted" />
            Advanced Options
          </span>
          {showAdvanced ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Permission Mode */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="w-4 h-4 text-text-muted" />
                    Permission Mode
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {PERMISSION_MODES.map(({ value, label, description, icon, iconColor, accent }) => (
                      <button
                        key={value}
                        onClick={() => onPermissionModeChange(value)}
                        className={`p-3 rounded-lg border transition-all text-center
                          ${permissionMode === value
                            ? accent
                            : 'border-border-primary hover:border-border-accent'
                          }`}
                      >
                        <span className={permissionMode === value ? iconColor : 'text-text-muted'}>{icon}</span>
                        <span className="font-medium block">{label}</span>
                        <p className="text-xs text-text-muted mt-0.5">{description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Effort Level */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="w-4 h-4 text-text-muted" />
                    Effort
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {EFFORT_LEVELS.map(({ value, label, description }) => (
                      <button
                        key={value}
                        onClick={() => onEffortChange(value)}
                        className={`p-3 rounded-lg border transition-all text-center
                          ${effort === value
                            ? 'border-accent-blue bg-accent-blue/10'
                            : 'border-border-primary hover:border-border-accent'
                          }`}
                      >
                        <Gauge className={`w-5 h-5 mx-auto mb-1 ${effort === value ? 'text-accent-blue' : 'text-text-muted'}`} />
                        <span className="font-medium block">{label}</span>
                        <p className="text-xs text-text-muted mt-0.5">{description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Git Worktree Option */}
                <div className="p-3 rounded-lg border border-border-primary bg-bg-tertiary/30">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={onToggleWorktree}
                      className={`
                        mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
                        ${useWorktree
                          ? 'bg-accent-purple border-accent-purple'
                          : 'border-border-primary hover:border-accent-purple'
                        }
                      `}
                    >
                      {useWorktree && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <GitFork className="w-4 h-4 text-accent-purple" />
                        <span className="font-medium text-sm">Use Git Worktree</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Create an isolated branch for this agent
                      </p>

                      <AnimatePresence>
                        {useWorktree && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border-primary">
                              <label className="block text-xs font-medium mb-2 flex items-center gap-2">
                                <GitBranch className="w-3.5 h-3.5 text-accent-blue" />
                                Branch Name
                              </label>
                              <input
                                type="text"
                                value={branchName}
                                onChange={(e) => onBranchNameChange(e.target.value.replace(/\s+/g, '-'))}
                                placeholder="feature/my-task"
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-bg-primary border border-border-primary focus:border-accent-blue focus:outline-none"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Orchestrator Mode */}
                <OrchestratorModeToggle
                  isOrchestrator={isOrchestrator}
                  onToggle={onOrchestratorToggle}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Card */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Summary</span>
        <div className="space-y-1.5">
          <SummaryRow icon={<FolderOpen className="w-3.5 h-3.5" />} label="Project" value={projectPath.split('/').pop() || projectPath} />
          <SummaryRow icon={<Sparkles className="w-3.5 h-3.5" />} label="Model" value={`${provider} / ${model}`} />
          {selectedSkills.length > 0 && (
            <SummaryRow icon={<Zap className="w-3.5 h-3.5" />} label="Skills" value={`${selectedSkills.length} selected`} />
          )}
          {selectedObsidianVaults.length > 0 && (
            <SummaryRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Vaults" value={`${selectedObsidianVaults.length + 1} sources`} />
          )}
          {useWorktree && branchName && (
            <SummaryRow icon={<GitBranch className="w-3.5 h-3.5" />} label="Branch" value={branchName} mono />
          )}
        </div>
      </div>
    </div>
  );
});

function SummaryRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`truncate max-w-[200px] ${mono ? 'font-mono text-accent-purple' : ''}`}>{value}</span>
    </div>
  );
}

export default StepTask;
