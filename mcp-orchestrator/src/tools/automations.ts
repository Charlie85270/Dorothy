/**
 * Automations tools for the MCP server
 *
 * Provides tools for creating and managing automations that poll external sources
 * (GitHub, JIRA, etc.) and trigger Claude agents based on conditions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import {
  loadAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  loadProcessedItems,
  markItemProcessed,
  isItemProcessed,
  addRun,
  updateRun,
  getRunsForAutomation,
  scheduleToHuman,
  interpolateTemplate,
  createItemId,
  hashContent,
  generateId,
  saveLastRunTime,
  getAutomationsDue,
  Automation,
  AutomationRun,
  GitHubSourceConfig,
  OutputConfig,
} from "../utils/automations.js";
import { apiRequest } from "../utils/api.js";

const execAsyncRaw = promisify(exec);

// Shared config file path that the Electron app writes to
const CLI_PATHS_CONFIG_FILE = path.join(os.homedir(), ".claude-manager", "cli-paths.json");

// Load CLI paths config from the shared config file
function loadCLIPathsConfig(): { fullPath?: string; claude?: string; gh?: string; node?: string; additionalPaths?: string[] } | null {
  try {
    if (fs.existsSync(CLI_PATHS_CONFIG_FILE)) {
      const content = fs.readFileSync(CLI_PATHS_CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore
  }
  return null;
}

// Build a PATH that includes common locations for CLI tools like gh, claude, etc.
function buildFullPath(): string {
  // First try to use the shared config from the Electron app
  const config = loadCLIPathsConfig();
  if (config?.fullPath) {
    return config.fullPath;
  }

  // Fall back to default path building
  const homeDir = process.env.HOME || os.homedir();
  const existingPath = process.env.PATH || "";

  const additionalPaths = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(homeDir, ".local/bin"),
    path.join(homeDir, ".nvm/versions/node/v20.11.1/bin"),
    path.join(homeDir, ".nvm/versions/node/v22.0.0/bin"),
  ];

  // Add user-configured additional paths
  if (config?.additionalPaths) {
    additionalPaths.push(...config.additionalPaths);
  }

  // Find any nvm node version directories
  const nvmDir = path.join(homeDir, ".nvm/versions/node");
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir);
      for (const version of versions) {
        additionalPaths.push(path.join(nvmDir, version, "bin"));
      }
    } catch {
      // Ignore errors
    }
  }

  return [...new Set([...additionalPaths, ...existingPath.split(":")])].join(":");
}

// Get the full PATH - refreshes on each call to pick up config changes
function getFullPath(): string {
  return buildFullPath();
}

// Wrapper around exec that includes proper PATH for CLI tools
async function execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
  return execAsyncRaw(command, {
    env: {
      ...process.env,
      PATH: getFullPath(),
    },
  });
}


// ============================================================================
// SOURCE POLLERS
// ============================================================================

interface PollResult {
  items: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    author: string;
    body?: string;
    labels?: string[];
    createdAt: string;
    updatedAt?: string;
    hash: string;
    raw: Record<string, unknown>;
  }>;
  error?: string;
}

async function pollGitHub(config: GitHubSourceConfig, automation: Automation): Promise<PollResult> {
  const items: PollResult["items"] = [];

  for (const repo of config.repos) {
    for (const pollFor of config.pollFor) {
      try {
        if (pollFor === "pull_requests") {
          const { stdout } = await execAsync(
            `gh pr list --repo ${repo} --state open --json number,title,url,author,body,labels,createdAt,updatedAt,headRefOid --limit 20`
          );
          const prs = JSON.parse(stdout || "[]");
          for (const pr of prs) {
            const hash = hashContent(JSON.stringify({ sha: pr.headRefOid, updatedAt: pr.updatedAt }));
            items.push({
              id: createItemId("github", repo, "pr", String(pr.number)),
              type: "pr",
              title: pr.title,
              url: pr.url,
              author: pr.author?.login || "unknown",
              body: pr.body,
              labels: pr.labels?.map((l: { name: string }) => l.name) || [],
              createdAt: pr.createdAt,
              updatedAt: pr.updatedAt,
              hash,
              raw: { ...pr, repo },
            });
          }
        }

        if (pollFor === "issues") {
          const { stdout } = await execAsync(
            `gh issue list --repo ${repo} --state open --json number,title,url,author,body,labels,createdAt,updatedAt --limit 20`
          );
          const issues = JSON.parse(stdout || "[]");
          for (const issue of issues) {
            const hash = hashContent(JSON.stringify({ updatedAt: issue.updatedAt }));
            items.push({
              id: createItemId("github", repo, "issue", String(issue.number)),
              type: "issue",
              title: issue.title,
              url: issue.url,
              author: issue.author?.login || "unknown",
              body: issue.body,
              labels: issue.labels?.map((l: { name: string }) => l.name) || [],
              createdAt: issue.createdAt,
              updatedAt: issue.updatedAt,
              hash,
              raw: { ...issue, repo },
            });
          }
        }

        if (pollFor === "releases") {
          const { stdout } = await execAsync(
            `gh release list --repo ${repo} --json tagName,name,url,author,body,createdAt,publishedAt --limit 10`
          );
          const releases = JSON.parse(stdout || "[]");
          for (const release of releases) {
            const hash = hashContent(release.tagName);
            items.push({
              id: createItemId("github", repo, "release", release.tagName),
              type: "release",
              title: release.name || release.tagName,
              url: release.url,
              author: release.author?.login || "unknown",
              body: release.body,
              createdAt: release.createdAt || release.publishedAt,
              hash,
              raw: { ...release, repo },
            });
          }
        }
      } catch (error) {
        return { items: [], error: `Failed to poll ${pollFor} from ${repo}: ${error}` };
      }
    }
  }

  return { items };
}

async function pollSource(automation: Automation): Promise<PollResult> {
  switch (automation.source.type) {
    case "github":
      return pollGitHub(automation.source.config as GitHubSourceConfig, automation);
    case "jira":
      return { items: [], error: "JIRA polling not yet implemented" };
    case "pipedrive":
      return { items: [], error: "Pipedrive polling not yet implemented" };
    case "twitter":
      return { items: [], error: "Twitter polling not yet implemented" };
    case "rss":
      return { items: [], error: "RSS polling not yet implemented" };
    case "custom":
      return { items: [], error: "Custom polling not yet implemented" };
    default:
      return { items: [], error: `Unknown source type: ${automation.source.type}` };
  }
}

// ============================================================================
// OUTPUT HANDLERS
// ============================================================================

async function sendOutput(output: OutputConfig, message: string, variables: Record<string, unknown>): Promise<void> {
  if (!output.enabled) return;

  const finalMessage = output.template ? interpolateTemplate(output.template, variables) : message;

  switch (output.type) {
    case "telegram":
      await apiRequest("/api/telegram/send", "POST", { message: finalMessage });
      break;
    case "slack":
      await apiRequest("/api/slack/send", "POST", { message: finalMessage });
      break;
    case "github_comment": {
      const { repo, number, type } = variables as { repo?: string; number?: number; type?: string };
      if (repo && number) {
        const cmd = type === "issue"
          ? `gh issue comment ${number} --repo ${repo} --body '${finalMessage.replace(/'/g, "'\\''")}'`
          : `gh pr comment ${number} --repo ${repo} --body '${finalMessage.replace(/'/g, "'\\''")}'`;
        await execAsync(cmd);
      }
      break;
    }
    case "webhook":
      if (output.webhookUrl) {
        await fetch(output.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: finalMessage, ...variables }),
        });
      }
      break;
    default:
      console.error(`Output type ${output.type} not implemented`);
  }
}

// ============================================================================
// AUTOMATION EXECUTOR
// ============================================================================

async function runAutomation(automation: Automation): Promise<AutomationRun> {
  const run: AutomationRun = {
    id: generateId(),
    automationId: automation.id,
    startedAt: new Date().toISOString(),
    status: "running",
    itemsFound: 0,
    itemsProcessed: 0,
  };
  addRun(run);

  try {
    // Poll the source
    const pollResult = await pollSource(automation);
    if (pollResult.error) {
      throw new Error(pollResult.error);
    }

    run.itemsFound = pollResult.items.length;

    // Filter for new/updated items based on trigger config
    const itemsToProcess = pollResult.items.filter((item) => {
      // Check if already processed
      const processed = isItemProcessed(item.id, automation.trigger.onUpdatedItem ? item.hash : undefined);

      // If onNewItem only, skip if processed
      if (automation.trigger.onNewItem && !automation.trigger.onUpdatedItem && processed) {
        return false;
      }

      // If onUpdatedItem, check hash changed
      if (automation.trigger.onUpdatedItem && processed) {
        // Item was processed but hash is same = no update
        return false;
      }

      // Apply trigger filters
      if (automation.trigger.filters) {
        for (const filter of automation.trigger.filters) {
          const fieldValue = String(item.raw[filter.field] ?? "");
          switch (filter.operator) {
            case "equals":
              if (fieldValue !== filter.value) return false;
              break;
            case "contains":
              if (!fieldValue.includes(filter.value)) return false;
              break;
            case "not_contains":
              if (fieldValue.includes(filter.value)) return false;
              break;
            case "starts_with":
              if (!fieldValue.startsWith(filter.value)) return false;
              break;
            case "ends_with":
              if (!fieldValue.endsWith(filter.value)) return false;
              break;
            case "regex":
              if (!new RegExp(filter.value).test(fieldValue)) return false;
              break;
          }
        }
      }

      // Check event type filter
      if (automation.trigger.eventTypes.length > 0) {
        const eventType = `${item.type}.opened`; // Simplified for now
        if (!automation.trigger.eventTypes.some((et) => et === eventType || et === item.type)) {
          return false;
        }
      }

      return true;
    });

    // Process each item
    for (const item of itemsToProcess) {
      const variables = {
        ...item.raw,
        number: item.raw.number,
        title: item.title,
        url: item.url,
        author: item.author,
        body: item.body,
        type: item.type,
        repo: item.raw.repo,
        labels: item.labels?.join(", "),
      };

      let agentOutput = "";

      // Run agent if enabled
      if (automation.agent.enabled && automation.agent.prompt) {
        const basePrompt = interpolateTemplate(automation.agent.prompt, variables);

        // Build output instructions based on configured outputs
        const outputInstructions: string[] = [];
        for (const output of automation.outputs) {
          if (output.enabled) {
            if (output.type === "telegram") {
              outputInstructions.push("- Use the send_telegram MCP tool to send your final result to Telegram");
            }
            if (output.type === "github_comment") {
              const repo = variables.repo as string;
              const number = variables.number as number;
              outputInstructions.push(`- Post your result as a comment on GitHub PR #${number} in ${repo} using: gh pr comment ${number} --repo ${repo} --body "YOUR_CONTENT"`);
            }
          }
        }

        // Add instructions for using MCP tools to send output
        const prompt = `${basePrompt}

IMPORTANT INSTRUCTIONS:
- Work autonomously without asking for user feedback
- Generate your content and then send it using the tools below
${outputInstructions.length > 0 ? outputInstructions.join("\n") : "- Output your final result directly"}
- Do NOT output explanations or multiple options - just create and send the final content`;

        try {
          // Create and start agent via API
          const createResponse = await apiRequest("/api/agents", "POST", {
            projectPath: automation.agent.projectPath || process.cwd(),
            name: `Automation: ${automation.name}`,
            skipPermissions: true,
          }) as { agent: { id: string } };

          const agentId = createResponse.agent.id;

          await apiRequest(`/api/agents/${agentId}/start`, "POST", {
            prompt,
            model: automation.agent.model,
            skipPermissions: true,
          });

          // Wait for agent to complete (with timeout)
          const timeout = automation.agent.timeout || 300000; // 5 min default
          const startTime = Date.now();
          let status = "running";

          while (status === "running" || status === "waiting") {
            if (Date.now() - startTime > timeout) {
              await apiRequest(`/api/agents/${agentId}/stop`, "POST");
              throw new Error("Agent timeout");
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const agentResponse = await apiRequest(`/api/agents/${agentId}`) as { agent: { status: string; output: string[] } };
            status = agentResponse.agent.status;
            agentOutput = agentResponse.agent.output?.join("") || "";
          }

          // Clean up agent
          await apiRequest(`/api/agents/${agentId}`, "DELETE");
        } catch (error) {
          agentOutput = `Agent error: ${error}`;
          // If agent failed, try to send error notification
          for (const output of automation.outputs) {
            if (output.enabled && output.type === "telegram") {
              try {
                await apiRequest("/api/telegram/send", "POST", {
                  message: `Automation "${automation.name}" failed: ${error}`
                });
              } catch {
                // Ignore
              }
            }
          }
        }
      }

      // Note: Output sending is now handled by the agent using MCP tools (send_telegram, gh pr comment, etc.)
      // The agent is instructed to use these tools directly in its prompt

      // Mark as processed
      markItemProcessed({
        id: item.id,
        sourceType: automation.source.type,
        itemType: item.type,
        itemId: String(item.raw.number || item.raw.tagName || item.id),
        lastProcessedAt: new Date().toISOString(),
        lastHash: item.hash,
        metadata: { title: item.title, url: item.url },
      });

      run.itemsProcessed++;
    }

    run.status = "completed";
    run.completedAt = new Date().toISOString();
    run.agentOutput = run.itemsProcessed > 0 ? "Items processed successfully" : "No new items to process";
  } catch (error) {
    run.status = "error";
    run.completedAt = new Date().toISOString();
    run.error = error instanceof Error ? error.message : String(error);
  }

  updateRun(run.id, run);

  // Save last run time for scheduling
  saveLastRunTime(automation.id, new Date().toISOString());

  return run;
}

// ============================================================================
// MCP TOOLS
// ============================================================================

export function registerAutomationTools(server: McpServer): void {
  // Tool: List automations
  server.tool(
    "list_automations",
    "List all configured automations. Shows automation ID, name, source, schedule, and status.",
    {},
    async () => {
      try {
        const automations = loadAutomations();

        if (automations.length === 0) {
          return {
            content: [{ type: "text", text: "No automations configured. Use create_automation to create one." }],
          };
        }

        const formatted = automations.map((a) => {
          const schedule = scheduleToHuman(a.schedule);
          const outputs = a.outputs.filter((o) => o.enabled).map((o) => o.type).join(", ");
          const status = a.enabled ? "🟢 Enabled" : "⚪ Paused";
          return `**${a.name}** (${a.id})
  ${status}
  Source: ${a.source.type} (${a.source.type === "github" ? (a.source.config as GitHubSourceConfig).repos.join(", ") : "configured"})
  Schedule: ${schedule}
  Triggers: ${a.trigger.eventTypes.join(", ") || "all events"}
  Agent: ${a.agent.enabled ? "✅" : "❌"}
  Outputs: ${outputs || "none"}`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${automations.length} automation(s):\n\n${formatted.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing automations: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Get automation details
  server.tool(
    "get_automation",
    "Get detailed information about a specific automation including its configuration and recent runs.",
    {
      id: z.string().describe("The automation ID"),
    },
    async ({ id }) => {
      try {
        const automation = getAutomation(id);
        if (!automation) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }

        const runs = getRunsForAutomation(id, 5);
        const runsFormatted = runs.length > 0
          ? runs.map((r) => `  - ${new Date(r.startedAt).toLocaleString()}: ${r.status} (${r.itemsProcessed}/${r.itemsFound} items)`).join("\n")
          : "  No runs yet";

        return {
          content: [
            {
              type: "text",
              text: `**${automation.name}** (${automation.id})

Status: ${automation.enabled ? "🟢 Enabled" : "⚪ Paused"}
Created: ${new Date(automation.createdAt).toLocaleString()}
Updated: ${new Date(automation.updatedAt).toLocaleString()}

**Source**
Type: ${automation.source.type}
Config: ${JSON.stringify(automation.source.config, null, 2)}

**Schedule**
${scheduleToHuman(automation.schedule)}

**Trigger**
Event types: ${automation.trigger.eventTypes.join(", ") || "all"}
On new items: ${automation.trigger.onNewItem}
On updates: ${automation.trigger.onUpdatedItem || false}
Filters: ${automation.trigger.filters?.length || 0}

**Agent**
Enabled: ${automation.agent.enabled}
Project: ${automation.agent.projectPath || "default"}
Model: ${automation.agent.model || "default"}
Prompt: ${automation.agent.prompt?.slice(0, 100)}${(automation.agent.prompt?.length || 0) > 100 ? "..." : ""}

**Outputs**
${automation.outputs.map((o) => `- ${o.type}: ${o.enabled ? "✅" : "❌"}`).join("\n")}

**Recent Runs**
${runsFormatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Create automation
  server.tool(
    "create_automation",
    "Create a new automation that polls a source and triggers actions. Returns the created automation ID.",
    {
      name: z.string().describe("Name for the automation"),
      description: z.string().optional().describe("Description of what this automation does"),
      sourceType: z.enum(["github", "jira", "pipedrive", "twitter", "rss", "custom"]).describe("Type of source to poll"),
      sourceConfig: z.string().describe("JSON string of source configuration (e.g., {\"repos\": [\"owner/repo\"], \"pollFor\": [\"pull_requests\"]})"),
      scheduleMinutes: z.number().optional().describe("Poll interval in minutes (default: 30)"),
      scheduleCron: z.string().optional().describe("Cron expression for schedule (alternative to scheduleMinutes)"),
      eventTypes: z.array(z.string()).optional().describe("Event types to trigger on (e.g., [\"pr\", \"issue\"])"),
      onNewItem: z.boolean().optional().default(true).describe("Trigger on new items (default: true)"),
      onUpdatedItem: z.boolean().optional().describe("Trigger when items are updated"),
      agentEnabled: z.boolean().optional().default(true).describe("Enable Claude agent processing"),
      agentPrompt: z.string().optional().describe("Prompt template for the agent (supports {{variables}})"),
      agentProjectPath: z.string().optional().describe("Project path for the agent"),
      agentModel: z.enum(["sonnet", "opus", "haiku"]).optional().describe("Model for the agent"),
      outputTelegram: z.boolean().optional().describe("Send output to Telegram"),
      outputSlack: z.boolean().optional().describe("Send output to Slack"),
      outputGitHubComment: z.boolean().optional().describe("Post output as GitHub comment"),
      outputTemplate: z.string().optional().describe("Custom output message template"),
    },
    async ({
      name,
      description,
      sourceType,
      sourceConfig,
      scheduleMinutes = 30,
      scheduleCron,
      eventTypes = [],
      onNewItem = true,
      onUpdatedItem,
      agentEnabled = true,
      agentPrompt,
      agentProjectPath,
      agentModel,
      outputTelegram,
      outputSlack,
      outputGitHubComment,
      outputTemplate,
    }) => {
      try {
        let parsedSourceConfig;
        try {
          parsedSourceConfig = JSON.parse(sourceConfig);
        } catch {
          return {
            content: [{ type: "text", text: "Invalid sourceConfig JSON" }],
            isError: true,
          };
        }

        const outputs: OutputConfig[] = [];
        if (outputTelegram) {
          outputs.push({ type: "telegram", enabled: true, template: outputTemplate });
        }
        if (outputSlack) {
          outputs.push({ type: "slack", enabled: true, template: outputTemplate });
        }
        if (outputGitHubComment) {
          outputs.push({ type: "github_comment", enabled: true, template: outputTemplate });
        }

        const automation = createAutomation({
          name,
          description,
          enabled: true,
          source: {
            type: sourceType,
            config: parsedSourceConfig,
          },
          schedule: scheduleCron
            ? { type: "cron", cron: scheduleCron }
            : { type: "interval", intervalMinutes: scheduleMinutes },
          trigger: {
            eventTypes,
            onNewItem,
            onUpdatedItem,
          },
          agent: {
            enabled: agentEnabled,
            prompt: agentPrompt || "",
            projectPath: agentProjectPath,
            model: agentModel,
          },
          outputs,
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Created automation: ${automation.name} (${automation.id})

Source: ${sourceType}
Schedule: ${scheduleToHuman(automation.schedule)}
Agent: ${agentEnabled ? "enabled" : "disabled"}
Outputs: ${outputs.map((o) => o.type).join(", ") || "none"}

Use run_automation to test it, or it will run automatically on schedule.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error creating automation: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Update automation
  server.tool(
    "update_automation",
    "Update an existing automation's configuration.",
    {
      id: z.string().describe("The automation ID to update"),
      enabled: z.boolean().optional().describe("Enable or disable the automation"),
      name: z.string().optional().describe("New name"),
      scheduleMinutes: z.number().optional().describe("New poll interval in minutes"),
      agentPrompt: z.string().optional().describe("New agent prompt"),
      outputTelegram: z.boolean().optional().describe("Enable/disable Telegram output"),
      outputSlack: z.boolean().optional().describe("Enable/disable Slack output"),
    },
    async ({ id, enabled, name, scheduleMinutes, agentPrompt, outputTelegram, outputSlack }) => {
      try {
        const automation = getAutomation(id);
        if (!automation) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }

        const updates: Partial<Automation> = {};

        if (enabled !== undefined) updates.enabled = enabled;
        if (name !== undefined) updates.name = name;
        if (scheduleMinutes !== undefined) {
          updates.schedule = { type: "interval", intervalMinutes: scheduleMinutes };
        }
        if (agentPrompt !== undefined) {
          updates.agent = { ...automation.agent, prompt: agentPrompt };
        }

        if (outputTelegram !== undefined || outputSlack !== undefined) {
          const outputs = [...automation.outputs];
          if (outputTelegram !== undefined) {
            const idx = outputs.findIndex((o) => o.type === "telegram");
            if (idx >= 0) {
              outputs[idx].enabled = outputTelegram;
            } else if (outputTelegram) {
              outputs.push({ type: "telegram", enabled: true });
            }
          }
          if (outputSlack !== undefined) {
            const idx = outputs.findIndex((o) => o.type === "slack");
            if (idx >= 0) {
              outputs[idx].enabled = outputSlack;
            } else if (outputSlack) {
              outputs.push({ type: "slack", enabled: true });
            }
          }
          updates.outputs = outputs;
        }

        const updated = updateAutomation(id, updates);
        if (!updated) {
          return {
            content: [{ type: "text", text: "Failed to update automation" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: `✅ Updated automation: ${updated.name} (${updated.id})` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Delete automation
  server.tool(
    "delete_automation",
    "Delete an automation by its ID.",
    {
      id: z.string().describe("The automation ID to delete"),
    },
    async ({ id }) => {
      try {
        const automation = getAutomation(id);
        if (!automation) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }

        deleteAutomation(id);

        return {
          content: [{ type: "text", text: `✅ Deleted automation: ${automation.name} (${id})` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Run automation manually
  server.tool(
    "run_automation",
    "Manually trigger an automation to run immediately, without waiting for its schedule.",
    {
      id: z.string().describe("The automation ID to run"),
    },
    async ({ id }) => {
      try {
        const automation = getAutomation(id);
        if (!automation) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }

        const run = await runAutomation(automation);

        return {
          content: [
            {
              type: "text",
              text: `${run.status === "completed" ? "✅" : "❌"} Automation run ${run.status}

Automation: ${automation.name}
Items found: ${run.itemsFound}
Items processed: ${run.itemsProcessed}
${run.error ? `Error: ${run.error}` : ""}
${run.agentOutput ? `Output: ${run.agentOutput.slice(0, 200)}...` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error running automation: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Pause/resume automation
  server.tool(
    "pause_automation",
    "Pause an automation (stop it from running on schedule).",
    {
      id: z.string().describe("The automation ID to pause"),
    },
    async ({ id }) => {
      try {
        const updated = updateAutomation(id, { enabled: false });
        if (!updated) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `⏸️ Paused automation: ${updated.name}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "resume_automation",
    "Resume a paused automation.",
    {
      id: z.string().describe("The automation ID to resume"),
    },
    async ({ id }) => {
      try {
        const updated = updateAutomation(id, { enabled: true });
        if (!updated) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `▶️ Resumed automation: ${updated.name}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Run all due automations
  server.tool(
    "run_due_automations",
    "Check all automations and run any that are due based on their schedule. This is typically called by a scheduled task.",
    {},
    async () => {
      try {
        const dueAutomations = getAutomationsDue();

        if (dueAutomations.length === 0) {
          return {
            content: [{ type: "text", text: "No automations are due to run." }],
          };
        }

        const results: string[] = [];

        for (const automation of dueAutomations) {
          try {
            const run = await runAutomation(automation);
            const status = run.status === "completed" ? "✅" : "❌";
            results.push(`${status} ${automation.name}: ${run.itemsProcessed}/${run.itemsFound} items processed`);
          } catch (error) {
            results.push(`❌ ${automation.name}: Error - ${error}`);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Ran ${dueAutomations.length} automation(s):\n\n${results.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: Get automation logs/runs
  server.tool(
    "get_automation_logs",
    "Get the recent run history for an automation.",
    {
      id: z.string().describe("The automation ID"),
      limit: z.number().optional().default(10).describe("Number of runs to return (default: 10)"),
    },
    async ({ id, limit = 10 }) => {
      try {
        const automation = getAutomation(id);
        if (!automation) {
          return {
            content: [{ type: "text", text: `Automation not found: ${id}` }],
            isError: true,
          };
        }

        const runs = getRunsForAutomation(id, limit);

        if (runs.length === 0) {
          return {
            content: [{ type: "text", text: `No runs found for automation: ${automation.name}` }],
          };
        }

        const formatted = runs.map((r) => {
          const status = r.status === "completed" ? "✅" : r.status === "error" ? "❌" : "🔄";
          const duration = r.completedAt
            ? `${Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)}s`
            : "running";
          return `${status} ${new Date(r.startedAt).toLocaleString()} - ${r.status} (${duration})
   Items: ${r.itemsProcessed}/${r.itemsFound} processed
   ${r.error ? `Error: ${r.error}` : ""}`;
        });

        return {
          content: [
            {
              type: "text",
              text: `**${automation.name}** - Recent Runs\n\n${formatted.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
