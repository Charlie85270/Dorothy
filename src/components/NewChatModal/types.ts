import type { AgentCharacter, AgentProvider } from '@/types/electron';
import type { AgentPermissionMode, AgentEffort } from '@/types/agent';
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
  /** @deprecated use permissionMode instead */
  skipPermissions?: boolean;
  permissionMode?: AgentPermissionMode;
  effort?: AgentEffort;
  provider?: AgentProvider;
  model?: string;
  localModel?: string;
  branchName?: string;
  obsidianVaultPaths?: string[];
  savedPrompt?: string;
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
    permissionMode?: AgentPermissionMode,
    provider?: AgentProvider,
    localModel?: string,
    obsidianVaultPaths?: string[],
    effort?: AgentEffort,
  ) => void;
  onUpdate?: (id: string, updates: {
    skills?: string[];
    secondaryProjectPath?: string | null;
    permissionMode?: AgentPermissionMode;
    effort?: AgentEffort;
    name?: string;
    character?: AgentCharacter;
    model?: string | null;
    provider?: AgentProvider;
    localModel?: string | null;
    savedPrompt?: string | null;
    obsidianVaultPaths?: string[];
    worktree?: WorktreeConfig;
  }) => void;
  editAgent?: EditAgentData | null;
  projects: Project[];
  onBrowseFolder?: () => Promise<string | null>;
  installedSkills?: string[];
  allInstalledSkills?: ClaudeSkill[];
  onRefreshSkills?: () => void;
  initialProjectPath?: string;
  initialStep?: number;
  initialOrchestrator?: boolean;
}
