import { memo } from 'react';
import dynamic from 'next/dynamic';
import {
  GitBranch,
  Code2,
  TerminalSquare,
  Layers,
  Settings2,
  Loader2,
  X,
  Check,
  Zap,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import type { PanelType } from './AgentDialogTypes';
import { AgentDialogPanelHeader } from './AgentDialogPanelHeader';
import { AgentDialogSecondaryProject } from './AgentDialogSecondaryProject';

const GitPanel = dynamic(() => import('./GitPanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
    </div>
  ),
});

const CodePanel = dynamic(() => import('./CodePanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
    </div>
  ),
});

interface AgentDialogSidebarProps {
  agent: AgentStatus;
  projectPath: string;
  expandedPanels: Set<PanelType>;
  onTogglePanel: (panel: PanelType) => void;
  // Git
  gitBranch: string;
  onGitBranchChange: (branch: string) => void;
  // Shell
  quickTerminalRef: React.RefObject<HTMLDivElement | null>;
  quickXtermRef: React.RefObject<import('xterm').Terminal | null>;
  quickTerminalReady: boolean;
  hasActiveTerminal: boolean;
  onCloseQuickTerminal: () => void;
  // Context
  hasSecondaryProject: boolean;
  availableProjects: { path: string; name: string }[];
  customSecondaryPath: string;
  onCustomSecondaryPathChange: (value: string) => void;
  onSetSecondaryProject: (path: string | null) => void;
  onBrowseFolder?: () => Promise<string | null>;
  // Settings
  editSkipPermissions: boolean;
  isSavingSettings: boolean;
  onSaveSkipPermissions: (value: boolean) => void;
}

function AccordionPanel({
  expanded,
  height,
  children,
}: {
  expanded: boolean;
  height: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        <div className={height}>{children}</div>
      </div>
    </div>
  );
}

export const AgentDialogSidebar = memo(function AgentDialogSidebar({
  agent,
  projectPath,
  expandedPanels,
  onTogglePanel,
  gitBranch,
  onGitBranchChange,
  quickTerminalRef,
  quickXtermRef,
  quickTerminalReady,
  hasActiveTerminal,
  onCloseQuickTerminal,
  hasSecondaryProject,
  availableProjects,
  customSecondaryPath,
  onCustomSecondaryPathChange,
  onSetSecondaryProject,
  onBrowseFolder,
  editSkipPermissions,
  isSavingSettings,
  onSaveSkipPermissions,
}: AgentDialogSidebarProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Code */}
      <div className="border-b border-border-primary">
        <AgentDialogPanelHeader
          icon={Code2}
          title="Code"
          color="text-purple-400"
          isExpanded={expandedPanels.has('code')}
          onToggle={() => onTogglePanel('code')}
        />
        <AccordionPanel expanded={expandedPanels.has('code')} height="h-[250px]">
          <CodePanel projectPath={projectPath} className="h-full" />
        </AccordionPanel>
      </div>

      {/* Git */}
      <div className="border-b border-border-primary">
        <AgentDialogPanelHeader
          icon={GitBranch}
          title="Git"
          color="text-orange-400"
          isExpanded={expandedPanels.has('git')}
          badge={
            gitBranch ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono">
                {gitBranch}
              </span>
            ) : null
          }
          onToggle={() => onTogglePanel('git')}
        />
        <AccordionPanel expanded={expandedPanels.has('git')} height="h-[200px]">
          <GitPanel projectPath={projectPath} className="h-full" hideHeader onBranchChange={onGitBranchChange} />
        </AccordionPanel>
      </div>

      {/* Shell */}
      <div className="border-b border-border-primary">
        <AgentDialogPanelHeader
          icon={TerminalSquare}
          title="Shell"
          color="text-cyan-400"
          isExpanded={expandedPanels.has('terminal')}
          badge={
            hasActiveTerminal && !expandedPanels.has('terminal') ? (
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            ) : null
          }
          onToggle={() => onTogglePanel('terminal')}
        />
        <AccordionPanel expanded={expandedPanels.has('terminal')} height="h-[180px] relative">
          <div className="absolute top-1 right-1 z-10">
            <button
              onClick={onCloseQuickTerminal}
              className="p-1 hover:bg-bg-tertiary rounded text-text-muted hover:text-accent-red transition-colors"
              title="Close terminal (kills process)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div
            ref={quickTerminalRef}
            className="absolute inset-0 bg-[#0f0f1a] p-1"
            style={{ cursor: 'text' }}
            onClick={() => quickXtermRef.current?.focus()}
          />
          {!quickTerminalReady && expandedPanels.has('terminal') && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          )}
        </AccordionPanel>
      </div>

      {/* Context */}
      <div className="border-b border-border-primary">
        <AgentDialogPanelHeader
          icon={Layers}
          title="Context"
          color="text-amber-400"
          isExpanded={expandedPanels.has('context')}
          badge={
            hasSecondaryProject ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">+1</span>
            ) : null
          }
          onToggle={() => onTogglePanel('context')}
        />
        <AccordionPanel expanded={expandedPanels.has('context')} height="">
          <AgentDialogSecondaryProject
            agent={agent}
            availableProjects={availableProjects}
            customSecondaryPath={customSecondaryPath}
            onCustomPathChange={onCustomSecondaryPathChange}
            onSetSecondaryProject={onSetSecondaryProject}
            onBrowseFolder={onBrowseFolder}
          />
        </AccordionPanel>
      </div>

      {/* Settings */}
      <div className="border-b border-border-primary">
        <AgentDialogPanelHeader
          icon={Settings2}
          title="Settings"
          color="text-zinc-400"
          isExpanded={expandedPanels.has('settings')}
          badge={
            agent.skipPermissions ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Auto</span>
            ) : null
          }
          onToggle={() => onTogglePanel('settings')}
        />
        <AccordionPanel expanded={expandedPanels.has('settings')} height="">
          <div className="p-3 space-y-4">
            <div className="p-3 rounded-none border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => onSaveSkipPermissions(!editSkipPermissions)}
                  disabled={isSavingSettings}
                  className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
                    editSkipPermissions ? 'bg-amber-500 border-amber-500' : 'border-amber-500/50 hover:border-amber-500'
                  } ${isSavingSettings ? 'opacity-50' : ''}`}
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  ) : editSkipPermissions ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : null}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-sm">Skip Permissions</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Run without asking for permission on each action. Changes take effect on next task.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Skills:</span>
                <span>{agent.skills.length > 0 ? agent.skills.join(', ') : 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Character:</span>
                <span>{agent.character || 'robot'}</span>
              </div>
              {agent.branchName && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Branch:</span>
                  <span className="font-mono text-accent-purple">{agent.branchName}</span>
                </div>
              )}
            </div>
          </div>
        </AccordionPanel>
      </div>
    </div>
  );
});
