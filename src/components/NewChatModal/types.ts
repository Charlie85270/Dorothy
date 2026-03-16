import type { AgentCharacter, AgentProvider } from '@/types/electron';
import type { ClaudeSkill } from '@/lib/claude-code';

export interface AgentPersonaValues {
  character: AgentCharacter;
  name: string;
}

export interface Project {
  path: string;
  name: string;
}

export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export interface EditAgentData {
  id: string;
  name?: string;
  character?: AgentCharacter;
  projectPath: string;
  secondaryProjectPath?: string;
  skills: string[];
  skipPermissions?: boolean;
  provider?: AgentProvider;
  localModel?: string;
  branchName?: string;
  obsidianVaultPaths?: string[];
}

export interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: WorktreeConfig,
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean,
    provider?: AgentProvider,
    localModel?: string,
    obsidianVaultPaths?: string[],
  ) => void;
  onUpdate?: (id: string, updates: {
    skills?: string[];
    secondaryProjectPath?: string | null;
    skipPermissions?: boolean;
    name?: string;
    character?: AgentCharacter;
  }) => void;
  editAgent?: EditAgentData | null;
  projects: Project[];
  onBrowseFolder?: () => Promise<string | null>;
  installedSkills?: string[];
  allInstalledSkills?: ClaudeSkill[];
  onRefreshSkills?: () => void;
  initialProjectPath?: string;
  initialStep?: number;
}
