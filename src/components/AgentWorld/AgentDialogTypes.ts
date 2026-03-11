import type { AgentStatus } from '@/types/electron';

export type PanelType = 'code' | 'git' | 'terminal' | 'context' | 'settings';

export interface AgentTerminalDialogProps {
  agent: AgentStatus | null;
  open: boolean;
  onClose: () => void;
  onStart: (agentId: string, prompt: string) => void;
  onStop: (agentId: string) => void;
  projects?: { path: string; name: string }[];
  agents?: AgentStatus[];
  onBrowseFolder?: () => Promise<string | null>;
  onAgentUpdated?: (agent: AgentStatus) => void;
  onUpdateAgent?: (params: {
    id: string;
    skills?: string[];
    secondaryProjectPath?: string | null;
    skipPermissions?: boolean;
  }) => Promise<{ success: boolean; error?: string; agent?: AgentStatus }>;
  initialPanel?: PanelType;
  skipHistoricalOutput?: boolean;
}

export function isSuperAgent(agent: { name?: string } | null): boolean {
  if (!agent) return false;
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
}
