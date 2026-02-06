#!/usr/bin/env node
/**
 * MCP server for Kanban task management
 * Available to all Claude agents for creating, updating, and completing tasks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";

// Data file path
const DATA_DIR = path.join(os.homedir(), ".claude-manager");
const KANBAN_FILE = path.join(DATA_DIR, "kanban-tasks.json");

// Types
type KanbanColumn = "backlog" | "planned" | "ongoing" | "done";

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
  projectId: string;
  projectPath: string;
  assignedAgentId: string | null;
  requiredSkills: string[];
  priority: "low" | "medium" | "high";
  progress: number;
  createdAt: string;
  updatedAt: string;
  order: number;
  labels: string[];
  completionSummary?: string;
}

// Helper functions
function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTasks(): KanbanTask[] {
  ensureDir();
  if (!fs.existsSync(KANBAN_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(KANBAN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveTasks(tasks: KanbanTask[]): void {
  ensureDir();
  fs.writeFileSync(KANBAN_FILE, JSON.stringify(tasks, null, 2));
}

// Create MCP server
const server = new McpServer({
  name: "claude-mgr-kanban",
  version: "1.0.0",
});

// Tool: List all tasks
server.tool(
  "list_tasks",
  "List all kanban tasks. Optionally filter by column (backlog, planned, ongoing, done).",
  {
    column: z.enum(["backlog", "planned", "ongoing", "done"]).optional().describe("Filter by column"),
    assigned_to_me: z.boolean().optional().describe("Only show tasks assigned to this agent"),
  },
  async ({ column, assigned_to_me }) => {
    try {
      let tasks = loadTasks();

      if (column) {
        tasks = tasks.filter(t => t.column === column);
      }

      if (assigned_to_me) {
        const agentId = process.env.CLAUDE_AGENT_ID;
        if (agentId) {
          tasks = tasks.filter(t => t.assignedAgentId === agentId);
        }
      }

      const summary = tasks.map(t =>
        `- [${t.id.slice(0, 8)}] ${t.title} (${t.column}, ${t.progress}%${t.assignedAgentId ? `, agent: ${t.assignedAgentId.slice(0, 8)}` : ""})`
      ).join("\n");

      return {
        content: [{
          type: "text",
          text: tasks.length > 0
            ? `Found ${tasks.length} task(s):\n${summary}`
            : "No tasks found.",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Get task details
server.tool(
  "get_task",
  "Get detailed information about a specific task.",
  {
    task_id: z.string().describe("The task ID (can be partial, will match prefix)"),
  },
  async ({ task_id }) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id.startsWith(task_id));

      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID starting with: ${task_id}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: `Task: ${task.title}
ID: ${task.id}
Column: ${task.column}
Progress: ${task.progress}%
Priority: ${task.priority}
Description: ${task.description}
Project: ${task.projectPath}
Assigned Agent: ${task.assignedAgentId || "None"}
Labels: ${task.labels.join(", ") || "None"}
Created: ${task.createdAt}
Updated: ${task.updatedAt}${task.completionSummary ? `\nCompletion Summary: ${task.completionSummary}` : ""}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Create a new task
server.tool(
  "create_task",
  "Create a new kanban task. Tasks start in the backlog column.",
  {
    title: z.string().describe("Task title"),
    description: z.string().describe("Task description with details"),
    project_path: z.string().optional().describe("Project path (defaults to current directory)"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Task priority (default: medium)"),
    labels: z.array(z.string()).optional().describe("Labels/tags for the task"),
  },
  async ({ title, description, project_path, priority, labels }) => {
    try {
      const tasks = loadTasks();

      // Get project path from env or parameter
      const projectPath = project_path || process.env.CLAUDE_PROJECT_PATH || process.cwd();
      const projectId = projectPath.split("/").pop() || "unknown";

      // Calculate order (add to end of backlog)
      const backlogTasks = tasks.filter(t => t.column === "backlog");
      const maxOrder = backlogTasks.length > 0
        ? Math.max(...backlogTasks.map(t => t.order))
        : -1;

      const newTask: KanbanTask = {
        id: randomUUID(),
        title,
        description,
        column: "backlog",
        projectId,
        projectPath,
        assignedAgentId: null,
        requiredSkills: [],
        priority: priority || "medium",
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        order: maxOrder + 1,
        labels: labels || [],
      };

      tasks.push(newTask);
      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: `Task created successfully!
ID: ${newTask.id}
Title: ${newTask.title}
Column: backlog
Priority: ${newTask.priority}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Update task progress
server.tool(
  "update_task_progress",
  "Update the progress percentage of a task.",
  {
    task_id: z.string().describe("The task ID"),
    progress: z.number().min(0).max(100).describe("Progress percentage (0-100)"),
  },
  async ({ task_id, progress }) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id.startsWith(task_id));

      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID: ${task_id}`,
          }],
          isError: true,
        };
      }

      task.progress = progress;
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: `Task "${task.title}" progress updated to ${progress}%`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Mark task as done
server.tool(
  "mark_task_done",
  "Mark a task as completed and move it to the done column. IMPORTANT: Call this when you finish working on an assigned task.",
  {
    task_id: z.string().describe("The task ID to mark as done"),
    summary: z.string().describe("A brief summary of what was accomplished (1-3 sentences)"),
  },
  async ({ task_id, summary }) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id.startsWith(task_id));

      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID: ${task_id}`,
          }],
          isError: true,
        };
      }

      // Move to done column
      task.column = "done";
      task.progress = 100;
      task.completionSummary = summary;
      task.updatedAt = new Date().toISOString();

      // Reorder done column
      const doneTasks = tasks.filter(t => t.column === "done" && t.id !== task.id);
      task.order = 0;
      doneTasks.forEach((t, i) => {
        t.order = i + 1;
      });

      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: `Task "${task.title}" marked as DONE!
Summary: ${summary}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error marking task done: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Move task to a column
server.tool(
  "move_task",
  "Move a task to a different column (backlog, planned, ongoing, done).",
  {
    task_id: z.string().describe("The task ID to move"),
    column: z.enum(["backlog", "planned", "ongoing", "done"]).describe("Target column"),
  },
  async ({ task_id, column }) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id.startsWith(task_id));

      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID: ${task_id}`,
          }],
          isError: true,
        };
      }

      const oldColumn = task.column;
      task.column = column;
      task.updatedAt = new Date().toISOString();

      // Update progress based on column
      if (column === "done") {
        task.progress = 100;
      } else if (column === "ongoing" && task.progress === 0) {
        task.progress = 10;
      }

      // Reorder target column
      const columnTasks = tasks.filter(t => t.column === column && t.id !== task.id);
      task.order = columnTasks.length;

      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: `Task "${task.title}" moved from ${oldColumn} to ${column}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error moving task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Delete a task
server.tool(
  "delete_task",
  "Delete a task from the kanban board.",
  {
    task_id: z.string().describe("The task ID to delete"),
  },
  async ({ task_id }) => {
    try {
      const tasks = loadTasks();
      const index = tasks.findIndex(t => t.id.startsWith(task_id));

      if (index === -1) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID: ${task_id}`,
          }],
          isError: true,
        };
      }

      const [deleted] = tasks.splice(index, 1);
      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: `Task "${deleted.title}" deleted successfully.`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: Assign agent to task
server.tool(
  "assign_task",
  "Assign an agent to a task (or assign yourself).",
  {
    task_id: z.string().describe("The task ID"),
    agent_id: z.string().optional().describe("Agent ID to assign (defaults to self if CLAUDE_AGENT_ID is set)"),
  },
  async ({ task_id, agent_id }) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id.startsWith(task_id));

      if (!task) {
        return {
          content: [{
            type: "text",
            text: `Task not found with ID: ${task_id}`,
          }],
          isError: true,
        };
      }

      const assignedId = agent_id || process.env.CLAUDE_AGENT_ID || null;
      task.assignedAgentId = assignedId;
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);

      return {
        content: [{
          type: "text",
          text: assignedId
            ? `Task "${task.title}" assigned to agent ${assignedId.slice(0, 8)}`
            : `Task "${task.title}" unassigned`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error assigning task: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Kanban server running on stdio");
}

main().catch(console.error);
