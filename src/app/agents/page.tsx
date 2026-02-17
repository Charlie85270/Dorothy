'use client';

import { useState, useRef, useCallback } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import { useClaude } from '@/hooks/useClaude';
import { useAgentFiltering } from '@/hooks/useAgentFiltering';
import { useSuperAgent } from '@/hooks/useSuperAgent';
import { useAgentTerminal } from '@/hooks/useAgentTerminal';
import type { AgentCharacter, AgentProvider } from '@/types/electron';
import NewChatModal from '@/components/NewChatModal';
import AgentTerminalDialog from '@/components/AgentWorld/AgentTerminalDialog';
import {
  DesktopRequiredMessage,
  EmptyAgentState,
  AgentListHeader,
  ProjectFilterTabs,
  AgentCard,
  AgentDetailPanel,
  StartPromptModal,
} from '@/components/AgentList';
import 'xterm/css/xterm.css';

export default function AgentsPage() {
  const {
    agents,
    isLoading: agentsLoading,
    isElectron: hasElectron,
    createAgent,
    startAgent,
    stopAgent,
    removeAgent,
  } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();
  const { data: claudeData } = useClaude();

  // Local state
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showStartPromptModal, setShowStartPromptModal] = useState(false);
  const [startPromptValue, setStartPromptValue] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { superAgent, isCreatingSuperAgent, handleSuperAgentClick } = useSuperAgent({
    agents,
    projects: projects.map(p => ({ path: p.path, name: p.name })),
    createAgent,
    startAgent,
    onAgentCreated: setSelectedAgent,
  });

  const { filteredAgents, uniqueProjects } = useAgentFiltering({
    agents,
    projectFilter,
  });

  const { terminalReady, clearTerminal } = useAgentTerminal({
    selectedAgentId: selectedAgent,
    terminalRef,
  });

  // Get selected agent data
  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  // Handle agent selection - auto-start idle agents
  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgent(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent && (agent.status === 'idle' || agent.status === 'completed' || agent.status === 'error') && !agent.pathMissing) {
      // Auto-start the claude session
      setTimeout(() => {
        startAgent(agentId, '');
      }, 100);
    }
  }, [agents, startAgent]);

  // Handlers
  const handleCreateAgent = useCallback(async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean,
    provider?: AgentProvider,
    localModel?: string,
  ) => {
    try {
      const agent = await createAgent({ projectPath, skills, worktree, character, name, secondaryProjectPath, skipPermissions, provider, localModel });
      setSelectedAgent(agent.id);
      setShowNewChatModal(false);

      if (prompt) {
        setTimeout(async () => {
          await startAgent(agent.id, prompt, { model: provider === 'local' ? undefined : model, provider, localModel });
        }, 600);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  }, [createAgent, startAgent]);

  const handleStartAgent = useCallback(async (agentId: string, prompt: string) => {
    clearTerminal();
    await startAgent(agentId, prompt);
  }, [clearTerminal, startAgent]);

  const handleRemoveAgent = useCallback((agentId: string) => {
    removeAgent(agentId);
    setSelectedAgent(null);
  }, [removeAgent]);

  const agentCountByProject = useCallback((path: string) => {
    return agents.filter(a => a.projectPath === path).length;
  }, [agents]);

  // Early returns
  if (!hasElectron && typeof window !== 'undefined') {
    return <DesktopRequiredMessage />;
  }

  if (agentsLoading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mx-auto mb-4" />
          <p className="text-text-secondary">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col pt-4 lg:pt-6">
      <AgentListHeader
        superAgent={superAgent}
        isCreatingSuperAgent={isCreatingSuperAgent}
        onSuperAgentClick={handleSuperAgentClick}
        onNewAgentClick={() => setShowNewChatModal(true)}
      />

      <ProjectFilterTabs
        uniqueProjects={uniqueProjects}
        projectFilter={projectFilter}
        totalAgentCount={agents.length}
        agentCountByProject={agentCountByProject}
        onFilterChange={setProjectFilter}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        {/* Agent List */}
        <div className="w-full lg:w-96 flex flex-col border border-border bg-card overflow-hidden lg:shrink-0 h-48 lg:h-auto">
          <div className="px-4 py-3 border-b border-border bg-secondary flex items-center !rounded-none justify-between">
            <span className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Bot className="w-4 h-4 text-muted-foreground" />
              Active Agents
            </span>
            <span className="text-xs text-muted-foreground">
              {agents.filter((a) => a.status === 'running').length} running
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div>
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent === agent.id}
                  onSelect={() => handleSelectAgent(agent.id)}
                  onEdit={() => setEditAgentId(agent.id)}
                />
              ))}
            </div>

            {filteredAgents.length === 0 && (
              <div className="p-8 text-center">
                <Bot className="w-10 h-10 mx-auto text-text-muted/30 mb-3" />
                <p className="text-text-muted text-sm">
                  {agents.length === 0 ? 'No agents running' : 'No agents for this project'}
                </p>
                {agents.length === 0 ? (
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-3 text-accent-blue text-sm hover:underline"
                  >
                    Create your first agent
                  </button>
                ) : (
                  <button
                    onClick={() => setProjectFilter(null)}
                    className="mt-3 text-accent-blue text-sm hover:underline"
                  >
                    View all agents
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agent Details / Live View */}
        <div className="flex-1 flex flex-col border border-border bg-card overflow-hidden">
          {selectedAgentData ? (
            <AgentDetailPanel
              agent={selectedAgentData}
              terminalRef={terminalRef}
              terminalReady={terminalReady}
              onStop={() => stopAgent(selectedAgentData.id)}
              onStart={() => {
                setStartPromptValue('');
                setShowStartPromptModal(true);
              }}
              onRemove={() => handleRemoveAgent(selectedAgentData.id)}
            />
          ) : (
            <EmptyAgentState onCreateAgent={() => setShowNewChatModal(true)} />
          )}
        </div>
      </div>

      {/* Modals */}
      <NewChatModal
        open={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onSubmit={handleCreateAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        allInstalledSkills={claudeData?.skills || []}
        onRefreshSkills={refreshSkills}
      />

      <StartPromptModal
        open={showStartPromptModal && !!selectedAgentData}
        onClose={() => setShowStartPromptModal(false)}
        onSubmit={(prompt) => {
          if (selectedAgentData) {
            handleStartAgent(selectedAgentData.id, prompt);
          }
        }}
        value={startPromptValue}
        onChange={setStartPromptValue}
      />

      <AgentTerminalDialog
        agent={editAgentId ? agents.find(a => a.id === editAgentId) || null : null}
        open={!!editAgentId}
        onClose={() => setEditAgentId(null)}
        onStart={handleStartAgent}
        onStop={stopAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        agents={agents}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        initialPanel="settings"
      />
    </div>
  );
}
