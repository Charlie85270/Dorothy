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

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements CLIProvider {
  readonly id = 'openrouter' as const;
  readonly displayName = 'OpenRouter';
  readonly binaryName = 'claude';
  readonly configDir = path.join(os.homedir(), '.claude');

  getModels(): ProviderModel[] {
    return [
      // DeepSeek
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning • DeepSeek' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'Chat • DeepSeek' },
      // Moonshot / Kimi
      { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: 'Agentic • MoonshotAI' },
      // Xiaomi MiMo
      { id: 'xiaomi/mimo-v2-pro', name: 'MiMo V2 Pro', description: 'Agentic • Xiaomi' },
      // Alibaba Qwen
      { id: 'qwen/qwq-32b', name: 'QwQ 32B', description: 'Reasoning • Alibaba' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Instruct • Alibaba' },
      // OpenAI
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'Flagship • OpenAI' },
      { id: 'openai/o4-mini', name: 'o4 mini', description: 'Reasoning • OpenAI' },
      // Google
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Flagship • Google' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast • Google' },
      // Meta
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', description: 'Open • Meta' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.claude || 'claude';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

    if (params.mcpConfigPath && fs.existsSync(params.mcpConfigPath)) {
      command += ` --mcp-config '${params.mcpConfigPath.replace(/'/g, "'\\''")}'`;
    }

    if (params.systemPromptFile && fs.existsSync(params.systemPromptFile)) {
      command += ` --append-system-prompt-file '${params.systemPromptFile.replace(/'/g, "'\\''")}'`;
    }

    if (params.model && params.model !== 'default') {
      if (!/^[a-zA-Z0-9._:\/\-]+$/.test(params.model)) {
        throw new Error('Invalid model name');
      }
      command += ` --model '${params.model}'`;
    }

    if (params.verbose) {
      command += ' --verbose';
    }

    if (params.permissionMode === 'auto') {
      command += ' --permission-mode auto';
    } else if (params.permissionMode === 'bypass') {
      command += ' --permission-mode bypassPermissions';
    }

    if (params.effort && params.effort !== 'medium') {
      command += ` --effort ${params.effort}`;
    }

    command += ` --add-dir '${os.homedir()}/.dorothy'`;

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
      command += ' --dangerously-skip-permissions';
    }

    if (params.outputFormat) {
      command += ` --output-format ${params.outputFormat}`;
    }

    if (params.verbose) {
      command += ' --verbose';
    }

    if (params.mcpConfigPath) {
      command += ` --mcp-config "${params.mcpConfigPath}"`;
    }

    command += ` --add-dir "${os.homedir()}/.dorothy"`;

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` -p '${escaped}'`;

    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;

    command += ' -p';

    if (params.model && params.model !== 'default') {
      command += ` --model ${params.model}`;
    }

    const escaped = params.prompt.replace(/'/g, "'\\''");
    command += ` '${escaped}'`;

    return command;
  }

  getPtyEnvVars(agentId: string, projectPath: string, skills: string[], appSettings?: AppSettings): Record<string, string> {
    const vars: Record<string, string> = {
      CLAUDE_SKILLS: skills.join(','),
      CLAUDE_AGENT_ID: agentId,
      CLAUDE_PROJECT_PATH: projectPath,
    };

    const apiKey = appSettings?.openRouterApiKey;
    if (apiKey) {
      vars.ANTHROPIC_BASE_URL = OPENROUTER_BASE_URL;
      vars.ANTHROPIC_API_KEY = apiKey;
      // OpenRouter HTTP-Referer header (optional but recommended)
      vars.OR_SITE_URL = 'https://dorothy.app';
      vars.OR_APP_NAME = 'Dorothy';
    }

    return vars;
  }

  getEnvVarsToDelete(): string[] {
    return ['CLAUDECODE'];
  }

  getHookConfig(): HookConfig {
    return {
      supportsNativeHooks: true,
      configDir: this.configDir,
      settingsFile: path.join(this.configDir, 'settings.json'),
    };
  }

  async configureHooks(_hooksDir: string): Promise<void> {
    // OpenRouter uses the same Claude CLI, so hooks work normally
  }

  async registerMcpServer(name: string, command: string, args: string[]): Promise<void> {
    const mcpConfigPath = path.join(this.configDir, 'mcp.json');
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    let mcpConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (fs.existsSync(mcpConfigPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      } catch {
        mcpConfig = { mcpServers: {} };
      }
    }

    mcpConfig.mcpServers![name] = { command, args };
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  }

  async removeMcpServer(name: string): Promise<void> {
    const mcpConfigPath = path.join(this.configDir, 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        if (mcpConfig?.mcpServers?.[name]) {
          delete mcpConfig.mcpServers[name];
          fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        }
      } catch { /* ignore */ }
    }
  }

  isMcpServerRegistered(name: string, expectedServerPath: string): boolean {
    const mcpConfigPath = path.join(this.configDir, 'mcp.json');
    if (!fs.existsSync(mcpConfigPath)) return false;
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      const existing = mcpConfig?.mcpServers?.[name];
      if (!existing?.args) return false;
      return existing.args[existing.args.length - 1] === expectedServerPath;
    } catch {
      return false;
    }
  }

  getMcpConfigStrategy(): 'flag' | 'config-file' {
    return 'flag';
  }

  getSkillDirectories(): string[] {
    return [
      path.join(this.configDir, 'skills'),
      path.join(os.homedir(), '.agents', 'skills'),
    ];
  }

  getInstalledSkills(): string[] {
    const skills = new Set<string>();
    for (const dir of this.getSkillDirectories()) {
      if (fs.existsSync(dir)) {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() || entry.isSymbolicLink()) {
              skills.add(entry.name);
            }
          }
        } catch { /* ignore */ }
      }
    }
    return Array.from(skills);
  }

  supportsSkills(): boolean {
    return true;
  }

  getMemoryBasePath(): string {
    return path.join(this.configDir, 'projects');
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
    const flags = params.autonomous ? '--dangerously-skip-permissions' : '';

    return `#!/bin/bash

export HOME="${params.homeDir}"

if [ -s "${params.homeDir}/.nvm/nvm.sh" ]; then
  source "${params.homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ -f "${params.homeDir}/.zshrc" ]; then
  source "${params.homeDir}/.zshrc" 2>/dev/null || true
elif [ -f "${params.homeDir}/.bash_profile" ]; then
  source "${params.homeDir}/.bash_profile" 2>/dev/null || true
fi

export PATH="${params.binaryDir}:$PATH"
cd "${params.projectPath}"
echo "=== Task started at $(date) ===" >> "${params.logPath}"
unset CLAUDECODE
"${params.binaryPath}" ${flags} --output-format stream-json --verbose --mcp-config "${params.mcpConfigPath}" --add-dir "${params.homeDir}/.dorothy" -p '${params.prompt}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
