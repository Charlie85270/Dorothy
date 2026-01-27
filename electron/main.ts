import { app, BrowserWindow, ipcMain, protocol, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as pty from 'node-pty';

// Get the base path for static assets
function getAppBasePath(): string {
  let appPath = app.getAppPath();
  // If running from asar, the unpacked files are in app.asar.unpacked
  if (appPath.includes('app.asar')) {
    appPath = appPath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(appPath, 'out');
}

// MIME type lookup
const mimeTypes: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// PTY instances for terminals
const ptyProcesses: Map<string, pty.IPty> = new Map();

// Agent state
interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking';

interface AgentStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
  projectPath: string;
  worktreePath?: string;
  branchName?: string;
  skills: string[];
  currentTask?: string;
  output: string[];
  lastActivity: string;
  error?: string;
  ptyId?: string;
  character?: AgentCharacter;
  name?: string;
  pathMissing?: boolean; // True if project path no longer exists
}

const agents: Map<string, AgentStatus> = new Map();

// Patterns to detect Claude Code state from terminal output
const CLAUDE_PATTERNS = {
  // Claude is waiting for user input (shows prompt)
  // Comprehensive list of all Claude Code prompt patterns
  waitingForInput: [
    // === Claude Code prompt indicators (highest priority) ===
    /❯\s*$/m,                            // Chevron at end of line (Claude prompt)
    /❯$/m,                               // Chevron at very end
    /^❯\s*$/m,                           // Chevron on its own line
    /\n❯\s*$/,                           // Chevron after newline at end
    /●.*\n\s*❯/,                         // Response bullet followed by prompt
    /^\s*❯\s/m,                          // Chevron at start of line with space

    // === Claude Code UI indicators ===
    /Esc to cancel/i,                    // Claude Code prompt footer
    /Tab to add additional/i,            // Claude Code prompt footer
    /shift\+Tab/i,                       // Claude Code keyboard hint
    /shift-Tab/i,                        // Alternative format
    /Enter to confirm/i,                 // Confirmation hint
    /Press Enter/i,                      // Press enter prompt

    // === Selection/Menu prompts (inquirer.js style) ===
    /❯\s*\d/,                            // Chevron with number (selected option)
    />\s*\d+\.\s/,                       // "> 1." style selection
    /\(Use arrow keys\)/i,               // Arrow key hint
    /Use arrow keys/i,                   // Arrow key hint variant

    // === Yes/No/Confirmation prompts ===
    /\[Y\/n\]/i,                         // [Y/n] prompt
    /\[y\/N\]/i,                         // [y/N] prompt
    /\(y\/n\)/i,                         // (y/n) prompt
    /\[yes\/no\]/i,                      // [yes/no] prompt
    /\d+\.\s*Yes\b/i,                    // "1. Yes" numbered option
    /\d+\.\s*No\b/i,                     // "2. No" numbered option
    /\d+\.\s*Cancel\b/i,                 // "3. Cancel" numbered option
    /\d+\.\s*Skip\b/i,                   // "4. Skip" numbered option

    // === File operation prompts ===
    /Do you want to create/i,            // Create file prompt
    /Do you want to edit/i,              // Edit file prompt
    /Do you want to delete/i,            // Delete file prompt
    /Do you want to write/i,             // Write file prompt
    /Do you want to read/i,              // Read file prompt
    /Do you want to run/i,               // Run command prompt
    /Do you want to execute/i,           // Execute prompt
    /Do you want to allow/i,             // Permission prompt
    /Do you want to proceed/i,           // Proceed prompt
    /Do you want to continue/i,          // Continue prompt
    /Do you want to overwrite/i,         // Overwrite prompt
    /Do you want to replace/i,           // Replace prompt
    /Do you want to install/i,           // Install prompt
    /Do you want to update/i,            // Update prompt
    /Do you want to remove/i,            // Remove prompt
    /Do you want to/i,                   // Generic "Do you want to" catch-all

    // === Permission/Approval prompts ===
    /Allow this/i,                       // "Allow this edit?"
    /Allow .+ to/i,                      // "Allow X to run?"
    /Approve this/i,                     // Approval prompt
    /Confirm this/i,                     // Confirmation prompt
    /Accept this/i,                      // Accept prompt

    // === Question prompts / Claude asking what to do ===
    /Let me know what/i,                 // "Let me know what you want..."
    /let me know if/i,                   // "Let me know if you need..."
    /What would you like/i,              // "What would you like..."
    /What should I/i,                    // "What should I..."
    /How would you like/i,               // "How would you like..."
    /How can I help/i,                   // "How can I help..."
    /What do you think/i,                // "What do you think..."
    /Which .+ would you/i,               // "Which option would you..."
    /Which .+ should/i,                  // "Which file should..."
    /Would you like to/i,                // "Would you like to..."
    /Would you like me to/i,             // "Would you like me to..."
    /Should I\s/i,                       // "Should I..."
    /Can I\s/i,                          // "Can I..."
    /May I\s/i,                          // "May I..."
    /Shall I\s/i,                        // "Shall I..."
    /What else/i,                        // "What else would you like..."
    /Anything else/i,                    // "Anything else?"
    /Is there anything/i,                // "Is there anything else..."

    // === Input prompts ===
    /Enter your/i,                       // "Enter your message..."
    /Enter a /i,                         // "Enter a value..."
    /Type your/i,                        // "Type your response..."
    /Input:/i,                           // "Input:" prompt
    /Provide /i,                         // "Provide a value..."
    /Specify /i,                         // "Specify the..."
    /Choose /i,                          // "Choose an option..."
    /Select /i,                          // "Select a file..."
    /Pick /i,                            // "Pick one..."

    // === Wait/Ready indicators ===
    /waiting for/i,                      // "Waiting for input"
    /ready for/i,                        // "Ready for your input"
    /awaiting/i,                         // "Awaiting response"

    // === Bash/Terminal prompts ===
    /\$\s*$/m,                           // Shell prompt "$"
    />\s*$/m,                            // Simple prompt ">"
  ],
  // Claude is actively working (spinner or progress)
  // These patterns indicate Claude is processing, not waiting for input
  working: [
    // === Spinner characters (highest confidence) ===
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,  // Braille spinner characters
    /◐|◓|◑|◒/,                  // Circle spinner
    /⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/,        // Dot spinner

    // === Progress indicators with "..." ===
    /Thinking\.\.\./i,
    /Working\.\.\./i,
    /Analyzing\.\.\./i,
    /Processing\.\.\./i,
    /Generating\.\.\./i,
    /Loading\.\.\./i,
    /Fetching\.\.\./i,
    /Compiling\.\.\./i,
    /Building\.\.\./i,

    // === Active operation messages (must have context) ===
    /Reading .+\.\.\./i,         // "Reading file..."
    /Writing .+\.\.\./i,         // "Writing to file..."
    /Searching .+\.\.\./i,       // "Searching in..."
    /Running .+\.\.\./i,         // "Running command..."
    /Executing .+\.\.\./i,       // "Executing..."
    /Installing .+\.\.\./i,      // "Installing package..."
    /Updating .+\.\.\./i,        // "Updating..."
    /Creating .+\.\.\./i,        // "Creating file..."
    /Downloading .+\.\.\./i,     // "Downloading..."
    /Uploading .+\.\.\./i,       // "Uploading..."
  ],
  // Claude finished a task (look for these in recent output)
  completed: [
    /Task completed/i,
    /Done!/i,
    /Finished!/i,
    /Complete!/i,
    /Successfully/i,
    /✓/,                        // Checkmark
    /✔/,                        // Another checkmark
    /\[done\]/i,
    /Worked for \d+/i,          // "Worked for 38s" - Claude Code completion indicator
    /\* Worked for/i,           // "* Worked for" variant
  ],
  // Claude encountered an error
  error: [
    /Error:/i,
    /Failed:/i,
    /Exception:/i,
    /FATAL/i,
    /✗/,                        // X mark
    /✘/,                        // Another X mark
    /\[error\]/i,
    /Permission denied/i,
    /not found/i,
  ],
};

// App settings stored in our own config
interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
}

// Note: APP_SETTINGS_FILE is defined after DATA_DIR below

// Send native notification
function sendNotification(title: string, body: string, agentId?: string) {
  if (!appSettings.notificationsEnabled) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    // Bring window to focus and select agent if specified
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (agentId) {
        mainWindow.webContents.send('agent:focus', { agentId });
      }
    }
  });

  notification.show();
}

// Track previous status to detect changes
const previousAgentStatus: Map<string, string> = new Map();

// Track pending status changes with 5-second debounce
const pendingStatusChanges: Map<string, {
  newStatus: string;
  scheduledAt: number;
  timeoutId: NodeJS.Timeout;
}> = new Map();

// Handle status change notifications with 5-second debounce
// This prevents spam from rapid status changes during agent operation
function handleStatusChangeNotification(agent: AgentStatus, newStatus: string) {
  const prevStatus = previousAgentStatus.get(agent.id);

  // Don't notify on first status set
  if (!prevStatus) {
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  // Don't notify if status didn't change
  if (prevStatus === newStatus) {
    // Clear any pending notification for this status since we're staying in it
    return;
  }

  // For "running" status, update immediately without notification (no debounce needed)
  if (newStatus === 'running') {
    // Clear any pending status change since agent is actively working now
    const pending = pendingStatusChanges.get(agent.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingStatusChanges.delete(agent.id);
    }
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  // For other statuses (waiting, completed, error), use 5-second debounce
  // This ensures the agent has truly settled into this state
  const pending = pendingStatusChanges.get(agent.id);

  // If we already have a pending change to this same status, let it continue
  if (pending && pending.newStatus === newStatus) {
    return;
  }

  // Clear any existing pending change (we're changing to a different status)
  if (pending) {
    clearTimeout(pending.timeoutId);
  }

  // Schedule the notification for 5 seconds from now
  const timeoutId = setTimeout(() => {
    pendingStatusChanges.delete(agent.id);

    // Re-check the current agent status - if it changed, don't notify
    const currentAgent = agents.get(agent.id);
    if (!currentAgent || currentAgent.status !== newStatus) {
      return;
    }

    // Update previous status and send notification
    previousAgentStatus.set(agent.id, newStatus);

    const agentName = currentAgent.name || `Agent ${currentAgent.id.slice(0, 6)}`;

    if (newStatus === 'waiting' && appSettings.notifyOnWaiting) {
      sendNotification(
        `${agentName} needs your attention`,
        'The agent is waiting for your input.',
        currentAgent.id
      );
    } else if (newStatus === 'completed' && appSettings.notifyOnComplete) {
      sendNotification(
        `${agentName} completed`,
        currentAgent.currentTask ? `Finished: ${currentAgent.currentTask.slice(0, 50)}...` : 'Task completed successfully.',
        currentAgent.id
      );
    } else if (newStatus === 'error' && appSettings.notifyOnError) {
      sendNotification(
        `${agentName} encountered an error`,
        currentAgent.error || 'An error occurred while running.',
        currentAgent.id
      );
    }
  }, 5000); // 5 second debounce

  pendingStatusChanges.set(agent.id, {
    newStatus,
    scheduledAt: Date.now(),
    timeoutId,
  });
}

// Detect agent status from recent output
function detectAgentStatus(agent: AgentStatus): 'running' | 'waiting' | 'completed' | 'error' | 'idle' {
  // Get the very last output chunk (most recent)
  const lastChunk = agent.output.slice(-1).join('');
  // Get last few chunks for context (more chunks to catch full prompts)
  const recentChunks = agent.output.slice(-10).join('');
  // Get more context for detecting working state
  const extendedContext = agent.output.slice(-30).join('');

  // Strip ANSI escape codes for more reliable matching
  const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const cleanLastChunk = stripAnsi(lastChunk);
  const cleanRecentChunks = stripAnsi(recentChunks);
  const cleanExtendedContext = stripAnsi(extendedContext);

  // Check for active spinners FIRST in the LAST chunk (spinners = actively working)
  const spinnerPattern = /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|◐|◓|◑|◒|⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/;
  if (spinnerPattern.test(cleanLastChunk)) {
    return 'running';
  }

  // Check for working progress messages in last chunk
  for (const pattern of CLAUDE_PATTERNS.working) {
    if (pattern.test(cleanLastChunk)) {
      return 'running';
    }
  }

  // Check for error patterns first (before waiting/completed)
  for (const pattern of CLAUDE_PATTERNS.error) {
    if (pattern.test(cleanRecentChunks)) {
      return 'error';
    }
  }

  // === IMPROVED WAITING DETECTION ===
  // Only mark as "waiting" if Claude is ACTUALLY asking for user input/selection
  // This means there must be a question or selection prompt, not just a command prompt

  // Patterns that indicate Claude is asking the user to choose/confirm something
  const userInputPatterns = [
    // Yes/No prompts (highest priority - these need user action)
    /\[Y\/n\]/i,
    /\[y\/N\]/i,
    /\(y\/n\)/i,
    /\[yes\/no\]/i,

    // Claude Code specific prompts for accepting edits/commits
    /accept edits/i,                       // "accept edits on (shift+Tab to cycle)"
    /shift\+?Tab to cycle/i,               // The cycling hint
    />\s*Commit this/i,                    // "> Commit this" prompt
    /❯\s*Commit/i,                         // "❯ Commit" prompt
    /Press Enter to/i,                     // Press enter prompts
    /\(enter to confirm\)/i,               // Enter confirmation
    /\(esc to cancel\)/i,                  // Esc to cancel hints

    // Selection/Menu prompts with numbered options
    /\d+\.\s*(Yes|No|Cancel|Skip|Allow|Deny|Accept|Reject)\b/i,
    /❯\s*\d+\./,                           // Chevron with numbered selection
    />\s*\d+\.\s/,                         // "> 1." style selection
    /\(Use arrow keys\)/i,                 // Selection menu hint

    // Permission/Approval prompts (Claude asking to do something)
    /Do you want to (create|edit|delete|write|read|run|execute|allow|proceed|continue|overwrite|replace|install|update|remove)/i,
    /Allow this/i,
    /Allow .+ to/i,
    /Approve this/i,
    /Confirm this/i,

    // Direct questions requiring user decision
    /What would you like/i,
    /What should I/i,
    /How would you like/i,
    /Which .+ would you/i,
    /Which .+ should/i,
    /Would you like to/i,
    /Would you like me to/i,
    /Should I\s/i,
    /Shall I\s/i,

    // Selection prompts
    /Choose /i,
    /Select /i,
    /Pick /i,
  ];

  // Check if there's an actual user input prompt
  let hasUserInputPrompt = false;
  for (const pattern of userInputPatterns) {
    if (pattern.test(cleanRecentChunks) || pattern.test(cleanExtendedContext)) {
      hasUserInputPrompt = true;
      break;
    }
  }

  // Only return "waiting" if we found an actual question/selection prompt
  if (hasUserInputPrompt) {
    return 'waiting';
  }

  // Patterns that indicate Claude finished and is back to idle prompt
  // These are prompts WITHOUT an accompanying question
  const idlePromptPatterns = [
    /❯\s*$/m,                              // Just the chevron prompt at end
    /^\s*❯\s*$/m,                          // Chevron on its own line
    /\$\s*$/m,                             // Shell prompt at end
  ];

  // Check for completion patterns
  for (const pattern of CLAUDE_PATTERNS.completed) {
    if (pattern.test(cleanRecentChunks)) {
      return 'completed';
    }
  }

  // If we see just a prompt (❯ or $) without a question, Claude is done/idle
  for (const pattern of idlePromptPatterns) {
    if (pattern.test(cleanRecentChunks)) {
      // Make sure there's no active work happening
      const now = Date.now();
      const lastActivityTime = new Date(agent.lastActivity).getTime();
      const timeSinceActivity = now - lastActivityTime;

      // If no activity for more than 2 seconds and just showing prompt, it's completed
      if (timeSinceActivity > 2000) {
        return 'completed';
      }
    }
  }

  // If we have recent output but no clear indicator:
  // - If there was activity in the last few seconds, assume running
  // - Otherwise keep current status
  const now = Date.now();
  const lastActivityTime = new Date(agent.lastActivity).getTime();
  const timeSinceActivity = now - lastActivityTime;

  // If activity within last 2 seconds, likely still running
  if (timeSinceActivity < 2000 && agent.output.length > 0) {
    if (agent.status === 'idle' || agent.status === 'completed') {
      // New activity on an idle/completed agent means it's running again
      return 'running';
    }
    return agent.status === 'error' ? 'error' : 'running';
  }

  // Keep current status if no clear indicator
  return agent.status;
}

// ============== Agent Persistence ==============

const DATA_DIR = path.join(os.homedir(), '.claude-manager');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const APP_SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// App settings functions
function loadAppSettings(): AppSettings {
  try {
    if (fs.existsSync(APP_SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(APP_SETTINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load app settings:', err);
  }
  // Default settings
  return {
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
  };
}

function saveAppSettings(settings: AppSettings) {
  try {
    ensureDataDir();
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save app settings:', err);
  }
}

let appSettings = loadAppSettings();

// Track if agents have been loaded (to prevent saving empty state before load)
let agentsLoaded = false;

// Save agents to disk
function saveAgents() {
  try {
    // Don't save if agents haven't been loaded yet (prevents wiping data on early calls)
    if (!agentsLoaded) {
      console.log('Skipping save - agents not loaded yet');
      return;
    }

    ensureDataDir();
    const agentsArray = Array.from(agents.values()).map(agent => ({
      ...agent,
      // Don't persist runtime-only fields
      ptyId: undefined,
      pathMissing: undefined, // Recalculated on load
      // Limit output to last 100 entries to avoid huge files
      output: agent.output.slice(-100),
      // Reset running status to idle on save (will be restarted manually)
      status: agent.status === 'running' ? 'idle' : agent.status,
    }));

    // Create backup before saving if file exists and has content
    if (fs.existsSync(AGENTS_FILE)) {
      const existingContent = fs.readFileSync(AGENTS_FILE, 'utf-8');
      if (existingContent.trim().length > 2) { // More than just "[]"
        const backupFile = path.join(DATA_DIR, 'agents.backup.json');
        fs.writeFileSync(backupFile, existingContent);
      }
    }

    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsArray, null, 2));
    console.log(`Saved ${agentsArray.length} agents to disk`);
  } catch (err) {
    console.error('Failed to save agents:', err);
  }
}

// Load agents from disk
function loadAgents() {
  try {
    if (!fs.existsSync(AGENTS_FILE)) {
      console.log('No agents file found, starting fresh');
      agentsLoaded = true;
      return;
    }

    const data = fs.readFileSync(AGENTS_FILE, 'utf-8');

    // Handle empty file
    if (!data.trim() || data.trim() === '[]') {
      console.log('Agents file is empty, checking for backup...');
      // Try to restore from backup
      const backupFile = path.join(DATA_DIR, 'agents.backup.json');
      if (fs.existsSync(backupFile)) {
        const backupData = fs.readFileSync(backupFile, 'utf-8');
        if (backupData.trim() && backupData.trim() !== '[]') {
          console.log('Restoring agents from backup...');
          fs.writeFileSync(AGENTS_FILE, backupData);
          // Re-read the restored file
          loadAgents();
          return;
        }
      }
      agentsLoaded = true;
      return;
    }

    const agentsArray = JSON.parse(data) as AgentStatus[];

    for (const agent of agentsArray) {
      // Check if project path still exists - but NEVER skip agents!
      // Just mark them as having a missing path so UI can show warning
      const workingPath = agent.worktreePath || agent.projectPath;
      if (!fs.existsSync(workingPath)) {
        console.warn(`Agent ${agent.id} has missing path: ${workingPath} - marking as pathMissing`);
        agent.pathMissing = true;
      } else {
        agent.pathMissing = false;
      }

      // Reset status to idle since PTY is not running
      agent.status = 'idle';
      agent.ptyId = undefined;

      agents.set(agent.id, agent);
    }

    console.log(`Loaded ${agents.size} agents from disk`);
    agentsLoaded = true;
  } catch (err) {
    console.error('Failed to load agents:', err);
    agentsLoaded = true; // Still set to true to allow new agents to be saved
  }
}

// Initialize a PTY for a restored agent
async function initAgentPty(agent: AgentStatus): Promise<string> {
  const shell = process.env.SHELL || '/bin/zsh';
  const cwd = agent.worktreePath || agent.projectPath;

  console.log(`Initializing PTY for restored agent ${agent.id} in ${cwd}`);

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: {
      ...process.env as { [key: string]: string },
      CLAUDE_SKILLS: agent.skills.join(','),
    },
  });

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    const agentData = agents.get(agent.id);
    if (agentData) {
      agentData.output.push(data);
      agentData.lastActivity = new Date().toISOString();

      // Check if agent was manually stopped recently (within 3 seconds)
      // If so, don't override the status with detection
      const manuallyStoppedAt = (agentData as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt;
      const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;

      if (!wasRecentlyStopped) {
        // Detect status changes when we receive output
        // This ensures we catch prompts even if the agent was marked as completed/idle
        const newStatus = detectAgentStatus(agentData);
        if (newStatus !== agentData.status) {
          agentData.status = newStatus;
          // Send notification
          handleStatusChangeNotification(agentData, newStatus);
          // Send status change event
          mainWindow?.webContents.send('agent:status', {
            type: 'status',
            agentId: agent.id,
            status: newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    mainWindow?.webContents.send('agent:output', {
      type: 'output',
      agentId: agent.id,
      ptyId,
      data,
      timestamp: new Date().toISOString(),
    });
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Agent ${agent.id} PTY exited with code ${exitCode}`);
    const agentData = agents.get(agent.id);
    if (agentData) {
      const newStatus = exitCode === 0 ? 'completed' : 'error';
      agentData.status = newStatus;
      agentData.lastActivity = new Date().toISOString();
      // Send notification
      handleStatusChangeNotification(agentData, newStatus);
      saveAgents();
    }
    ptyProcesses.delete(ptyId);
    mainWindow?.webContents.send('agent:complete', {
      type: 'complete',
      agentId: agent.id,
      ptyId,
      exitCode,
      timestamp: new Date().toISOString(),
    });
  });

  return ptyId;
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'claude.mgr',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the Next.js app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use the custom app:// protocol to properly serve static files
    // This fixes issues with absolute paths like /logo.png not resolving correctly
    mainWindow.loadURL('app://-/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle loading errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
}

// Register custom protocol for serving static files
// This must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(() => {
  // Load persisted agents before creating window
  loadAgents();

  // Register the app:// protocol handler
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    const basePath = getAppBasePath();
    console.log('Registering app:// protocol with basePath:', basePath);

    protocol.handle('app', (request) => {
      let urlPath = request.url.replace('app://', '');

      // Remove the host part (e.g., "localhost" or "-")
      const slashIndex = urlPath.indexOf('/');
      if (slashIndex !== -1) {
        urlPath = urlPath.substring(slashIndex);
      } else {
        urlPath = '/';
      }

      // Default to index.html for directory requests
      if (urlPath === '/' || urlPath === '') {
        urlPath = '/index.html';
      }

      // Handle page routes (e.g., /agents/, /settings/) - serve their index.html
      if (urlPath.endsWith('/')) {
        urlPath = urlPath + 'index.html';
      }

      // Remove leading slash for path.join
      const relativePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
      const filePath = path.join(basePath, relativePath);

      console.log(`app:// request: ${request.url} -> ${filePath}`);

      // Check if file exists
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(fs.readFileSync(filePath), {
          headers: { 'Content-Type': mimeType },
        });
      }

      // If it's a page route without .html, try adding index.html
      const htmlPath = path.join(basePath, relativePath, 'index.html');
      if (fs.existsSync(htmlPath)) {
        return new Response(fs.readFileSync(htmlPath), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      console.error(`File not found: ${filePath}`);
      return new Response('Not Found', { status: 404 });
    });
  }

  createWindow();
});

app.on('window-all-closed', () => {
  // Save agents before quitting
  saveAgents();

  // Kill all PTY processes
  ptyProcesses.forEach((ptyProcess) => {
    ptyProcess.kill();
  });
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save agents when app is about to quit
app.on('before-quit', () => {
  saveAgents();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============== PTY Terminal IPC Handlers ==============

// Create a new PTY terminal
ipcMain.handle('pty:create', async (_event, { cwd, cols, rows }: { cwd?: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env as { [key: string]: string },
  });

  ptyProcesses.set(id, ptyProcess);

  // Send data from PTY to renderer
  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('pty:data', { id, data });
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('pty:exit', { id, exitCode });
    ptyProcesses.delete(id);
  });

  return { id };
});

// Write to PTY
ipcMain.handle('pty:write', async (_event, { id, data }: { id: string; data: string }) => {
  const ptyProcess = ptyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize PTY
ipcMain.handle('pty:resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const ptyProcess = ptyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill PTY
ipcMain.handle('pty:kill', async (_event, { id }: { id: string }) => {
  const ptyProcess = ptyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcesses.delete(id);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// ============== Agent Management IPC Handlers ==============

// Create a new agent (now creates a PTY-backed terminal)
ipcMain.handle('agent:create', async (_event, config: {
  projectPath: string;
  skills: string[];
  worktree?: WorktreeConfig;
  character?: AgentCharacter;
  name?: string;
}) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  // Validate project path exists
  let cwd = config.projectPath;
  if (!fs.existsSync(cwd)) {
    console.warn(`Project path does not exist: ${cwd}, using home directory`);
    cwd = os.homedir();
  }

  let worktreePath: string | undefined;
  let branchName: string | undefined;

  // Create git worktree if enabled
  if (config.worktree?.enabled && config.worktree?.branchName) {
    branchName = config.worktree.branchName;
    const worktreesDir = path.join(cwd, '.worktrees');
    worktreePath = path.join(worktreesDir, branchName);

    console.log(`Creating git worktree for agent ${id} at ${worktreePath} on branch ${branchName}`);

    try {
      // Create .worktrees directory if it doesn't exist
      if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
      }

      // Check if worktree already exists
      if (fs.existsSync(worktreePath)) {
        console.log(`Worktree already exists at ${worktreePath}, reusing it`);
      } else {
        // Create the worktree with a new branch
        const { execSync } = await import('child_process');

        // Check if branch already exists
        try {
          execSync(`git rev-parse --verify ${branchName}`, { cwd, stdio: 'pipe' });
          // Branch exists, create worktree using existing branch
          execSync(`git worktree add "${worktreePath}" ${branchName}`, { cwd, stdio: 'pipe' });
          console.log(`Created worktree using existing branch ${branchName}`);
        } catch {
          // Branch doesn't exist, create worktree with new branch
          execSync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd, stdio: 'pipe' });
          console.log(`Created worktree with new branch ${branchName}`);
        }
      }

      // Use the worktree path as the working directory
      cwd = worktreePath;
    } catch (err) {
      console.error(`Failed to create git worktree:`, err);
      // Continue without worktree if creation fails
      worktreePath = undefined;
      branchName = undefined;
    }
  }

  console.log(`Creating PTY for agent ${id} with shell ${shell} in ${cwd}`);

  // Create PTY for this agent
  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: {
        ...process.env as { [key: string]: string },
        CLAUDE_SKILLS: config.skills.join(','),
      },
    });
    console.log(`PTY created successfully for agent ${id}, PID: ${ptyProcess.pid}`);
  } catch (err) {
    console.error(`Failed to create PTY for agent ${id}:`, err);
    throw err;
  }

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  const status: AgentStatus = {
    id,
    status: 'idle',
    projectPath: config.projectPath,
    worktreePath,
    branchName,
    skills: config.skills,
    output: [],
    lastActivity: new Date().toISOString(),
    ptyId,
    character: config.character || 'robot',
    name: config.name || `Agent ${id.slice(0, 4)}`,
  };
  agents.set(id, status);

  // Save agents to disk
  saveAgents();

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    const agent = agents.get(id);
    if (agent) {
      agent.output.push(data);
      agent.lastActivity = new Date().toISOString();

      // Check if agent was manually stopped recently (within 3 seconds)
      // If so, don't override the status with detection
      const manuallyStoppedAt = (agent as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt;
      const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;

      if (!wasRecentlyStopped) {
        // Detect status changes when we receive output
        const newStatus = detectAgentStatus(agent);
        if (newStatus !== agent.status) {
          agent.status = newStatus;
          // Send notification
          handleStatusChangeNotification(agent, newStatus);
          // Send status change event
          mainWindow?.webContents.send('agent:status', {
            type: 'status',
            agentId: id,
            status: newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    mainWindow?.webContents.send('agent:output', {
      type: 'output',
      agentId: id,
      ptyId,
      data,
      timestamp: new Date().toISOString(),
    });
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Agent ${id} PTY exited with code ${exitCode}`);
    const agent = agents.get(id);
    if (agent) {
      const newStatus = exitCode === 0 ? 'completed' : 'error';
      agent.status = newStatus;
      agent.lastActivity = new Date().toISOString();
      // Send notification
      handleStatusChangeNotification(agent, newStatus);
    }
    // Remove PTY from map since it's exited
    ptyProcesses.delete(ptyId);
    mainWindow?.webContents.send('agent:complete', {
      type: 'complete',
      agentId: id,
      ptyId,
      exitCode,
      timestamp: new Date().toISOString(),
    });
  });

  return { ...status, ptyId };
});

// Start an agent with a prompt (sends command to PTY)
ipcMain.handle('agent:start', async (_event, { id, prompt, options }: {
  id: string;
  prompt: string;
  options?: { model?: string; resume?: boolean }
}) => {
  const agent = agents.get(id);
  if (!agent) throw new Error('Agent not found');

  // Initialize PTY if agent was restored from disk and doesn't have one
  if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
    console.log(`Agent ${id} needs PTY initialization`);
    const ptyId = await initAgentPty(agent);
    agent.ptyId = ptyId;
  }

  const ptyProcess = ptyProcesses.get(agent.ptyId);
  if (!ptyProcess) throw new Error('PTY not found');

  // Build Claude Code command
  let command = 'claude';

  if (options?.model) {
    command += ` --model ${options.model}`;
  }

  if (options?.resume) {
    command += ' --resume';
  }

  // Add the prompt (escape single quotes)
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  command += ` '${escapedPrompt}'`;

  // Update status
  agent.status = 'running';
  agent.currentTask = prompt.slice(0, 100);
  agent.lastActivity = new Date().toISOString();

  // First cd to the appropriate directory (worktree if exists, otherwise project), then run claude
  const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
  ptyProcess.write(`cd '${workingPath}' && ${command}\r`);

  // Save updated status
  saveAgents();

  return { success: true };
});

// Get agent status
ipcMain.handle('agent:get', async (_event, id: string) => {
  const agent = agents.get(id);
  if (!agent) return null;

  // Initialize PTY if agent was restored from disk and doesn't have one
  if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
    console.log(`Initializing PTY for agent ${id} on get`);
    const ptyId = await initAgentPty(agent);
    agent.ptyId = ptyId;
  }

  return agent;
});

// Get all agents
ipcMain.handle('agent:list', async () => {
  return Array.from(agents.values());
});

// Stop an agent
ipcMain.handle('agent:stop', async (_event, id: string) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      // Send Ctrl+C to interrupt
      ptyProcess.write('\x03');
    }
    agent.status = 'idle';
    agent.currentTask = undefined;
    agent.lastActivity = new Date().toISOString();
    // Mark as manually stopped to prevent status detection from overriding
    (agent as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt = Date.now();
    saveAgents();

    // Send status change notification to frontend immediately
    mainWindow?.webContents.send('agent:status', {
      type: 'status',
      agentId: id,
      status: 'idle',
      timestamp: new Date().toISOString(),
    });
  }
  return { success: true };
});

// Remove an agent
ipcMain.handle('agent:remove', async (_event, id: string) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcesses.delete(agent.ptyId);
    }
  }

  // Clean up worktree if it exists
  if (agent?.worktreePath && agent?.branchName) {
    try {
      const { execSync } = await import('child_process');
      console.log(`Removing worktree at ${agent.worktreePath}`);
      execSync(`git worktree remove "${agent.worktreePath}" --force`, { cwd: agent.projectPath, stdio: 'pipe' });
      console.log(`Worktree removed successfully`);
    } catch (err) {
      console.warn(`Failed to remove worktree:`, err);
      // Continue even if worktree removal fails
    }
  }

  agents.delete(id);

  // Save agents to disk
  saveAgents();

  return { success: true };
});

// Send input to an agent
ipcMain.handle('agent:input', async (_event, { id, input }: { id: string; input: string }) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      try {
        ptyProcess.write(input);
        return { success: true };
      } catch (err) {
        console.error('Failed to write to PTY:', err);
        return { success: false, error: 'Failed to write to PTY' };
      }
    }
  }
  return { success: false, error: 'PTY not found' };
});

// Resize agent PTY
ipcMain.handle('agent:resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
        return { success: true };
      } catch (err) {
        console.error('Failed to resize PTY:', err);
        return { success: false, error: 'Failed to resize PTY' };
      }
    }
  }
  return { success: false, error: 'PTY not found' };
});

// ============== Skills IPC Handlers ==============

// Store for skill installation PTYs
const skillPtyProcesses: Map<string, pty.IPty> = new Map();

// Start skill installation (creates interactive PTY)
ipcMain.handle('skill:install-start', async (_event, { repo, cols, rows }: { repo: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  skillPtyProcesses.set(id, ptyProcess);

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('skill:pty-data', { id, data });
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('skill:pty-exit', { id, exitCode });
    skillPtyProcesses.delete(id);
  });

  // Send the install command after a short delay to let shell initialize
  // Parse repo to get the GitHub URL and skill name
  // Format: "owner/repo/skill-name" or "owner/repo" for full repo install
  const parts = repo.split('/');
  let command: string;
  if (parts.length >= 3) {
    // Has skill name: owner/repo/skill-name
    const repoPath = `${parts[0]}/${parts[1]}`;
    const skillName = parts.slice(2).join('/');
    command = `npx skills add https://github.com/${repoPath} --skill ${skillName}`;
  } else {
    // Just repo: owner/repo (install all skills from repo)
    command = `npx skills add https://github.com/${repo}`;
  }
  setTimeout(() => {
    ptyProcess.write(`${command}\r`);
  }, 500);

  return { id, repo };
});

// Write to skill installation PTY
ipcMain.handle('skill:install-write', async (_event, { id, data }: { id: string; data: string }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize skill installation PTY
ipcMain.handle('skill:install-resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill skill installation PTY
ipcMain.handle('skill:install-kill', async (_event, { id }: { id: string }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.kill();
    skillPtyProcesses.delete(id);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Legacy install (kept for backwards compatibility)
ipcMain.handle('skill:install', async (_event, repo: string) => {
  // Just start the installation and return immediately
  // The actual interaction happens via skill:install-start
  return { success: true, message: 'Use skill:install-start for interactive installation' };
});

// Get installed skills from Claude config
ipcMain.handle('skill:list-installed', async () => {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      // Skills are stored in enabledPlugins as "skill-name@source": true/false
      if (settings.enabledPlugins) {
        return Object.keys(settings.enabledPlugins)
          .filter(key => settings.enabledPlugins[key]) // Only enabled ones
          .map(key => key.split('@')[0]); // Extract skill name before @
      }
      return [];
    }
    return [];
  } catch {
    return [];
  }
});

// ============== Claude Data IPC Handlers ==============

// Read Claude Code settings
async function getClaudeSettings() {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return null;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return null;
  }
}

// Read Claude Code stats
async function getClaudeStats() {
  try {
    // Primary stats are in stats-cache.json
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (fs.existsSync(statsCachePath)) {
      const statsCache = JSON.parse(fs.readFileSync(statsCachePath, 'utf-8'));
      return statsCache;
    }

    // Fallback to statsig_user_metadata.json if it exists
    const statsPath = path.join(os.homedir(), '.claude', 'statsig_user_metadata.json');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }

    return null;
  } catch {
    return null;
  }
}

// Read Claude Code projects
async function getClaudeProjects() {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return [];

    const projects: Array<{
      id: string;
      path: string;
      name: string;
      sessions: Array<{ id: string; timestamp: number }>;
      lastAccessed: number;
    }> = [];

    // Smart path decoding: Claude encodes paths by replacing / with -
    // But folder names can contain -, so we need to find the actual path
    const decodeClaudePath = (encoded: string): string => {
      const parts = encoded.split('-').filter(Boolean);

      // Recursive function to try all combinations
      const tryDecode = (index: number, currentPath: string): string | null => {
        if (index >= parts.length) {
          return fs.existsSync(currentPath) ? currentPath : null;
        }

        // Try adding with slash first (new directory)
        const withSlash = currentPath + '/' + parts[index];
        if (fs.existsSync(withSlash)) {
          const result = tryDecode(index + 1, withSlash);
          if (result) return result;
        }

        // Try combining remaining parts with dashes
        // This handles cases like "frontend-lite" being split into ["frontend", "lite"]
        for (let end = index + 1; end <= parts.length; end++) {
          const combined = parts.slice(index, end).join('-');
          const withCombined = currentPath + '/' + combined;

          if (fs.existsSync(withCombined)) {
            if (end === parts.length) {
              return withCombined;
            }
            const result = tryDecode(end, withCombined);
            if (result) return result;
          }
        }

        return null;
      };

      // Start with empty path (will add leading /)
      const result = tryDecode(0, '');

      if (result) return result;

      // Fallback to simple decode if nothing found
      let decoded = '/' + parts.join('/');
      return decoded;
    };

    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      const fullPath = path.join(projectsDir, dir);
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) continue;

      // Decode project path smartly
      const decodedPath = decodeClaudePath(dir);

      // Get sessions
      const sessions: Array<{ id: string; timestamp: number }> = [];
      const files = fs.readdirSync(fullPath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          const fileStat = fs.statSync(path.join(fullPath, file));
          sessions.push({ id: sessionId, timestamp: fileStat.mtimeMs });
        }
      }

      projects.push({
        id: dir,
        path: decodedPath,
        name: path.basename(decodedPath),
        sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
        lastAccessed: stat.mtimeMs,
      });
    }

    return projects.sort((a, b) => b.lastAccessed - a.lastAccessed);
  } catch {
    return [];
  }
}

// Read Claude Code plugins
async function getClaudePlugins() {
  try {
    const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(pluginsPath)) return [];
    const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Read skill metadata from a path
function readSkillMetadata(skillPath: string): { name: string; description?: string } | null {
  try {
    const metadataPath = path.join(skillPath, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      return { name: metadata.name || path.basename(skillPath), description: metadata.description };
    }
    return { name: path.basename(skillPath) };
  } catch {
    return { name: path.basename(skillPath) };
  }
}

// Read Claude Code skills
async function getClaudeSkills() {
  const skills: Array<{
    name: string;
    source: 'project' | 'user' | 'plugin';
    path: string;
    description?: string;
    projectName?: string;
  }> = [];

  // User skills from ~/.claude/skills
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    const entries = fs.readdirSync(userSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(userSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          skills.push({
            name: metadata.name,
            source: 'user',
            path: realPath,
            description: metadata.description,
          });
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // Plugin skills from installed_plugins.json
  const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(pluginsPath)) {
    try {
      const plugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
      if (Array.isArray(plugins)) {
        for (const plugin of plugins) {
          skills.push({
            name: plugin.name || 'Unknown Plugin',
            source: 'plugin',
            path: plugin.path || '',
            description: plugin.description,
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return skills;
}

// Read Claude Code history
async function getClaudeHistory(limit = 50) {
  try {
    const historyPath = path.join(os.homedir(), '.claude', '.history');
    if (!fs.existsSync(historyPath)) return [];

    const content = fs.readFileSync(historyPath, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean);

    return entries.slice(-limit).reverse().map((line) => {
      const [display, timestampStr, project] = line.split('\t');
      return {
        display: display || '',
        timestamp: parseInt(timestampStr || '0', 10),
        project: project || undefined,
      };
    });
  } catch {
    return [];
  }
}

// Get all Claude data
ipcMain.handle('claude:getData', async () => {
  try {
    const [settings, stats, projects, plugins, skills, history] = await Promise.all([
      getClaudeSettings(),
      getClaudeStats(),
      getClaudeProjects(),
      getClaudePlugins(),
      getClaudeSkills(),
      getClaudeHistory(50),
    ]);

    return {
      settings,
      stats,
      projects,
      plugins,
      skills,
      history,
      activeSessions: [],
    };
  } catch (err) {
    console.error('Failed to get Claude data:', err);
    return null;
  }
});

// ============== Settings IPC Handlers ==============

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

// Get Claude settings
ipcMain.handle('settings:get', async () => {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {
        enabledPlugins: {},
        env: {},
        hooks: {},
        includeCoAuthoredBy: false,
        permissions: { allow: [], deny: [] },
      };
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to read settings:', err);
    return null;
  }
});

// Save Claude settings
ipcMain.handle('settings:save', async (_event, settings: {
  enabledPlugins?: Record<string, boolean>;
  env?: Record<string, string>;
  hooks?: Record<string, unknown>;
  includeCoAuthoredBy?: boolean;
  permissions?: { allow: string[]; deny: string[] };
}) => {
  try {
    // Read existing settings first
    let existingSettings = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      existingSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }

    // Merge with new settings
    const newSettings = { ...existingSettings, ...settings };

    // Write back
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
    return { success: true };
  } catch (err) {
    console.error('Failed to save settings:', err);
    return { success: false, error: String(err) };
  }
});

// Get Claude info (version, paths, etc.)
ipcMain.handle('settings:getInfo', async () => {
  try {
    const { execSync } = await import('child_process');

    // Try to get Claude version
    let claudeVersion = 'Unknown';
    try {
      claudeVersion = execSync('claude --version 2>/dev/null', { encoding: 'utf-8' }).trim();
    } catch {
      // Claude not installed or not in PATH
    }

    return {
      claudeVersion,
      configPath: path.join(os.homedir(), '.claude'),
      settingsPath: SETTINGS_PATH,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };
  } catch (err) {
    console.error('Failed to get info:', err);
    return null;
  }
});

// ============== App Settings IPC Handlers (Notifications) ==============

// Get app settings (notifications, etc.)
ipcMain.handle('app:getSettings', async () => {
  return appSettings;
});

// Save app settings
ipcMain.handle('app:saveSettings', async (_event, newSettings: Partial<AppSettings>) => {
  try {
    appSettings = { ...appSettings, ...newSettings };
    saveAppSettings(appSettings);
    return { success: true };
  } catch (err) {
    console.error('Failed to save app settings:', err);
    return { success: false, error: String(err) };
  }
});

// ============== File System IPC Handlers ==============

ipcMain.handle('fs:list-projects', async () => {
  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(claudeDir)) return [];

    // Smart path decoding function (same as in getClaudeProjects)
    const decodeClaudePath = (encoded: string): string => {
      const parts = encoded.split('-').filter(Boolean);

      const tryDecode = (index: number, currentPath: string): string | null => {
        if (index >= parts.length) {
          return fs.existsSync(currentPath) ? currentPath : null;
        }

        const withSlash = currentPath + '/' + parts[index];
        if (fs.existsSync(withSlash)) {
          const result = tryDecode(index + 1, withSlash);
          if (result) return result;
        }

        for (let end = index + 1; end <= parts.length; end++) {
          const combined = parts.slice(index, end).join('-');
          const withCombined = currentPath + '/' + combined;

          if (fs.existsSync(withCombined)) {
            if (end === parts.length) {
              return withCombined;
            }
            const result = tryDecode(end, withCombined);
            if (result) return result;
          }
        }

        return null;
      };

      const result = tryDecode(0, '');
      if (result) return result;

      return '/' + parts.join('/');
    };

    const projectDirs = fs.readdirSync(claudeDir);
    const projects: { path: string; name: string; lastModified: string }[] = [];

    for (const dir of projectDirs) {
      const decodedPath = decodeClaudePath(dir);

      // Verify the path exists before adding
      if (fs.existsSync(decodedPath)) {
        const stats = fs.statSync(path.join(claudeDir, dir));
        projects.push({
          path: decodedPath,
          name: path.basename(decodedPath),
          lastModified: stats.mtime.toISOString(),
        });
      }
    }

    return projects.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  } catch (err) {
    console.error('Error listing projects:', err);
    return [];
  }
});

// Open folder dialog
ipcMain.handle('dialog:open-folder', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || null;
});

// Open in external terminal
ipcMain.handle('shell:open-terminal', async (_event, { cwd, command }: { cwd: string; command?: string }) => {
  const shell = process.env.SHELL || '/bin/zsh';
  const script = command
    ? `tell application "Terminal" to do script "cd '${cwd}' && ${command}"`
    : `tell application "Terminal" to do script "cd '${cwd}'"`;

  const ptyProcess = pty.spawn(shell, ['-c', `osascript -e '${script.replace(/'/g, "'\\''")}'`], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  return new Promise((resolve) => {
    ptyProcess.onExit(() => {
      resolve({ success: true });
    });
  });
});

// Execute arbitrary command (uses PTY)
ipcMain.handle('shell:exec', async (_event, { command, cwd }: { command: string; cwd?: string }) => {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || os.homedir(),
      env: process.env as { [key: string]: string },
    });

    let output = '';

    ptyProcess.onData((data) => {
      output += data;
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (exitCode === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: output, code: exitCode });
      }
    });
  });
});

// ============== Quick Terminal PTY Handlers ==============

// Store for quick terminal PTYs (separate from agent PTYs)
const quickPtyProcesses: Map<string, pty.IPty> = new Map();

// Start a new quick terminal PTY
ipcMain.handle('shell:startPty', async (_event, { cwd, cols, rows }: { cwd?: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env as { [key: string]: string },
  });

  quickPtyProcesses.set(id, ptyProcess);

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('shell:ptyOutput', { ptyId: id, data });
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
    quickPtyProcesses.delete(id);
  });

  return id;
});

// Write to quick terminal PTY
ipcMain.handle('shell:writePty', async (_event, { ptyId, data }: { ptyId: string; data: string }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize quick terminal PTY
ipcMain.handle('shell:resizePty', async (_event, { ptyId, cols, rows }: { ptyId: string; cols: number; rows: number }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill quick terminal PTY
ipcMain.handle('shell:killPty', async (_event, { ptyId }: { ptyId: string }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.kill();
    quickPtyProcesses.delete(ptyId);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});
