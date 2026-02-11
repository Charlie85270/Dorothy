/**
 * Scheduler tools for creating and managing recurring tasks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import {
  getClaudePath,
  cronToHuman,
  getNextRunTime,
  createLaunchdJob,
  createCronJob,
  deleteLaunchdJob,
  deleteCronJob,
} from "../utils/scheduler.js";

export function registerSchedulerTools(server: McpServer): void {
  // Tool: List scheduled tasks
  server.tool(
    "list_scheduled_tasks",
    "List all scheduled recurring tasks. Shows task ID, schedule, prompt, and next run time.",
    {},
    async () => {
      try {
        const tasks: Array<{
          id: string;
          prompt: string;
          schedule: string;
          scheduleHuman: string;
          projectPath: string;
          nextRun?: string;
          lastRun?: string;
        }> = [];

        // Read from schedules.json
        const globalSchedulesPath = path.join(os.homedir(), ".claude", "schedules.json");
        if (fs.existsSync(globalSchedulesPath)) {
          try {
            const schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, "utf-8"));
            if (Array.isArray(schedules)) {
              for (const schedule of schedules) {
                const logPath = path.join(os.homedir(), ".claude", "logs", `${schedule.id}.log`);
                let lastRun: string | undefined;
                if (fs.existsSync(logPath)) {
                  const stat = fs.statSync(logPath);
                  lastRun = stat.mtime.toISOString();
                }

                tasks.push({
                  id: schedule.id,
                  prompt: schedule.prompt || schedule.task || "",
                  schedule: schedule.schedule || schedule.cron || "",
                  scheduleHuman: cronToHuman(schedule.schedule || schedule.cron || ""),
                  projectPath: schedule.projectPath || os.homedir(),
                  nextRun: getNextRunTime(schedule.schedule || schedule.cron || ""),
                  lastRun,
                });
              }
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Also scan launchd plist files (macOS)
        if (os.platform() === "darwin") {
          const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
          if (fs.existsSync(launchAgentsDir)) {
            const files = fs.readdirSync(launchAgentsDir);
            const addedIds = new Set(tasks.map((t) => t.id));

            for (const file of files) {
              if (!file.startsWith("com.dorothy.scheduler.")) continue;
              if (!file.endsWith(".plist")) continue;

              const taskId = file.replace("com.dorothy.scheduler.", "").replace(".plist", "");
              if (addedIds.has(taskId)) continue;

              try {
                const plistPath = path.join(launchAgentsDir, file);
                const plistContent = fs.readFileSync(plistPath, "utf-8");

                let projectPath = os.homedir();
                let hour = 0;
                let minute = 0;

                const calendarMatch = plistContent.match(
                  /<key>StartCalendarInterval<\/key>\s*<dict>([\s\S]*?)<\/dict>/
                );
                if (calendarMatch) {
                  const cal = calendarMatch[1];
                  const hm = cal.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
                  const mm = cal.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
                  if (hm) hour = parseInt(hm[1], 10);
                  if (mm) minute = parseInt(mm[1], 10);
                }

                const cron = `${minute} ${hour} * * *`;

                // Read prompt from script file
                const scriptPath = path.join(os.homedir(), ".dorothy", "scripts", `${taskId}.sh`);
                let prompt = "";
                if (fs.existsSync(scriptPath)) {
                  const scriptContent = fs.readFileSync(scriptPath, "utf-8");
                  const promptMatch = scriptContent.match(/-p\s+'([^']+)'/);
                  if (promptMatch) prompt = promptMatch[1];
                  const cdMatch = scriptContent.match(/cd\s+"([^"]+)"/);
                  if (cdMatch) projectPath = cdMatch[1];
                }

                const logPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.log`);
                let lastRun: string | undefined;
                if (fs.existsSync(logPath)) {
                  const stat = fs.statSync(logPath);
                  lastRun = stat.mtime.toISOString();
                }

                tasks.push({
                  id: taskId,
                  prompt,
                  schedule: cron,
                  scheduleHuman: cronToHuman(cron),
                  projectPath,
                  nextRun: getNextRunTime(cron),
                  lastRun,
                });
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        if (tasks.length === 0) {
          return {
            content: [{ type: "text", text: "No scheduled tasks found." }],
          };
        }

        const formatted = tasks.map((t) => {
          const nextRun = t.nextRun ? new Date(t.nextRun).toLocaleString() : "Unknown";
          const lastRun = t.lastRun ? new Date(t.lastRun).toLocaleString() : "Never";
          return `**${t.id}**
  Schedule: ${t.scheduleHuman} (${t.schedule})
  Project: ${t.projectPath}
  Prompt: ${t.prompt.slice(0, 80)}${t.prompt.length > 80 ? "..." : ""}
  Next run: ${nextRun}
  Last run: ${lastRun}`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${tasks.length} scheduled task(s):\n\n${formatted.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Create scheduled task
  server.tool(
    "create_scheduled_task",
    "Create a new scheduled recurring task. The task will run Claude with the given prompt at the specified schedule. Schedule format is cron (e.g., '0 9 * * *' for daily at 9am, '0 9 * * 1-5' for weekdays at 9am).",
    {
      prompt: z.string().describe("The prompt/task for Claude to execute"),
      schedule: z
        .string()
        .describe("Cron expression (e.g., '0 9 * * *' for daily at 9am, '30 14 * * 1-5' for weekdays at 2:30pm)"),
      projectPath: z.string().describe("Absolute path to the project directory where Claude should run"),
      autonomous: z
        .boolean()
        .optional()
        .default(true)
        .describe("Run with --dangerously-skip-permissions (default: true)"),
    },
    async ({ prompt, schedule, projectPath, autonomous = true }) => {
      try {
        // Validate cron format
        const cronParts = schedule.split(" ");
        if (cronParts.length !== 5) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid cron format. Expected 5 parts (minute hour day month weekday), got ${cronParts.length}. Examples:\n- '0 9 * * *' = Daily at 9:00 AM\n- '30 14 * * 1-5' = Weekdays at 2:30 PM\n- '0 */2 * * *' = Every 2 hours`,
              },
            ],
            isError: true,
          };
        }

        const taskId = randomUUID().slice(0, 8);

        // Save to schedules.json
        const globalSchedulesPath = path.join(os.homedir(), ".claude", "schedules.json");
        let schedules: Array<Record<string, unknown>> = [];
        if (fs.existsSync(globalSchedulesPath)) {
          try {
            schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, "utf-8"));
            if (!Array.isArray(schedules)) schedules = [];
          } catch {
            schedules = [];
          }
        }

        const newTask = {
          id: taskId,
          prompt,
          schedule,
          projectPath,
          autonomous,
          createdAt: new Date().toISOString(),
        };
        schedules.push(newTask);

        const claudeDir = path.join(os.homedir(), ".claude");
        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true });
        }
        fs.writeFileSync(globalSchedulesPath, JSON.stringify(schedules, null, 2));

        // Create platform-specific job
        if (os.platform() === "darwin") {
          await createLaunchdJob(taskId, schedule, projectPath, prompt, autonomous);
        } else {
          await createCronJob(taskId, schedule, projectPath, prompt, autonomous);
        }

        const claudePath = await getClaudePath();

        return {
          content: [
            {
              type: "text",
              text: `Created scheduled task: ${taskId}\n\nSchedule: ${cronToHuman(schedule)} (${schedule})\nProject: ${projectPath}\nPrompt: ${prompt}\nAutonomous: ${autonomous}\nClaude path: ${claudePath}\n\nThe task will run automatically at the scheduled time.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Delete scheduled task
  server.tool(
    "delete_scheduled_task",
    "Delete a scheduled task by its ID. This stops the scheduled execution and removes all associated files.",
    {
      taskId: z.string().describe("The task ID to delete"),
    },
    async ({ taskId }) => {
      try {
        // Remove from schedules.json
        const globalSchedulesPath = path.join(os.homedir(), ".claude", "schedules.json");
        if (fs.existsSync(globalSchedulesPath)) {
          let schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, "utf-8"));
          if (Array.isArray(schedules)) {
            schedules = schedules.filter((s: { id?: string }) => s.id !== taskId);
            fs.writeFileSync(globalSchedulesPath, JSON.stringify(schedules, null, 2));
          }
        }

        // Remove platform-specific job
        if (os.platform() === "darwin") {
          await deleteLaunchdJob(taskId);
        } else {
          await deleteCronJob(taskId);
        }

        // Remove script file
        const scriptPath = path.join(os.homedir(), ".dorothy", "scripts", `${taskId}.sh`);
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }

        return {
          content: [
            {
              type: "text",
              text: `Deleted scheduled task: ${taskId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Run scheduled task now
  server.tool(
    "run_scheduled_task",
    "Manually run a scheduled task immediately without waiting for its schedule.",
    {
      taskId: z.string().describe("The task ID to run"),
    },
    async ({ taskId }) => {
      try {
        const scriptPath = path.join(os.homedir(), ".dorothy", "scripts", `${taskId}.sh`);

        if (!fs.existsSync(scriptPath)) {
          return {
            content: [
              {
                type: "text",
                text: `Task not found: ${taskId}. Use list_scheduled_tasks to see available tasks.`,
              },
            ],
            isError: true,
          };
        }

        // Run the script in background
        const proc = spawn("bash", [scriptPath], {
          detached: true,
          stdio: "ignore",
        });
        proc.unref();

        return {
          content: [
            {
              type: "text",
              text: `Started task ${taskId} in background. Check logs at ~/.claude/logs/${taskId}.log`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error running task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get scheduled task logs
  server.tool(
    "get_scheduled_task_logs",
    "Get the execution logs for a scheduled task.",
    {
      taskId: z.string().describe("The task ID to get logs for"),
      lines: z.number().optional().default(50).describe("Number of lines to return (default: 50)"),
    },
    async ({ taskId, lines = 50 }) => {
      try {
        const logPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.log`);
        const errorLogPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.error.log`);

        let output = "";

        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, "utf-8");
          const logLines = content.split("\n").slice(-lines).join("\n");
          if (logLines.trim()) {
            output += `=== Output Log ===\n${logLines}\n`;
          }
        }

        if (fs.existsSync(errorLogPath)) {
          const errorContent = fs.readFileSync(errorLogPath, "utf-8");
          if (errorContent.trim()) {
            output += `\n=== Error Log ===\n${errorContent}\n`;
          }
        }

        if (!output) {
          return {
            content: [
              {
                type: "text",
                text: `No logs found for task ${taskId}. The task may not have run yet.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
