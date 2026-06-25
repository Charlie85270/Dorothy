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
 * Install:  curl -fsSL https://x.ai/cli/install.sh | bash
 *           (installs to ~/.grok/bin/grok, also symlinked into ~/.local/bin)
 * Binary:   `grok`
 * Auth:     `grok login` (interactive) or the GROK_DEPLOYMENT_KEY env var;
 *           credentials are cached in ~/.grok/auth.json.
 * Config:   ~/.grok/config.toml (TOML — MCP servers under [mcp_servers.<name>]).
 *
 * Flags verified against grok 0.2.64:
 *   Interactive:  grok [-m <model>] [--permission-mode <mode>] [--effort <lvl>] [--debug] "<prompt>"
 *   Headless:     grok -p "<prompt>" [--output-format plain|json|streaming-json]
 *   Models:       grok models            (default model: grok-build)
 *   MCP:          grok mcp add <name> <command> -- <args> | grok mcp remove <name> | grok mcp list
 *
 * Grok's CLI semantics closely mirror Claude Code / Codex, so MCP handling
 * follows the Codex provider (config.toml with [mcp_servers.<name>] sections).
 * Note: Grok has no `--add-dir`/multi-root flag, so secondary-project and
 * Obsidian-vault mounting are intentionally not emitted.
 */
export class GrokProvider implements CLIProvider {
  readonly id = 'grok' as const;
  readonly displayName = 'Grok CLI';
  readonly binaryName = 'grok';
  readonly configDir = path.join(os.homedir(), '.grok');

  getModels(): ProviderModel[] {
    // IDs from `grok models` (authenticated). The available set is
    // account-dependent; these are isolated here for easy updates.
    return [
      { id: 'grok-composer-2.5-fast', name: 'Grok Composer 2.5 Fast', description: 'Recommended (default)' },
      { id: 'grok-build', name: 'Grok Build', description: 'Agentic coding' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.grok || 'grok';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

    // Model
    if (params.model) {
      if (!/^[a-zA-Z0-9._:/-]+$/.test(params.model)) {
        throw new Error('Invalid model name');
      }
      command += ` -m '${params.model}'`;
    }

    // Permission mode → Grok's Claude-Code-aligned --permission-mode.
    // (normal keeps Grok's default plan-mode gate; no flag emitted.)
    if (params.permissionMode === 'auto') {
      command += ' --permission-mode auto';
    } else if (params.permissionMode === 'bypass') {
      command += ' --permission-mode bypassPermissions';
    }

    // Reasoning effort (Grok accepts low|medium|high|xhigh|max).
    if (params.effort && params.effort !== 'medium') {
      command += ` --effort ${params.effort}`;
    }

    // Verbose → debug logging.
    if (params.verbose) {
      command += ' --debug';
    }

    // Prompt (positional) with optional skills directive.
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
      command += ' --permission-mode bypassPermissions';
    }

    if (params.outputFormat) {
      command += ' --output-format streaming-json';
    }

    // Headless single-turn: -p/--single takes the prompt as its value and exits.
    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` -p '${escaped}'`;

    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

    // Model must precede -p, since -p/--single consumes the next token as the prompt.
    if (params.model) {
      command += ` -m ${params.model}`;
    }

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` -p '${escaped}'`;

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
      settingsFile: path.join(this.configDir, 'config.toml'),
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
    // Try `grok mcp add` first: `grok mcp add <name> <command> -- <args...>`.
    try {
      const argsStr = args.map(a => `"${a}"`).join(' ');
      execSync(`grok mcp add ${name} ${command} -- ${argsStr}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      console.log(`[grok] Registered MCP server ${name} via grok mcp add`);
      return;
    } catch {
      // Fallback: write to config.toml manually.
    }

    const configPath = path.join(this.configDir, 'config.toml');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    let content = '';
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf-8');
    }

    // Remove existing section if present, then append the new one.
    content = this.removeTomlSection(content, name);

    const sectionKey = this.escapeTomlKey(name);
    const argsToml = args.map(a => `"${a}"`).join(', ');
    const section = `\n[mcp_servers.${sectionKey}]\ncommand = "${command}"\nargs = [${argsToml}]\nenabled = true\n`;

    content = content.trimEnd() + '\n' + section;
    fs.writeFileSync(configPath, content);
    console.log(`[grok] Registered MCP server ${name} in config.toml (fallback)`);
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

    // Also clean the config.toml fallback.
    const configPath = path.join(this.configDir, 'config.toml');
    if (!fs.existsSync(configPath)) return;

    const content = fs.readFileSync(configPath, 'utf-8');
    const updated = this.removeTomlSection(content, name);
    if (updated !== content) {
      fs.writeFileSync(configPath, updated);
      console.log(`[grok] Removed MCP server ${name} from config.toml`);
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
    // Match section header + all lines until the next section header or EOF.
    const regex = new RegExp(`\\n?\\[mcp_servers\\.${escapedKey}\\]\\n(?:(?!\\[)[^\\n]*\\n?)*`, 'g');
    return content.replace(regex, '');
  }

  private escapeTomlKey(key: string): string {
    // TOML keys with dots or special chars need quoting.
    if (/[^a-zA-Z0-9_-]/.test(key)) {
      return `"${key}"`;
    }
    return key;
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
    // Grok supports cross-session memory; config/memory live under ~/.grok.
    return this.configDir;
  }

  getAddDirFlag(): string {
    // Grok has no --add-dir / multi-root flag.
    return '';
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
    const permissionFlag = params.autonomous ? '--permission-mode bypassPermissions ' : '';

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
"${params.binaryPath}" ${permissionFlag}--output-format streaming-json -p '${params.prompt}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
