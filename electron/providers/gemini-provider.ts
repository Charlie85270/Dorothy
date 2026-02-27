import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import type { AppSettings } from '../types';
import type {
  CLIProvider,
  InteractiveCommandParams,
  ScheduledCommandParams,
  OneShotCommandParams,
  ProviderModel,
  HookConfig,
} from './cli-provider';

export class GeminiProvider implements CLIProvider {
  readonly id = 'gemini' as const;
  readonly displayName = 'Gemini CLI';
  readonly binaryName = 'gemini';
  readonly configDir = path.join(os.homedir(), '.gemini');

  getModels(): ProviderModel[] {
    return [
      { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Most capable' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Fast & capable' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.gemini || 'gemini';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = params.binaryPath;

    // Model (Gemini uses -m flag)
    if (params.model) {
      if (!/^[a-zA-Z0-9._:/-]+$/.test(params.model)) {
        throw new Error('Invalid model name');
      }
      command += ` -m '${params.model}'`;
    }

    // Debug mode (Gemini equivalent of verbose)
    if (params.verbose) {
      command += ' --debug';
    }

    // Gemini has no documented skip-permissions flag

    // Secondary project (Gemini uses --include-directories)
    if (params.secondaryProjectPath) {
      const escaped = params.secondaryProjectPath.replace(/'/g, "'\\''");
      command += ` --include-directories '${escaped}'`;
    }

    // Include Dorothy directory
    command += ` --include-directories '${os.homedir()}/.dorothy'`;

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

    // Gemini has no skip-permissions flag

    if (params.outputFormat) {
      command += ` --output-format ${params.outputFormat}`;
    }

    if (params.verbose) {
      command += ' --debug';
    }

    command += ` --include-directories "${os.homedir()}/.dorothy"`;

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` -p '${escaped}'`;

    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = params.binaryPath;

    command += ' -p';

    if (params.model) {
      command += ` -m ${params.model}`;
    }

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` '${escaped}'`;

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
    // Gemini doesn't have a known nested session env var
    return [];
  }

  getHookConfig(): HookConfig {
    return {
      supportsNativeHooks: true,
      configDir: this.configDir,
      settingsFile: path.join(this.configDir, 'settings.json'),
    };
  }

  async configureHooks(hooksDir: string): Promise<void> {
    const geminiHooksDir = path.join(hooksDir, 'gemini');
    if (!fs.existsSync(geminiHooksDir)) {
      console.log('Gemini hooks directory not found at', geminiHooksDir);
      return;
    }

    const settingsPath = path.join(this.configDir, 'settings.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    let settings: {
      hooks?: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
      [key: string]: unknown;
    } = {};

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }

    const hookFiles = [
      { type: 'AfterTool', file: 'post-tool-use.sh', matcher: '*' },
      { type: 'AfterAgent', file: 'on-stop.sh', matcher: undefined },
      { type: 'SessionStart', file: 'session-start.sh', matcher: '*' },
      { type: 'SessionEnd', file: 'session-end.sh', matcher: '*' },
      { type: 'Notification', file: 'notification.sh', matcher: '*' },
    ];

    let updated = false;

    type HookEntry = { matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> };

    for (const { type, file, matcher } of hookFiles) {
      const commandPath = path.join(geminiHooksDir, file);
      if (!fs.existsSync(commandPath)) continue;

      const existing: HookEntry[] = settings.hooks![type] || [];
      const entryIndex = existing.findIndex((h: HookEntry) =>
        h.hooks?.some((hh: { command?: string }) => hh.command?.includes(`gemini/${file}`))
      );

      if (entryIndex >= 0) {
        const entry: HookEntry = existing[entryIndex];
        const hookIndex = entry.hooks.findIndex((hh: { command?: string }) => hh.command?.includes(`gemini/${file}`));
        if (hookIndex >= 0 && entry.hooks[hookIndex].command !== commandPath) {
          entry.hooks[hookIndex].command = commandPath;
          updated = true;
        }
      } else {
        const hookConfig: { matcher?: string; hooks: Array<{ type: string; command: string; timeout: number }> } = {
          hooks: [{ type: 'command', command: commandPath, timeout: 10000 }]
        };
        if (matcher) hookConfig.matcher = matcher;
        settings.hooks![type] = [...existing, hookConfig];
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('Gemini hooks configured/updated in', settingsPath);
    } else {
      console.log('Gemini hooks already configured');
    }
  }

  async registerMcpServer(name: string, command: string, args: string[]): Promise<void> {
    // Try gemini mcp add first (proper CLI registration)
    try {
      const argsStr = args.map(a => `"${a}"`).join(' ');
      execSync(`gemini mcp add -s user ${name} ${command} ${argsStr}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      console.log(`[gemini] Registered MCP server ${name} via gemini mcp add`);
      return;
    } catch {
      // Fallback: write to settings.json manually
    }

    const settingsPath = path.join(this.configDir, 'settings.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    let settings: { mcpServers?: Record<string, unknown>; [key: string]: unknown } = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    if (!settings.mcpServers) {
      settings.mcpServers = {};
    }

    (settings.mcpServers as Record<string, unknown>)[name] = { command, args };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`[gemini] Registered MCP server ${name} in settings.json (fallback)`);
  }

  async removeMcpServer(name: string): Promise<void> {
    // Try gemini mcp remove first
    try {
      execSync(`gemini mcp remove -s user ${name} 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      // Ignore if doesn't exist
    }

    // Also clean settings.json fallback
    const settingsPath = path.join(this.configDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings?.mcpServers?.[name]) {
        delete settings.mcpServers[name];
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`[gemini] Removed MCP server ${name} from settings.json`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  isMcpServerRegistered(name: string, expectedServerPath: string): boolean {
    const settingsPath = path.join(this.configDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return false;
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const existing = settings?.mcpServers?.[name];
      if (!existing?.args) return false;
      return existing.args[existing.args.length - 1] === expectedServerPath;
    } catch {
      return false;
    }
  }

  getMcpConfigStrategy(): 'flag' | 'config-file' {
    return 'config-file';
  }

  getSkillDirectories(): string[] {
    return [path.join(this.configDir, 'skills')];
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
    // Gemini may not have a Claude-like memory system; return config dir as placeholder
    return this.configDir;
  }

  getAddDirFlag(): string {
    return '--include-directories';
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
"${params.binaryPath}" --output-format stream-json --debug --include-directories "${params.homeDir}/.dorothy" -p '${params.prompt}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
