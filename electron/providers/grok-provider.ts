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

/**
 * Provider for xAI's Grok CLI ("Grok Build" — https://x.ai/cli).
 *
 * Install:   curl -fsSL https://x.ai/cli/install.sh | bash
 * Binary:    `grok`
 * Headless:  `grok -p "<prompt>"`              (one-shot, non-interactive)
 * Model:     `-m <model>`
 * JSON:      `--output-format streaming-json`  (machine-readable stream)
 * Auth:      GROK_CODE_XAI_API_KEY (or XAI_API_KEY) env var
 *
 * The Grok CLI advertises that "AGENTS.md, plugins, hooks, skills, and MCP
 * servers work out of the box". MCP registration and config-file shapes are
 * not yet fully documented for the public beta, so this provider follows the
 * dominant convention used by the other CLIs: try the native `grok mcp add`
 * sub-command first, and fall back to a JSON `settings.json` (`mcpServers`
 * map) under the config dir. Native hooks are treated as unsupported for now
 * (exit-code based status detection), matching the Codex provider.
 */
export class GrokProvider implements CLIProvider {
  readonly id = 'grok' as const;
  readonly displayName = 'Grok CLI';
  readonly binaryName = 'grok';
  readonly configDir = path.join(os.homedir(), '.grok');

  getModels(): ProviderModel[] {
    // Model IDs evolve quickly during the Grok Build beta; these mirror the
    // xAI public model line-up. Users can override per-agent in the UI.
    return [
      { id: 'grok-4', name: 'Grok 4', description: 'Most capable' },
      { id: 'grok-4-fast', name: 'Grok 4 Fast', description: 'Fast & efficient' },
      { id: 'grok-code-fast-1', name: 'Grok Code Fast', description: 'Optimized for coding' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.grok || 'grok';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

    // Model (Grok uses -m, same as Gemini)
    if (params.model) {
      if (!/^[a-zA-Z0-9._:/-]+$/.test(params.model)) {
        throw new Error('Invalid model name');
      }
      command += ` -m '${params.model}'`;
    }

    // Grok's public beta gates tool use behind Plan Mode and exposes no
    // documented "skip permissions" flag yet, so auto/bypass modes fall back
    // to the default safety gate (no extra flag emitted).

    // Secondary project — follow the Claude/Codex `--add-dir` convention.
    if (params.secondaryProjectPath) {
      const escaped = params.secondaryProjectPath.replace(/'/g, "'\\''");
      command += ` --add-dir '${escaped}'`;
    }

    // Obsidian vaults (read-only access)
    if (params.obsidianVaultPaths) {
      for (const vp of params.obsidianVaultPaths) {
        if (fs.existsSync(vp)) {
          const escaped = vp.replace(/'/g, "'\\''");
          command += ` --add-dir '${escaped}'`;
        }
      }
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

    if (params.outputFormat) {
      command += ' --output-format streaming-json';
    }

    // Headless one-shot execution.
    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` -p '${escaped}'`;

    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

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
    // Grok doesn't have a known nested-session env var yet.
    return [];
  }

  getHookConfig(): HookConfig {
    return {
      supportsNativeHooks: false,
      configDir: this.configDir,
      settingsFile: path.join(this.configDir, 'settings.json'),
    };
  }

  async configureHooks(_hooksDir: string): Promise<void> {
    // Grok CLI hook payload format is not yet documented for the public beta.
    // Fall back to exit-code based status detection, like the Codex provider.
    console.log('Grok CLI: native hooks not wired yet, using exit-code based status detection');
  }

  getMcpConfigStrategy(): 'flag' | 'config-file' {
    return 'config-file';
  }

  async registerMcpServer(name: string, command: string, args: string[]): Promise<void> {
    // Try `grok mcp add` first (native CLI registration).
    try {
      const argsStr = args.map(a => `"${a}"`).join(' ');
      execSync(`grok mcp add ${name} -- ${command} ${argsStr}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      console.log(`[grok] Registered MCP server ${name} via grok mcp add`);
      return;
    } catch {
      // Fallback: write to settings.json manually.
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
    console.log(`[grok] Registered MCP server ${name} in settings.json (fallback)`);
  }

  async removeMcpServer(name: string): Promise<void> {
    // Try `grok mcp remove` first.
    try {
      execSync(`grok mcp remove ${name} 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      // Ignore if it doesn't exist.
    }

    // Also clean settings.json fallback.
    const settingsPath = path.join(this.configDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings?.mcpServers?.[name]) {
        delete settings.mcpServers[name];
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`[grok] Removed MCP server ${name} from settings.json`);
      }
    } catch {
      // Ignore malformed settings.
    }
  }

  isMcpServerRegistered(name: string, expectedServerPath: string): boolean {
    const settingsPath = path.join(this.configDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return false;
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const server = settings?.mcpServers?.[name] as { args?: string[] } | undefined;
      if (!server) return false;
      return Array.isArray(server.args) && server.args.some(a => a === expectedServerPath);
    } catch {
      return false;
    }
  }

  getSkillDirectories(): string[] {
    return [
      path.join(this.configDir, 'skills'),
      path.join(os.homedir(), '.agents', 'skills'),
    ];
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
          // Ignore read errors.
        }
      }
    }
    return skills;
  }

  supportsSkills(): boolean {
    return true;
  }

  getMemoryBasePath(): string {
    // Grok memory layout isn't documented yet; return config dir as placeholder.
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
"${params.binaryPath}" --output-format streaming-json -p '${params.prompt}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
