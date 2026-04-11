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

const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class QwenProvider implements CLIProvider {
  readonly id = 'qwen' as const;
  readonly displayName = 'Qwen (Alibaba)';
  readonly binaryName = 'claude';
  readonly configDir = path.join(os.homedir(), '.claude');

  getModels(): ProviderModel[] {
    return [
      { id: 'qwen/qwq-32b', name: 'QwQ 32B', description: 'Extended reasoning' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Flagship instruct' },
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', description: 'Code specialist' },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', description: 'Ultra-scale MoE' },
      { id: 'qwen/qwen3-30b-a3b', name: 'Qwen3 30B', description: 'Compact MoE' },
    ];
  }

  resolveBinaryPath(appSettings: AppSettings): string {
    return appSettings.cliPaths?.claude || 'claude';
  }

  buildInteractiveCommand(params: InteractiveCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;
    if (params.mcpConfigPath && fs.existsSync(params.mcpConfigPath)) command += ` --mcp-config '${params.mcpConfigPath.replace(/'/g, "'\\''")}'`;
    if (params.systemPromptFile && fs.existsSync(params.systemPromptFile)) command += ` --append-system-prompt-file '${params.systemPromptFile.replace(/'/g, "'\\''")}'`;
    if (params.model && params.model !== 'default') {
      if (!/^[a-zA-Z0-9._:\/\-]+$/.test(params.model)) throw new Error('Invalid model name');
      command += ` --model '${params.model}'`;
    }
    if (params.verbose) command += ' --verbose';
    if (params.permissionMode === 'auto') command += ' --permission-mode auto';
    else if (params.permissionMode === 'bypass') command += ' --permission-mode bypassPermissions';
    if (params.effort && params.effort !== 'medium') command += ` --effort ${params.effort}`;
    command += ` --add-dir '${os.homedir()}/.dorothy'`;
    let finalPrompt = params.prompt;
    if (params.skills && params.skills.length > 0 && !params.isSuperAgent) {
      finalPrompt = `[IMPORTANT: Use these skills: ${params.skills.join(', ')}.] ${params.prompt}`;
    }
    if (finalPrompt) command += ` '${finalPrompt.replace(/'/g, "'\\''")}'`;
    return command;
  }

  buildScheduledCommand(params: ScheduledCommandParams): string {
    let command = `"${params.binaryPath}"`;
    if (params.autonomous) command += ' --dangerously-skip-permissions';
    if (params.outputFormat) command += ` --output-format ${params.outputFormat}`;
    if (params.verbose) command += ' --verbose';
    if (params.mcpConfigPath) command += ` --mcp-config "${params.mcpConfigPath}"`;
    command += ` --add-dir "${os.homedir()}/.dorothy"`;
    command += ` -p '${params.prompt.replace(/'/g, "'\\''")}'`;
    return command;
  }

  buildOneShotCommand(params: OneShotCommandParams): string {
    let command = `'${params.binaryPath.replace(/'/g, "'\\''")}'`;
    command += ' -p';
    if (params.model && params.model !== 'default') command += ` --model ${params.model}`;
    command += ` '${params.prompt.replace(/'/g, "'\\''")}'`;
    return command;
  }

  getPtyEnvVars(agentId: string, projectPath: string, skills: string[], appSettings?: AppSettings): Record<string, string> {
    const vars: Record<string, string> = {
      CLAUDE_SKILLS: skills.join(','),
      CLAUDE_AGENT_ID: agentId,
      CLAUDE_PROJECT_PATH: projectPath,
      CLAUDE_PROVIDER: this.id,
    };
    if (appSettings?.qwenApiKey) {
      vars.ANTHROPIC_BASE_URL = QWEN_BASE_URL;
      vars.ANTHROPIC_API_KEY = appSettings.qwenApiKey;
    } else if (appSettings?.openRouterApiKey) {
      vars.ANTHROPIC_BASE_URL = OPENROUTER_BASE_URL;
      vars.ANTHROPIC_API_KEY = appSettings.openRouterApiKey;
    }
    return vars;
  }

  getEnvVarsToDelete(): string[] { return ['CLAUDECODE']; }
  getHookConfig(): HookConfig { return { supportsNativeHooks: true, configDir: this.configDir, settingsFile: path.join(this.configDir, 'settings.json') }; }
  async configureHooks(_hooksDir: string): Promise<void> {}

  async registerMcpServer(name: string, command: string, args: string[]): Promise<void> {
    const p = path.join(this.configDir, 'mcp.json');
    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true });
    let c: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (fs.existsSync(p)) { try { c = JSON.parse(fs.readFileSync(p, 'utf-8')); if (!c.mcpServers) c.mcpServers = {}; } catch { c = { mcpServers: {} }; } }
    c.mcpServers![name] = { command, args };
    fs.writeFileSync(p, JSON.stringify(c, null, 2));
  }

  async removeMcpServer(name: string): Promise<void> {
    const p = path.join(this.configDir, 'mcp.json');
    if (!fs.existsSync(p)) return;
    try { const c = JSON.parse(fs.readFileSync(p, 'utf-8')); if (c?.mcpServers?.[name]) { delete c.mcpServers[name]; fs.writeFileSync(p, JSON.stringify(c, null, 2)); } } catch { /* ignore */ }
  }

  isMcpServerRegistered(name: string, expectedServerPath: string): boolean {
    const p = path.join(this.configDir, 'mcp.json');
    if (!fs.existsSync(p)) return false;
    try { const c = JSON.parse(fs.readFileSync(p, 'utf-8')); const e = c?.mcpServers?.[name]; if (!e?.args) return false; return e.args[e.args.length - 1] === expectedServerPath; } catch { return false; }
  }

  getMcpConfigStrategy(): 'flag' | 'config-file' { return 'flag'; }
  getSkillDirectories(): string[] { return [path.join(this.configDir, 'skills'), path.join(os.homedir(), '.agents', 'skills')]; }

  getInstalledSkills(): string[] {
    const skills = new Set<string>();
    for (const dir of this.getSkillDirectories()) {
      if (fs.existsSync(dir)) { try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory() || e.isSymbolicLink()) skills.add(e.name); } } catch { /* ignore */ } }
    }
    return Array.from(skills);
  }

  supportsSkills(): boolean { return true; }
  getMemoryBasePath(): string { return path.join(this.configDir, 'projects'); }
  getAddDirFlag(): string { return '--add-dir'; }

  buildScheduledScript(params: { binaryPath: string; binaryDir: string; projectPath: string; prompt: string; autonomous: boolean; mcpConfigPath: string; logPath: string; homeDir: string; skills?: string[]; }): string {
    const flags = params.autonomous ? '--dangerously-skip-permissions' : '';
    const promptWithSkills = (params.skills && params.skills.length > 0)
      ? `[IMPORTANT: Use these skills for this session: ${params.skills.join(', ')}. Invoke them with /<skill-name> when relevant to the task.] ${params.prompt}`
      : params.prompt;
    return `#!/bin/bash
export HOME="${params.homeDir}"
if [ -s "${params.homeDir}/.nvm/nvm.sh" ]; then source "${params.homeDir}/.nvm/nvm.sh" 2>/dev/null || true; fi
if [ -f "${params.homeDir}/.zshrc" ]; then source "${params.homeDir}/.zshrc" 2>/dev/null || true; fi
export PATH="${params.binaryDir}:$PATH"
cd "${params.projectPath}"
echo "=== Task started at $(date) ===" >> "${params.logPath}"
unset CLAUDECODE
"${params.binaryPath}" ${flags} --output-format stream-json --verbose --mcp-config "${params.mcpConfigPath}" --add-dir "${params.homeDir}/.dorothy" -p '${promptWithSkills}' >> "${params.logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${params.logPath}"
`;
  }
}
