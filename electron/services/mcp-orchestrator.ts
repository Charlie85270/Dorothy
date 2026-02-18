import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import type { AppSettings } from '../types';

/**
 * MCP Orchestrator Service
 *
 * Manages the setup, configuration, and lifecycle of the MCP orchestrator
 * which integrates with Claude's global configuration.
 */

// ============== Helper Functions ==============

/**
 * Get the path to the bundled MCP orchestrator
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpOrchestratorPath(): string {
  // Always use the packaged app path - works for all users
  return path.join(process.resourcesPath, 'mcp-orchestrator', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP telegram server
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpTelegramPath(): string {
  // Always use the packaged app path - works for all users
  return path.join(process.resourcesPath, 'mcp-telegram', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP kanban server
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpKanbanPath(): string {
  // Always use the packaged app path - works for all users
  return path.join(process.resourcesPath, 'mcp-kanban', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP vault server
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpVaultPath(): string {
  return path.join(process.resourcesPath, 'mcp-vault', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP socialdata server
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpSocialDataPath(): string {
  return path.join(process.resourcesPath, 'mcp-socialdata', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP X server (tweet posting)
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpXPath(): string {
  return path.join(process.resourcesPath, 'mcp-x', 'dist', 'bundle.js');
}

/**
 * Get the path to the bundled MCP world server (generative zones)
 * Always uses the packaged app path - MCP servers are bundled in extraResources
 */
export function getMcpWorldPath(): string {
  return path.join(process.resourcesPath, 'mcp-world', 'dist', 'bundle.js');
}

/**
 * Auto-setup MCP orchestrator on app start using claude mcp add command
 * This function runs during app initialization to ensure the orchestrator is properly configured
 */
export async function setupMcpOrchestrator(appSettings?: AppSettings): Promise<void> {
  try {
    const orchestratorPath = getMcpOrchestratorPath();
    const telegramPath = getMcpTelegramPath();
    const kanbanPath = getMcpKanbanPath();
    const vaultPath = getMcpVaultPath();
    const socialDataPath = getMcpSocialDataPath();
    const xPath = getMcpXPath();
    const worldPath = getMcpWorldPath();

    const claudeDir = path.join(os.homedir(), '.claude');
    const mcpConfigPath = path.join(claudeDir, 'mcp.json');

    // Setup orchestrator if exists
    if (fs.existsSync(orchestratorPath)) {
      await setupMcpServer('claude-mgr-orchestrator', orchestratorPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP orchestrator not found at', orchestratorPath);
    }

    // Setup telegram MCP server if exists (makes send_telegram available to all agents)
    if (fs.existsSync(telegramPath)) {
      await setupMcpServer('claude-mgr-telegram', telegramPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP telegram not found at', telegramPath);
    }

    // Setup kanban MCP server if exists (makes task management available to all agents)
    if (fs.existsSync(kanbanPath)) {
      await setupMcpServer('claude-mgr-kanban', kanbanPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP kanban not found at', kanbanPath);
    }

    // Setup vault MCP server if exists (makes document management available to all agents)
    if (fs.existsSync(vaultPath)) {
      await setupMcpServer('claude-mgr-vault', vaultPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP vault not found at', vaultPath);
    }

    // Setup socialdata MCP server if exists (makes Twitter/X search available to all agents)
    if (fs.existsSync(socialDataPath)) {
      await setupMcpServer('dorothy-socialdata', socialDataPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP socialdata not found at', socialDataPath);
    }

    // Setup X MCP server if exists (makes tweet posting available to all agents)
    if (fs.existsSync(xPath)) {
      await setupMcpServer('dorothy-x', xPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP x not found at', xPath);
    }

    // Setup world MCP server if exists (makes zone creation available to all agents)
    if (fs.existsSync(worldPath)) {
      await setupMcpServer('dorothy-world', worldPath, claudeDir, mcpConfigPath);
    } else {
      console.log('MCP world not found at', worldPath);
    }

    // Setup Tasmania MCP server if enabled in settings
    if (appSettings?.tasmaniaEnabled && appSettings.tasmaniaServerPath) {
      const tasmaniaPath = appSettings.tasmaniaServerPath;
      if (fs.existsSync(tasmaniaPath)) {
        await setupMcpServer('tasmania', tasmaniaPath, claudeDir, mcpConfigPath);
      } else {
        console.log('Tasmania MCP server not found at', tasmaniaPath);
      }
    }

    // Install bundled skills to ~/.claude/skills/
    await installBundledSkills();
  } catch (err) {
    console.error('Failed to auto-setup MCP servers:', err);
  }
}

/**
 * Install bundled skills from the app to ~/.claude/skills/
 * Skills bundled in the app's skills/ directory are copied to the user's
 * global skills directory so they're available to all agents.
 */
async function installBundledSkills(): Promise<void> {
  const bundledSkills = ['world-builder'];
  const targetBaseDir = path.join(os.homedir(), '.claude', 'skills');

  for (const skillName of bundledSkills) {
    try {
      const sourceDir = path.join(app.getAppPath(), 'skills', skillName);
      const sourceFile = path.join(sourceDir, 'SKILL.md');

      if (!fs.existsSync(sourceFile)) {
        console.log(`Bundled skill ${skillName} not found at ${sourceFile}`);
        continue;
      }

      const targetDir = path.join(targetBaseDir, skillName);
      const targetFile = path.join(targetDir, 'SKILL.md');

      // Check if already installed with same content
      if (fs.existsSync(targetFile)) {
        const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
        const targetContent = fs.readFileSync(targetFile, 'utf-8');
        if (sourceContent === targetContent) {
          console.log(`Skill ${skillName} already installed and up to date`);
          continue;
        }
        console.log(`Skill ${skillName} outdated, updating...`);
      }

      // Install the skill
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourceFile, targetFile);
      console.log(`Installed skill ${skillName} to ${targetDir}`);
    } catch (err) {
      console.error(`Failed to install skill ${skillName}:`, err);
    }
  }
}

/**
 * Helper to setup a single MCP server
 */
async function setupMcpServer(name: string, serverPath: string, claudeDir: string, mcpConfigPath: string): Promise<void> {
  // Determine command based on file extension (.ts needs npx tsx, .js uses node)
  const isTypeScript = serverPath.endsWith('.ts');
  const command = isTypeScript ? 'npx' : 'node';
  const args = isTypeScript ? ['tsx', serverPath] : [serverPath];

  // Check if current config path matches the expected path
  let needsUpdate = true;
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      const existingConfig = mcpConfig.mcpServers?.[name];
      // Check the last arg (the actual server path) matches
      const existingPath = existingConfig?.args?.[existingConfig.args.length - 1];
      if (existingPath === serverPath) {
        console.log(`${name} already configured with correct path`);
        needsUpdate = false;
      } else if (existingConfig) {
        console.log(`${name} path changed, updating...`);
        console.log('  Old path:', existingPath);
        console.log('  New path:', serverPath);
      }
    } catch {
      // Config parsing failed, will update
    }
  }

  if (!needsUpdate) {
    return;
  }

  // Remove existing config first (in case path changed)
  try {
    execSync(`claude mcp remove -s user ${name} 2>&1`, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`Removed old ${name} config`);
  } catch {
    // Ignore errors if it doesn't exist
  }

  // Add the MCP server using claude mcp add with -s user for global scope
  const argsStr = args.map(a => `"${a}"`).join(' ');
  const addCommand = `claude mcp add -s user ${name} ${command} ${argsStr}`;
  console.log('Running:', addCommand);

  try {
    execSync(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${name} configured globally via claude mcp add -s user`);
  } catch (addErr) {
    console.error(`Failed to add ${name} via claude mcp add -s user:`, addErr);
    // Fallback: also write to mcp.json for compatibility
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    let mcpConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (fs.existsSync(mcpConfigPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        if (!mcpConfig.mcpServers) {
          mcpConfig.mcpServers = {};
        }
      } catch {
        mcpConfig = { mcpServers: {} };
      }
    }

    mcpConfig.mcpServers![name] = { command, args };

    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    console.log(`${name} configured via mcp.json fallback`);
  }
}

// ============== IPC Handlers ==============

/**
 * Get the current status of the MCP orchestrator
 * Checks both claude mcp list output and mcp.json configuration
 */
export function setupOrchestratorStatusHandler(): void {
  ipcMain.handle('orchestrator:getStatus', async () => {
    try {
      const orchestratorPath = getMcpOrchestratorPath();
      const orchestratorExists = fs.existsSync(orchestratorPath);

      // Check mcp.json directly — fast, no child process spawn
      const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
      let mcpJsonConfigured = false;
      if (fs.existsSync(mcpConfigPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          mcpJsonConfigured = mcpConfig?.mcpServers?.['claude-mgr-orchestrator'] !== undefined;
        } catch {
          // Ignore parse errors
        }
      }

      // Only run the slow `claude mcp list` if mcp.json check didn't find it
      let mcpListConfigured = false;
      if (!mcpJsonConfigured) {
        try {
          const { execFile: execFileAsync } = await import('child_process');
          const { promisify } = await import('util');
          const execFilePromise = promisify(execFileAsync);
          const { stdout } = await execFilePromise('claude', ['mcp', 'list'], {
            encoding: 'utf-8',
            timeout: 5000,
          });
          mcpListConfigured = stdout.includes('claude-mgr-orchestrator');
        } catch {
          mcpListConfigured = false;
        }
      }

      return {
        configured: mcpJsonConfigured || mcpListConfigured,
        orchestratorPath,
        orchestratorExists,
        mcpListConfigured,
        mcpJsonConfigured,
      };
    } catch (err) {
      console.error('Failed to get orchestrator status:', err);
      return { configured: false, error: String(err) };
    }
  });
}

/**
 * Setup the MCP orchestrator using claude mcp add command
 * This handler allows manual configuration from the renderer process
 */
export function setupOrchestratorSetupHandler(): void {
  ipcMain.handle('orchestrator:setup', async () => {
    try {
      const orchestratorPath = getMcpOrchestratorPath();

      // Check if orchestrator exists
      if (!fs.existsSync(orchestratorPath)) {
        return {
          success: false,
          error: `MCP orchestrator not found at ${orchestratorPath}. Try reinstalling the app.`
        };
      }

      // First try to remove any existing config to avoid duplicates (from both user and project scope)
      try {
        execSync('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      } catch {
        // Ignore errors if it doesn't exist
      }
      try {
        execSync('claude mcp remove claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      } catch {
        // Ignore errors if it doesn't exist in project scope
      }

      // Add the MCP server using claude mcp add with -s user for global scope
      const addCommand = `claude mcp add -s user claude-mgr-orchestrator node "${orchestratorPath}"`;
      console.log('Running:', addCommand);

      try {
        execSync(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
        console.log('MCP orchestrator configured globally via claude mcp add -s user');
        return { success: true, method: 'claude-mcp-add-global' };
      } catch (addErr) {
        console.error('Failed to add MCP server via claude mcp add -s user:', addErr);

        // Fallback: write to mcp.json
        const claudeDir = path.join(os.homedir(), '.claude');
        const mcpConfigPath = path.join(claudeDir, 'mcp.json');

        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true });
        }

        let mcpConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
        if (fs.existsSync(mcpConfigPath)) {
          try {
            mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
            if (!mcpConfig.mcpServers) {
              mcpConfig.mcpServers = {};
            }
          } catch {
            mcpConfig = { mcpServers: {} };
          }
        }

        mcpConfig.mcpServers!['claude-mgr-orchestrator'] = {
          command: 'node',
          args: [orchestratorPath]
        };

        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        console.log('MCP orchestrator configured via mcp.json fallback');
        return { success: true, path: mcpConfigPath, method: 'mcp-json-fallback' };
      }
    } catch (err) {
      console.error('Failed to setup orchestrator:', err);
      return { success: false, error: String(err) };
    }
  });
}

/**
 * Remove orchestrator from Claude's global configuration
 * This handler allows uninstalling the MCP orchestrator
 */
export function setupOrchestratorRemoveHandler(): void {
  ipcMain.handle('orchestrator:remove', async () => {
    try {
      // Remove from global user scope
      try {
        execSync('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      } catch {
        // Ignore errors if it doesn't exist
      }

      // Also clean up mcp.json fallback if it exists
      const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          if (mcpConfig?.mcpServers?.['claude-mgr-orchestrator']) {
            delete mcpConfig.mcpServers['claude-mgr-orchestrator'];
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
          }
        } catch {
          // Ignore parse errors
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to remove orchestrator:', err);
      return { success: false, error: String(err) };
    }
  });
}

/**
 * Register all MCP orchestrator IPC handlers
 * Call this during app initialization to set up all handlers
 */
export function registerMcpOrchestratorHandlers(): void {
  setupOrchestratorStatusHandler();
  setupOrchestratorSetupHandler();
  setupOrchestratorRemoveHandler();
}
