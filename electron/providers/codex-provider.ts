import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { AppSettings } from '../types';
import type {
  CLIProvider,
  InteractiveCommandParams,
  ScheduledCommandParams,
  OneShotCommandParams,
  ProviderModel,
  HookConfig,
} from './cli-provider';

export class CodexProvider implements CLIProvider {
  readonly id = 'codex' as const;
  readonly displayName = 'Codex CLI';
  readonly binaryName = 'codex';
  readonly configDir = path.join(os.homedir(), '.codex');

  getModels(): ProviderModel[] {
    return [
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Recommended' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Balanced' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Previous gen' },
      { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', description: 'Fast & efficient' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.codex || 'codex';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = params.binaryPath;

    // Model
    if (params.model) {
      if (!/^[a-zA-Z0-9._:/-]+$/.test(params.model)) {
        throw new Error('Invalid model name');
      }
      command += ` --model '${params.model}'`;
    }

    // Skip permissions (Codex uses --full-auto)
    if (params.skipPermissions) {
      command += ' --full-auto';
    }

    // Secondary project
    if (params.secondaryProjectPath) {
      const escaped = params.secondaryProjectPath.replace(/'/g, "'\\''");
      command += ` --add-dir '${escaped}'`;
    }

    // Prompt with skills directive
    let finalPrompt = params.prompt;
    if (params.skills && params.skills.length > 0 && !params.isSuperAgent) {
      const skillsList = params.skills.join(', ');
      finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${params.prompt}`;
    }

    if (finalPrompt) {
      const escaped = finalPrompt.replace(/'/g, "'\\''");
      command += ` '${escaped}'`;
    }

    return command;
  }

  buildScheduledCommand(params: ScheduledCommandParams): string {
    let command = `"${params.binaryPath}"`;

    if (params.autonomous) {
      command += ' --full-auto';
    }

    if (params.outputFormat) {
      command += ' --json';
    }

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` exec '${escaped}'`;

    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = params.binaryPath;

    if (params.model) {
      command += ` --model ${params.model}`;
    }

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` exec '${escaped}'`;

    return command;
  }

  getPtyEnvVars(agentId: string, projectPath: string, skills: string[]): Record<string, string> {
    return {
      DOROTHY_SKILLS: skills.join(','),
      DOROTHY_AGENT_ID: agentId,
      DOROTHY_PROJECT_PATH: projectPath,
    };
  }

  getEnvVarsToDelete(): string[] {
    // Codex doesn't have a known nested session env var yet
    return [];
  }

  getHookConfig(): HookConfig {
    return {
      supportsNativeHooks: false,
      configDir: this.configDir,
      settingsFile: path.join(this.configDir, 'config.toml'),
    };
  }

  async configureHooks(_hooksDir: string): Promise<void> {
    // Codex CLI has minimal hook support (exit-code based status only).
    // No hook configuration needed.
    console.log('Codex CLI: hooks not supported, using exit-code based status detection');
  }

  async registerMcpServer(name: string, command: string, args: string[]): Promise<void> {
    const configPath = path.join(this.configDir, 'config.toml');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    let content = '';
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf-8');
    }

    // Remove existing section if present
    content = this.removeTomlSection(content, name);

    // Append new section
    const sectionKey = this.escapeTomlKey(name);
    const argsToml = args.map(a => `"${a}"`).join(', ');
    const section = `\n[mcp_servers.${sectionKey}]\ncommand = "${command}"\nargs = [${argsToml}]\n`;

    content = content.trimEnd() + '\n' + section;
    fs.writeFileSync(configPath, content);
    console.log(`[codex] Registered MCP server ${name} in config.toml`);
  }

  async removeMcpServer(name: string): Promise<void> {
    const configPath = path.join(this.configDir, 'config.toml');
    if (!fs.existsSync(configPath)) return;

    const content = fs.readFileSync(configPath, 'utf-8');
    const updated = this.removeTomlSection(content, name);
    if (updated !== content) {
      fs.writeFileSync(configPath, updated);
      console.log(`[codex] Removed MCP server ${name} from config.toml`);
    }
  }

  isMcpServerRegistered(name: string, expectedServerPath: string): boolean {
    const configPath = path.join(this.configDir, 'config.toml');
    if (!fs.existsSync(configPath)) return false;
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const sectionKey = this.escapeTomlKey(name);
      const headerRegex = new RegExp(`\\[mcp_servers\\.${sectionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);
      if (!headerRegex.test(content)) return false;
      return content.includes(expectedServerPath);
    } catch {
      return false;
    }
  }

  private removeTomlSection(content: string, name: string): string {
    const sectionKey = this.escapeTomlKey(name);
    const escapedKey = sectionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\n?\\[mcp_servers\\.${escapedKey}\\][^\\[]*`, 'g');
    return content.replace(regex, '');
  }

  private escapeTomlKey(key: string): string {
    // TOML keys with dots or special chars need quoting
    if (/[^a-zA-Z0-9_-]/.test(key)) {
      return `"${key}"`;
    }
    return key;
  }

  getMcpConfigStrategy(): 'flag' | 'config-file' {
    return 'config-file';
  }

  getSkillDirectories(): string[] {
    return [path.join(os.homedir(), '.agents', 'skills')];
  }

  getInstalledSkills(): string[] {
    const skills: string[] = [];
    for (const dir of this.getSkillDirectories()) {
      if (fs.existsSync(dir)) {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() || entry.isSymbolicLink()) {
              skills.push(entry.name);
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
    return skills;
  }

  supportsSkills(): boolean {
    return true;
  }

  getMemoryBasePath(): string {
    // Codex may not have a memory system; return config dir as placeholder
    return this.configDir;
  }

  getAddDirFlag(): string {
    return '--add-dir';
  }

  buildScheduledScript(params: {
    binaryPath: string;
    binaryDir: string;
    projectPath: string;
    prompt: string;
    autonomous: boolean;
    mcpConfigPath: string;
    logPath: string;
    homeDir: string;
  }): string {
    const flags = params.autonomous ? '--full-auto' : '';

    return `#!/bin/bash

# Source shell profile for proper PATH (nvm, homebrew, etc.)
export HOME="${params.homeDir}"

if [ -s "${params.homeDir}/.nvm/nvm.sh" ]; then
  source "${params.homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ -f "${params.homeDir}/.bashrc" ]; then
  source "${params.homeDir}/.bashrc" 2>/dev/null || true
elif [ -f "${params.homeDir}/.bash_profile" ]; then
  source "${params.homeDir}/.bash_profile" 2>/dev/null || true
elif [ -f "${params.homeDir}/.zshrc" ]; then
  source "${params.homeDir}/.zshrc" 2>/dev/null || true
fi

export PATH="${params.binaryDir}:$PATH"
cd "${params.projectPath}"
echo "=== Task started at $(date) ===" >> "${params.logPath}"
"${params.binaryPath}" ${flags} --json exec '${params.prompt}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
