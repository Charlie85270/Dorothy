import type { AgentCharacter } from '@/types/electron';
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
    skipPermissions?: boolean
  ) => void;
  projects: Project[];
  onBrowseFolder?: () => Promise<string | null>;
  installedSkills?: string[];
  allInstalledSkills?: ClaudeSkill[];
  onRefreshSkills?: () => void;
  initialProjectPath?: string;
  initialStep?: number;
}
