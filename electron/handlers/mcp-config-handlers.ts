import { ipcMain } from 'electron';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Dorothy-managed MCP servers — hidden from the Custom MCP UI
const DOROTHY_MANAGED_MCPS = new Set([
  'claude-mgr-orchestrator',
  'claude-mgr-telegram',
  'claude-mgr-kanban',
  'claude-mgr-vault',
  'dorothy-socialdata',
  'dorothy-x',
  'dorothy-world',
  'google-workspace',
  'tasmania',
]);

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

// ── Provider config file paths ──────────────────────────────────────

function getConfigPath(provider: string): string {
  switch (provider) {
    case 'claude':
      return path.join(os.homedir(), '.claude', 'mcp.json');
    case 'codex':
      return path.join(os.homedir(), '.codex', 'config.toml');
    case 'gemini':
      return path.join(os.homedir(), '.gemini', 'settings.json');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Claude: JSON { mcpServers: { name: { command, args, env } } } ───

function readClaudeMcp(): McpServer[] {
  const configPath = getConfigPath('claude');
  if (!fs.existsSync(configPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const servers = data.mcpServers || {};
    return Object.entries(servers)
      .filter(([name]) => !DOROTHY_MANAGED_MCPS.has(name))
      .map(([name, cfg]: [string, any]) => ({
        name,
        command: cfg.command || '',
        args: Array.isArray(cfg.args) ? cfg.args : [],
        env: (cfg.env && typeof cfg.env === 'object') ? cfg.env : {},
      }));
  } catch (err) {
    console.error('Failed to read Claude MCP config:', err);
    return [];
  }
}

function writeClaudeMcp(action: 'update' | 'delete', server?: McpServer, deleteName?: string): void {
  const configPath = getConfigPath('claude');
  let data: any = {};
  if (fs.existsSync(configPath)) {
    try {
      data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      data = {};
    }
  }
  if (!data.mcpServers) data.mcpServers = {};

  if (action === 'update' && server) {
    data.mcpServers[server.name] = {
      command: server.command,
      args: server.args,
      ...(Object.keys(server.env).length > 0 ? { env: server.env } : {}),
    };
  } else if (action === 'delete' && deleteName) {
    delete data.mcpServers[deleteName];
  }

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// ── Gemini: JSON { mcpServers: { name: { command, args } }, ...other } ──

function readGeminiMcp(): McpServer[] {
  const configPath = getConfigPath('gemini');
  if (!fs.existsSync(configPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const servers = data.mcpServers || {};
    return Object.entries(servers)
      .filter(([name]) => !DOROTHY_MANAGED_MCPS.has(name))
      .map(([name, cfg]: [string, any]) => ({
        name,
        command: cfg.command || '',
        args: Array.isArray(cfg.args) ? cfg.args : [],
        env: (cfg.env && typeof cfg.env === 'object') ? cfg.env : {},
      }));
  } catch (err) {
    console.error('Failed to read Gemini MCP config:', err);
    return [];
  }
}

function writeGeminiMcp(action: 'update' | 'delete', server?: McpServer, deleteName?: string): void {
  const configPath = getConfigPath('gemini');
  let data: any = {};
  if (fs.existsSync(configPath)) {
    try {
      data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      data = {};
    }
  }
  if (!data.mcpServers) data.mcpServers = {};

  if (action === 'update' && server) {
    data.mcpServers[server.name] = {
      command: server.command,
      args: server.args,
      ...(Object.keys(server.env).length > 0 ? { env: server.env } : {}),
    };
  } else if (action === 'delete' && deleteName) {
    delete data.mcpServers[deleteName];
  }

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// ── Codex: TOML [mcp_servers.name] sections ─────────────────────────

function readCodexMcp(): McpServer[] {
  const configPath = getConfigPath('codex');
  if (!fs.existsSync(configPath)) return [];
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return parseTomlMcpServers(content);
  } catch (err) {
    console.error('Failed to read Codex MCP config:', err);
    return [];
  }
}

/**
 * Parse [mcp_servers.X] sections from TOML content.
 * Uses regex-based parsing (same approach as codex-provider.ts).
 */
function parseTomlMcpServers(content: string): McpServer[] {
  const servers: McpServer[] = [];
  // Match each [mcp_servers.NAME] section
  const sectionRegex = /\[mcp_servers\.([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const rawName = match[1].replace(/^"|"$/g, ''); // strip TOML quotes
    if (DOROTHY_MANAGED_MCPS.has(rawName)) continue;

    // Extract content until next section header or EOF
    const startIdx = match.index + match[0].length;
    const nextSection = content.indexOf('\n[', startIdx);
    const sectionContent = nextSection === -1
      ? content.slice(startIdx)
      : content.slice(startIdx, nextSection);

    const command = extractTomlString(sectionContent, 'command');
    const args = extractTomlArray(sectionContent, 'args');
    const env = extractTomlTable(sectionContent, 'env');

    servers.push({ name: rawName, command, args, env });
  }

  return servers;
}

function extractTomlString(section: string, key: string): string {
  const match = section.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : '';
}

function extractTomlArray(section: string, key: string): string[] {
  const match = section.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'm'));
  if (!match) return [];
  return match[1]
    .split(',')
    .map(s => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function extractTomlTable(section: string, key: string): Record<string, string> {
  // Look for inline table: env = { KEY = "val", ... }
  const match = section.match(new RegExp(`^${key}\\s*=\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) return {};
  const result: Record<string, string> = {};
  const pairs = match[1].split(',');
  for (const pair of pairs) {
    const kv = pair.match(/\s*(\w+)\s*=\s*"([^"]*)"/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

function escapeTomlKey(key: string): string {
  if (/[^a-zA-Z0-9_-]/.test(key)) return `"${key}"`;
  return key;
}

function writeCodexMcp(action: 'update' | 'delete', server?: McpServer, deleteName?: string): void {
  const configPath = getConfigPath('codex');
  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf-8');
  }

  const targetName = action === 'delete' ? deleteName! : server!.name;
  // Remove existing section for this name
  content = removeTomlSection(content, targetName);

  if (action === 'update' && server) {
    // Append new section
    const sectionKey = escapeTomlKey(server.name);
    const argsToml = server.args.map(a => `"${a}"`).join(', ');

    let section = `\n[mcp_servers.${sectionKey}]\ncommand = "${server.command}"\nargs = [${argsToml}]\n`;

    if (Object.keys(server.env).length > 0) {
      const envPairs = Object.entries(server.env)
        .map(([k, v]) => `${k} = "${v}"`)
        .join(', ');
      section += `env = { ${envPairs} }\n`;
    }

    content = content.trimEnd() + '\n' + section;
  }

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, content);
}

function removeTomlSection(content: string, name: string): string {
  const sectionKey = escapeTomlKey(name);
  const escapedKey = sectionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\n?\\[mcp_servers\\.${escapedKey}\\]\\n(?:(?!\\[)[^\\n]*\\n?)*`, 'g');
  return content.replace(regex, '');
}

// ── Dispatch by provider ────────────────────────────────────────────

function listServers(provider: string): McpServer[] {
  switch (provider) {
    case 'claude': return readClaudeMcp();
    case 'codex': return readCodexMcp();
    case 'gemini': return readGeminiMcp();
    default: return [];
  }
}

function updateServer(provider: string, server: McpServer): void {
  switch (provider) {
    case 'claude': writeClaudeMcp('update', server); break;
    case 'codex': writeCodexMcp('update', server); break;
    case 'gemini': writeGeminiMcp('update', server); break;
  }
}

function deleteServer(provider: string, name: string): void {
  switch (provider) {
    case 'claude': writeClaudeMcp('delete', undefined, name); break;
    case 'codex': writeCodexMcp('delete', undefined, name); break;
    case 'gemini': writeGeminiMcp('delete', undefined, name); break;
  }
}

// ── IPC Registration ────────────────────────────────────────────────

export function registerMcpConfigHandlers(): void {
  ipcMain.handle('mcp:list', async (_event, params: { provider: string }) => {
    try {
      const servers = listServers(params.provider);
      return { servers };
    } catch (err) {
      console.error(`Failed to list MCP servers for ${params.provider}:`, err);
      return { servers: [], error: String(err) };
    }
  });

  ipcMain.handle('mcp:update', async (_event, params: {
    provider: string;
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
  }) => {
    try {
      updateServer(params.provider, {
        name: params.name,
        command: params.command,
        args: params.args,
        env: params.env,
      });
      return { success: true };
    } catch (err) {
      console.error(`Failed to update MCP server:`, err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('mcp:delete', async (_event, params: { provider: string; name: string }) => {
    try {
      deleteServer(params.provider, params.name);
      return { success: true };
    } catch (err) {
      console.error(`Failed to delete MCP server:`, err);
      return { success: false, error: String(err) };
    }
  });
}
