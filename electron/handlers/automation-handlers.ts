import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================
// Automation IPC handlers
// Interacts with the same storage as MCP tools
// ============================================

const AUTOMATIONS_DIR = path.join(os.homedir(), '.claude-manager');
const AUTOMATIONS_FILE = path.join(AUTOMATIONS_DIR, 'automations.json');
const RUNS_FILE = path.join(AUTOMATIONS_DIR, 'automations-runs.json');

// Types matching MCP tools
interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: {
    type: 'cron' | 'interval';
    cron?: string;
    intervalMinutes?: number;
  };
  source: {
    type: string;
    config: Record<string, unknown>;
  };
  trigger: {
    eventTypes: string[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: string;
  };
  outputs: Array<{
    type: string;
    enabled: boolean;
    template?: string;
  }>;
}

interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  itemsFound: number;
  itemsProcessed: number;
  error?: string;
}

function ensureDir(): void {
  if (!fs.existsSync(AUTOMATIONS_DIR)) {
    fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true });
  }
}

function loadAutomations(): Automation[] {
  ensureDir();
  if (!fs.existsSync(AUTOMATIONS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(AUTOMATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveAutomations(automations: Automation[]): void {
  ensureDir();
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
}

function loadRuns(): AutomationRun[] {
  ensureDir();
  if (!fs.existsSync(RUNS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(RUNS_FILE, 'utf-8');
    return JSON.parse(data).slice(-1000);
  } catch {
    return [];
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Register all automation IPC handlers
 */
export function registerAutomationHandlers(): void {
  // List automations
  ipcMain.handle('automation:list', async () => {
    try {
      const automations = loadAutomations();
      return { automations };
    } catch (err) {
      console.error('Error listing automations:', err);
      return { automations: [], error: err instanceof Error ? err.message : 'Failed to list automations' };
    }
  });

  // Create automation
  ipcMain.handle('automation:create', async (_event, params: {
    name: string;
    description?: string;
    sourceType: string;
    sourceConfig: string; // JSON string
    scheduleMinutes?: number;
    scheduleCron?: string;
    eventTypes?: string[];
    onNewItem?: boolean;
    agentEnabled?: boolean;
    agentPrompt?: string;
    agentProjectPath?: string;
    outputTelegram?: boolean;
    outputSlack?: boolean;
    outputGitHubComment?: boolean;
    outputTemplate?: string;
  }) => {
    try {
      const automations = loadAutomations();

      // Parse source config
      let sourceConfig: Record<string, unknown> = {};
      try {
        sourceConfig = JSON.parse(params.sourceConfig);
      } catch {
        return { success: false, error: 'Invalid source config JSON' };
      }

      // Build schedule
      const schedule: Automation['schedule'] = params.scheduleCron
        ? { type: 'cron', cron: params.scheduleCron }
        : { type: 'interval', intervalMinutes: params.scheduleMinutes || 60 };

      // Build outputs
      const outputs: Automation['outputs'] = [];
      if (params.outputTelegram) {
        outputs.push({ type: 'telegram', enabled: true, template: params.outputTemplate });
      }
      if (params.outputSlack) {
        outputs.push({ type: 'slack', enabled: true, template: params.outputTemplate });
      }
      if (params.outputGitHubComment) {
        outputs.push({ type: 'github_comment', enabled: true, template: params.outputTemplate });
      }

      const newAutomation: Automation = {
        id: generateId(),
        name: params.name,
        description: params.description,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schedule,
        source: {
          type: params.sourceType,
          config: sourceConfig,
        },
        trigger: {
          eventTypes: params.eventTypes || [],
          onNewItem: params.onNewItem ?? true,
        },
        agent: {
          enabled: params.agentEnabled ?? false,
          projectPath: params.agentProjectPath,
          prompt: params.agentPrompt || '',
        },
        outputs,
      };

      automations.push(newAutomation);
      saveAutomations(automations);

      return { success: true, automationId: newAutomation.id };
    } catch (err) {
      console.error('Error creating automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create automation' };
    }
  });

  // Update automation
  ipcMain.handle('automation:update', async (_event, id: string, params: {
    enabled?: boolean;
    name?: string;
  }) => {
    try {
      const automations = loadAutomations();
      const index = automations.findIndex(a => a.id === id);
      if (index === -1) {
        return { success: false, error: 'Automation not found' };
      }

      if (params.enabled !== undefined) {
        automations[index].enabled = params.enabled;
      }
      if (params.name !== undefined) {
        automations[index].name = params.name;
      }
      automations[index].updatedAt = new Date().toISOString();

      saveAutomations(automations);
      return { success: true };
    } catch (err) {
      console.error('Error updating automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update automation' };
    }
  });

  // Delete automation
  ipcMain.handle('automation:delete', async (_event, id: string) => {
    try {
      const automations = loadAutomations();
      const index = automations.findIndex(a => a.id === id);
      if (index === -1) {
        return { success: false, error: 'Automation not found' };
      }

      automations.splice(index, 1);
      saveAutomations(automations);
      return { success: true };
    } catch (err) {
      console.error('Error deleting automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete automation' };
    }
  });

  // Run automation manually (triggers MCP tool via shell)
  ipcMain.handle('automation:run', async (_event, id: string) => {
    try {
      const automations = loadAutomations();
      const automation = automations.find(a => a.id === id);
      if (!automation) {
        return { success: false, error: 'Automation not found' };
      }

      // For now, just return success - the actual running is done via MCP tools
      // The UI can call the MCP tools through the orchestrator
      return { success: true, itemsProcessed: 0, itemsFound: 0 };
    } catch (err) {
      console.error('Error running automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to run automation' };
    }
  });

  // Get automation logs
  ipcMain.handle('automation:getLogs', async (_event, id: string) => {
    try {
      const runs = loadRuns();
      const automationRuns = runs
        .filter(r => r.automationId === id)
        .slice(-20);
      return { runs: automationRuns };
    } catch (err) {
      console.error('Error getting automation logs:', err);
      return { runs: [], error: err instanceof Error ? err.message : 'Failed to get logs' };
    }
  });
}
