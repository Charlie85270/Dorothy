/**
 * Automations utilities - Types, storage, and helpers
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// TYPES
// ============================================================================

export type SourceType = "github" | "jira" | "pipedrive" | "twitter" | "rss" | "custom";
export type OutputType = "telegram" | "slack" | "github_comment" | "email" | "discord" | "webhook";

export interface GitHubSourceConfig {
  repos: string[];
  pollFor: ("pull_requests" | "issues" | "releases" | "commits")[];
  token?: string; // Optional, uses gh CLI auth by default
}

export interface JiraSourceConfig {
  domain: string;
  projectKeys: string[];
  jql?: string;
  email?: string;
  apiToken?: string;
}

export interface PipedriveSourceConfig {
  apiToken: string;
  pollFor: ("deals" | "activities" | "persons")[];
  filters?: Record<string, string>;
}

export interface TwitterSourceConfig {
  searchQuery?: string;
  username?: string;
}

export interface RssSourceConfig {
  feedUrls: string[];
}

export interface CustomSourceConfig {
  command: string; // Shell command that outputs JSON
}

export type SourceConfig =
  | GitHubSourceConfig
  | JiraSourceConfig
  | PipedriveSourceConfig
  | TwitterSourceConfig
  | RssSourceConfig
  | CustomSourceConfig;

export interface FilterRule {
  field: string;
  operator: "equals" | "contains" | "not_contains" | "starts_with" | "ends_with" | "regex";
  value: string;
}

export interface OutputConfig {
  type: OutputType;
  enabled: boolean;
  // Type-specific config
  template?: string; // Message template with {{variables}}
  channel?: string; // For Slack
  webhookUrl?: string; // For webhook output
  email?: string; // For email output
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;

  // Schedule
  schedule: {
    type: "cron" | "interval";
    cron?: string;
    intervalMinutes?: number;
  };

  // Source
  source: {
    type: SourceType;
    config: SourceConfig;
  };

  // Trigger conditions
  trigger: {
    eventTypes: string[]; // e.g., ["pr.opened", "issue.created"]
    filters?: FilterRule[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };

  // Agent
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: "sonnet" | "opus" | "haiku";
    timeout?: number;
  };

  // Outputs
  outputs: OutputConfig[];
}

export interface ProcessedItem {
  id: string; // Unique identifier (e.g., "github:octav-labs/frontend:pr:42")
  sourceType: SourceType;
  itemType: string; // "pr", "issue", "deal", etc.
  itemId: string; // The item's ID from the source
  lastProcessedAt: string;
  lastHash?: string; // Hash of content to detect changes
  metadata?: Record<string, unknown>;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "error";
  itemsFound: number;
  itemsProcessed: number;
  error?: string;
  agentOutput?: string;
}

export interface AutomationState {
  automations: Automation[];
  processedItems: Record<string, ProcessedItem>; // Key: item ID
  runs: AutomationRun[];
}

// ============================================================================
// STORAGE
// ============================================================================

const AUTOMATIONS_DIR = path.join(os.homedir(), ".claude-manager");
const AUTOMATIONS_FILE = path.join(AUTOMATIONS_DIR, "automations.json");
const PROCESSED_ITEMS_FILE = path.join(AUTOMATIONS_DIR, "automations-processed.json");
const RUNS_FILE = path.join(AUTOMATIONS_DIR, "automations-runs.json");

function ensureDir(): void {
  if (!fs.existsSync(AUTOMATIONS_DIR)) {
    fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true });
  }
}

// Automations CRUD
export function loadAutomations(): Automation[] {
  ensureDir();
  if (!fs.existsSync(AUTOMATIONS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(AUTOMATIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveAutomations(automations: Automation[]): void {
  ensureDir();
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
}

export function getAutomation(id: string): Automation | undefined {
  const automations = loadAutomations();
  return automations.find((a) => a.id === id);
}

export function createAutomation(automation: Omit<Automation, "id" | "createdAt" | "updatedAt">): Automation {
  const automations = loadAutomations();
  const newAutomation: Automation = {
    ...automation,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  automations.push(newAutomation);
  saveAutomations(automations);
  return newAutomation;
}

export function updateAutomation(id: string, updates: Partial<Automation>): Automation | undefined {
  const automations = loadAutomations();
  const index = automations.findIndex((a) => a.id === id);
  if (index === -1) return undefined;

  automations[index] = {
    ...automations[index],
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
  };
  saveAutomations(automations);
  return automations[index];
}

export function deleteAutomation(id: string): boolean {
  const automations = loadAutomations();
  const index = automations.findIndex((a) => a.id === id);
  if (index === -1) return false;

  automations.splice(index, 1);
  saveAutomations(automations);
  return true;
}

// Processed Items
export function loadProcessedItems(): Record<string, ProcessedItem> {
  ensureDir();
  if (!fs.existsSync(PROCESSED_ITEMS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(PROCESSED_ITEMS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveProcessedItems(items: Record<string, ProcessedItem>): void {
  ensureDir();
  fs.writeFileSync(PROCESSED_ITEMS_FILE, JSON.stringify(items, null, 2));
}

export function markItemProcessed(item: ProcessedItem): void {
  const items = loadProcessedItems();
  items[item.id] = item;
  saveProcessedItems(items);
}

export function isItemProcessed(itemId: string, hash?: string): boolean {
  const items = loadProcessedItems();
  const item = items[itemId];
  if (!item) return false;
  // If hash provided, check if content changed
  if (hash && item.lastHash !== hash) return false;
  return true;
}

// Runs
export function loadRuns(): AutomationRun[] {
  ensureDir();
  if (!fs.existsSync(RUNS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(RUNS_FILE, "utf-8");
    const runs = JSON.parse(data);
    // Keep only last 100 runs per automation
    return runs.slice(-1000);
  } catch {
    return [];
  }
}

export function saveRuns(runs: AutomationRun[]): void {
  ensureDir();
  // Keep only last 1000 runs total
  const trimmed = runs.slice(-1000);
  fs.writeFileSync(RUNS_FILE, JSON.stringify(trimmed, null, 2));
}

export function addRun(run: AutomationRun): void {
  const runs = loadRuns();
  runs.push(run);
  saveRuns(runs);
}

export function updateRun(runId: string, updates: Partial<AutomationRun>): void {
  const runs = loadRuns();
  const index = runs.findIndex((r) => r.id === runId);
  if (index !== -1) {
    runs[index] = { ...runs[index], ...updates };
    saveRuns(runs);
  }
}

export function getRunsForAutomation(automationId: string, limit = 20): AutomationRun[] {
  const runs = loadRuns();
  return runs
    .filter((r) => r.automationId === automationId)
    .slice(-limit);
}

// ============================================================================
// HELPERS
// ============================================================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: unknown = variables;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Keep original if path not found
      }
    }
    return String(value ?? match);
  });
}

export function scheduleToHuman(schedule: Automation["schedule"]): string {
  if (schedule.type === "interval" && schedule.intervalMinutes) {
    const mins = schedule.intervalMinutes;
    if (mins < 60) return `Every ${mins} minute${mins > 1 ? "s" : ""}`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) return `Every ${hours} hour${hours > 1 ? "s" : ""}`;
    return `Every ${hours}h ${remainingMins}m`;
  }
  if (schedule.type === "cron" && schedule.cron) {
    // Basic cron to human readable
    const parts = schedule.cron.split(" ");
    if (parts.length !== 5) return schedule.cron;
    const [min, hour, day, month, weekday] = parts;

    if (day === "*" && month === "*" && weekday === "*") {
      if (hour === "*" && min === "*") return "Every minute";
      if (hour === "*") return `Every hour at minute ${min}`;
      if (min === "0") return `Daily at ${hour}:00`;
      return `Daily at ${hour}:${min.padStart(2, "0")}`;
    }
    if (weekday === "1-5") {
      return `Weekdays at ${hour}:${min.padStart(2, "0")}`;
    }
    return schedule.cron;
  }
  return "Unknown schedule";
}

export function createItemId(sourceType: SourceType, repo: string, itemType: string, itemId: string): string {
  return `${sourceType}:${repo}:${itemType}:${itemId}`;
}

export function hashContent(content: string): string {
  // Simple hash for change detection
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ============================================================================
// SCHEDULER HELPERS
// ============================================================================

const LAST_RUN_FILE = path.join(AUTOMATIONS_DIR, "automations-last-run.json");

export function loadLastRunTimes(): Record<string, string> {
  ensureDir();
  if (!fs.existsSync(LAST_RUN_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(LAST_RUN_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveLastRunTime(automationId: string, time: string): void {
  ensureDir();
  const lastRuns = loadLastRunTimes();
  lastRuns[automationId] = time;
  fs.writeFileSync(LAST_RUN_FILE, JSON.stringify(lastRuns, null, 2));
}

export function getAutomationNextRunTime(automation: Automation): Date | null {
  const lastRuns = loadLastRunTimes();
  const lastRun = lastRuns[automation.id];
  const lastRunTime = lastRun ? new Date(lastRun) : new Date(0);

  if (automation.schedule.type === "interval" && automation.schedule.intervalMinutes) {
    const nextRun = new Date(lastRunTime.getTime() + automation.schedule.intervalMinutes * 60 * 1000);
    return nextRun;
  }

  if (automation.schedule.type === "cron" && automation.schedule.cron) {
    // Basic cron parsing for common cases
    const parts = automation.schedule.cron.split(" ");
    if (parts.length !== 5) return null;

    const [min, hour, day, month, weekday] = parts;
    const now = new Date();

    // Simple case: daily at specific time
    if (day === "*" && month === "*" && weekday === "*" && hour !== "*" && min !== "*") {
      const targetHour = parseInt(hour, 10);
      const targetMin = parseInt(min, 10);
      const next = new Date(now);
      next.setHours(targetHour, targetMin, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    // For other cron patterns, default to interval-based check
    return new Date(lastRunTime.getTime() + 60 * 60 * 1000); // Check hourly
  }

  return null;
}

export function isDue(automation: Automation): boolean {
  if (!automation.enabled) return false;

  const nextRun = getAutomationNextRunTime(automation);
  if (!nextRun) return false;

  return nextRun <= new Date();
}

export function getAutomationsDue(): Automation[] {
  const automations = loadAutomations();
  return automations.filter(isDue);
}
