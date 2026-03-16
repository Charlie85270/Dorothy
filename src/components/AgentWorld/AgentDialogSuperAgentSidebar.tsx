import { memo } from 'react';
import { Users, Folder, Crown, AlertTriangle, Circle } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { CHARACTER_FACES } from './constants';
import { isSuperAgent } from './AgentDialogTypes';

interface AgentDialogSuperAgentSidebarProps {
  agents: AgentStatus[];
  projects: { path: string; name: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-accent-cyan',
  completed: 'text-accent-green',
  error: 'text-accent-red',
};

const STATUS_BG_COLOR: Record<string, string> = {
  running: 'bg-accent-cyan/20',
  completed: 'bg-accent-green/20',
  error: 'bg-accent-red/20',
};

export const AgentDialogSuperAgentSidebar = memo(function AgentDialogSuperAgentSidebar({
  agents,
  projects,
}: AgentDialogSuperAgentSidebarProps) {
  const otherAgents = agents.filter(a => !isSuperAgent(a));
  const runningAgents = otherAgents.filter(a => a.status === 'running');
  const idleAgents = otherAgents.filter(a => a.status === 'idle' || a.status === 'completed');
  const errorAgents = otherAgents.filter(a => a.status === 'error');

  const face = (agent: AgentStatus) =>
    CHARACTER_FACES[agent.character as keyof typeof CHARACTER_FACES] || '🤖';

  return (
    <div className="h-full overflow-y-auto">
      {/* Agents Section */}
      <div className="border-b border-border-primary">
        <div className="px-3 py-2.5 flex items-center gap-2 bg-bg-tertiary/30">
          <Users className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm font-medium">Agents</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">
            {otherAgents.length}
          </span>
        </div>
        <div className="p-3 space-y-3">
          {runningAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-accent-cyan mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Circle className="w-2 h-2 fill-accent-cyan animate-pulse" />
                Running ({runningAgents.length})
              </p>
              <div className="space-y-1">
                {runningAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-accent-cyan/10 border border-accent-cyan/20">
                    <span className="text-lg">{face(agent)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {agent.currentTask?.slice(0, 40) || agent.projectPath.split('/').pop()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-accent-red mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Error ({errorAgents.length})
              </p>
              <div className="space-y-1">
                {errorAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-accent-red/10 border border-accent-red/20">
                    <span className="text-lg">{face(agent)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">{agent.projectPath.split('/').pop()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {idleAgents.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wide">
                Idle ({idleAgents.length})
              </p>
              <div className="space-y-1">
                {idleAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded-none hover:bg-bg-tertiary/50">
                    <span className="text-lg opacity-60">{face(agent)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-secondary truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">{agent.projectPath.split('/').pop()}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BG_COLOR[agent.status] || 'bg-text-muted/20'} ${STATUS_COLOR[agent.status] || 'text-text-muted'}`}>
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherAgents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No agents created yet</p>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="border-b border-border-primary">
        <div className="px-3 py-2.5 flex items-center gap-2 bg-bg-tertiary/30">
          <Folder className="w-4 h-4 text-accent-purple" />
          <span className="text-sm font-medium">Projects</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
            {projects.length}
          </span>
        </div>
        <div className="p-3">
          {projects.length > 0 ? (
            <div className="space-y-1">
              {projects.map((project) => {
                const projectAgents = otherAgents.filter(
                  a => a.projectPath === project.path || a.worktreePath?.startsWith(project.path)
                );
                const runningCount = projectAgents.filter(a => a.status === 'running').length;
                return (
                  <div key={project.path} className="flex items-center gap-2 px-2 py-1.5 rounded-none hover:bg-bg-tertiary/50">
                    <Folder className="w-4 h-4 text-accent-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{project.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate">
                        {project.path.split('/').slice(-2).join('/')}
                      </p>
                    </div>
                    {projectAgents.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                          {projectAgents.length} agent{projectAgents.length !== 1 ? 's' : ''}
                        </span>
                        {runningCount > 0 && <span className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">No projects added yet</p>
          )}
        </div>
      </div>

      {/* Orchestrator info */}
      <div className="p-3">
        <div className="p-3 rounded-none border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-400">Orchestrator Mode</p>
              <p className="text-[10px] text-text-muted mt-1">
                Use MCP tools to manage agents: create_agent, start_agent, stop_agent, list_agents, send_prompt
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
