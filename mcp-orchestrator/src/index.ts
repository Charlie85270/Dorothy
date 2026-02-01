#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.CLAUDE_MGR_API_URL || "http://127.0.0.1:31415";

// Helper to make API requests
async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `API error: ${response.status}`);
  }

  return data;
}

// Create MCP server
const server = new McpServer({
  name: "claude-mgr-orchestrator",
  version: "1.0.0",
});

// Tool: List all agents
server.tool(
  "list_agents",
  "List all agents and their current status. Returns agent IDs, names, status (idle/running/waiting/completed/error), projects, and current tasks.",
  {},
  async () => {
    try {
      const data = await apiRequest("/api/agents") as { agents: unknown[] };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.agents, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing agents: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get agent details
server.tool(
  "get_agent",
  "Get detailed information about a specific agent including its full output history.",
  {
    id: z.string().describe("The agent ID"),
  },
  async ({ id }) => {
    try {
      const data = await apiRequest(`/api/agents/${id}`) as { agent: unknown };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.agent, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get agent output
server.tool(
  "get_agent_output",
  "Get the recent terminal output from an agent. Useful for checking what an agent has done or is currently doing.",
  {
    id: z.string().describe("The agent ID"),
    lines: z.number().optional().describe("Number of lines to retrieve (default: 100)"),
  },
  async ({ id, lines = 100 }) => {
    try {
      const data = await apiRequest(`/api/agents/${id}/output?lines=${lines}`) as { output: string; status: string };
      return {
        content: [
          {
            type: "text",
            text: `Agent status: ${data.status}\n\n--- Output ---\n${data.output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting output: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Create agent
server.tool(
  "create_agent",
  "Create a new agent for a specific project. The agent will be in 'idle' state until started. By default, agents run with --dangerously-skip-permissions for autonomous operation.",
  {
    projectPath: z.string().describe("Absolute path to the project directory"),
    name: z.string().optional().describe("Name for the agent (e.g., 'Backend Worker', 'Test Runner')"),
    skills: z.array(z.string()).optional().describe("List of skill names to enable for this agent"),
    character: z
      .enum(["robot", "ninja", "wizard", "astronaut", "knight", "pirate", "alien", "viking"])
      .optional()
      .describe("Visual character for the agent"),
    skipPermissions: z
      .boolean()
      .optional()
      .default(true)
      .describe("If true (default), agent runs with --dangerously-skip-permissions flag for autonomous operation"),
    secondaryProjectPath: z
      .string()
      .optional()
      .describe("Secondary project path to add as context (--add-dir)"),
  },
  async ({ projectPath, name, skills, character, skipPermissions = true, secondaryProjectPath }) => {
    try {
      const data = await apiRequest("/api/agents", "POST", {
        projectPath,
        name,
        skills,
        character,
        skipPermissions,
        secondaryProjectPath,
      }) as { agent: { id: string; name: string } };
      return {
        content: [
          {
            type: "text",
            text: `Created agent "${data.agent.name}" with ID: ${data.agent.id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Start agent
server.tool(
  "start_agent",
  "Start an agent with a specific task/prompt. If agent is already running/waiting, sends the prompt as a message instead. Agents are started with --dangerously-skip-permissions for autonomous operation.",
  {
    id: z.string().describe("The agent ID"),
    prompt: z.string().describe("The task or instruction for the agent to work on"),
    model: z.string().optional().describe("Optional model to use (e.g., 'sonnet', 'opus')"),
  },
  async ({ id, prompt, model }) => {
    try {
      // First check agent status
      const agentData = await apiRequest(`/api/agents/${id}`) as {
        agent: { status: string; name?: string };
      };
      const agentName = agentData.agent.name || id;
      const status = agentData.agent.status;

      // If agent is already running or waiting, send message instead
      if (status === "running" || status === "waiting") {
        await apiRequest(`/api/agents/${id}/message`, "POST", { message: prompt });
        return {
          content: [
            {
              type: "text",
              text: `Agent "${agentName}" was already ${status}. Sent message: "${prompt}"`,
            },
          ],
        };
      }

      // Start the agent with skipPermissions for autonomous operation
      const data = await apiRequest(`/api/agents/${id}/start`, "POST", {
        prompt,
        model,
        skipPermissions: true,
      }) as { success: boolean; agent: { id: string; status: string } };
      return {
        content: [
          {
            type: "text",
            text: `Started agent "${agentName}". Status: ${data.agent.status}\nTask: ${prompt}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error starting agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Stop agent
server.tool(
  "stop_agent",
  "Stop a running agent. The agent will be terminated and return to 'idle' state.",
  {
    id: z.string().describe("The agent ID"),
  },
  async ({ id }) => {
    try {
      await apiRequest(`/api/agents/${id}/stop`, "POST");
      return {
        content: [
          {
            type: "text",
            text: `Stopped agent ${id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error stopping agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Send message to agent
server.tool(
  "send_message",
  "Send input/message to an agent. If the agent is idle, this will START the agent with the message as the prompt (with --dangerously-skip-permissions). If the agent is running/waiting, this sends the message as input.",
  {
    id: z.string().describe("The agent ID"),
    message: z.string().describe("The message to send to the agent"),
  },
  async ({ id, message }) => {
    try {
      // First check agent status
      const agentData = await apiRequest(`/api/agents/${id}`) as {
        agent: { status: string; name?: string };
      };
      const status = agentData.agent.status;

      // If agent is idle/completed/error, START it with the message as prompt
      if (status === "idle" || status === "completed" || status === "error") {
        const startResult = await apiRequest(`/api/agents/${id}/start`, "POST", {
          prompt: message,
          skipPermissions: true,
        }) as { success: boolean; agent: { status: string } };
        return {
          content: [
            {
              type: "text",
              text: `Agent ${agentData.agent.name || id} was ${status}, started it with prompt: "${message}". New status: ${startResult.agent.status}`,
            },
          ],
        };
      }

      // Agent is running or waiting - send message as input
      await apiRequest(`/api/agents/${id}/message`, "POST", { message });
      return {
        content: [
          {
            type: "text",
            text: `Sent message to agent ${agentData.agent.name || id}: "${message}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Remove agent
server.tool(
  "remove_agent",
  "Permanently remove an agent. This will stop the agent if running and delete it from the system.",
  {
    id: z.string().describe("The agent ID"),
  },
  async ({ id }) => {
    try {
      await apiRequest(`/api/agents/${id}`, "DELETE");
      return {
        content: [
          {
            type: "text",
            text: `Removed agent ${id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error removing agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Wait for agent completion
server.tool(
  "wait_for_agent",
  "Poll an agent's status until it completes, errors, or needs input. Returns immediately if agent is idle (use start_agent first) or waiting for input (use send_message).",
  {
    id: z.string().describe("The agent ID"),
    timeoutSeconds: z.number().optional().describe("Maximum time to wait in seconds (default: 300)"),
    pollIntervalSeconds: z.number().optional().describe("How often to check status in seconds (default: 5)"),
  },
  async ({ id, timeoutSeconds = 300, pollIntervalSeconds = 5 }) => {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    const pollIntervalMs = pollIntervalSeconds * 1000;

    try {
      // First check current status
      const initialData = await apiRequest(`/api/agents/${id}`) as {
        agent: { status: string; error?: string; currentTask?: string; name?: string };
      };
      const agentName = initialData.agent.name || id;

      // If agent is idle, tell user to start it first
      if (initialData.agent.status === "idle") {
        return {
          content: [
            {
              type: "text",
              text: `Agent "${agentName}" is idle and not running. Use start_agent or send_message to give it a task first.`,
            },
          ],
        };
      }

      while (Date.now() - startTime < timeoutMs) {
        const data = await apiRequest(`/api/agents/${id}`) as {
          agent: { status: string; error?: string; currentTask?: string; name?: string };
        };
        const status = data.agent.status;

        if (status === "completed") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" completed successfully.`,
              },
            ],
          };
        }

        if (status === "error") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" encountered an error: ${data.agent.error || "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }

        if (status === "idle") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" finished and is now idle.`,
              },
            ],
          };
        }

        // If waiting for input, return immediately - user needs to send a message
        if (status === "waiting") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" is waiting for input. Use send_message to respond, or check get_agent_output to see what it's asking.`,
              },
            ],
          };
        }

        // Still running, continue polling
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      const finalStatus = (await apiRequest(`/api/agents/${id}`) as { agent: { status: string } }).agent.status;
      return {
        content: [
          {
            type: "text",
            text: `Timeout after ${timeoutSeconds}s. Agent "${agentName}" is still '${finalStatus}'. Check get_agent_output to see progress.`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error waiting for agent: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Send message to Telegram
server.tool(
  "send_telegram",
  "Send a message to Telegram. Use this to respond to the user when the request came from Telegram.",
  {
    message: z.string().describe("The message to send to Telegram"),
  },
  async ({ message }) => {
    try {
      await apiRequest("/api/telegram/send", "POST", { message });
      return {
        content: [
          {
            type: "text",
            text: `Message sent to Telegram: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============== Memory Tools ==============

// Tool: Search agent memories
server.tool(
  "search_memory",
  "Search past observations and learnings from agent sessions. Returns matching memories with IDs for further exploration.",
  {
    query: z.string().describe("The search query to find in memory content"),
    agent_id: z.string().optional().describe("Filter by specific agent ID"),
    project_path: z.string().optional().describe("Filter by project path"),
    type: z
      .enum(["tool_use", "message", "file_edit", "command", "decision"])
      .optional()
      .describe("Filter by observation type"),
    limit: z.number().optional().default(20).describe("Maximum results to return (default: 20)"),
  },
  async ({ query, agent_id, project_path, type, limit = 20 }) => {
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (agent_id) params.set("agent_id", agent_id);
      if (project_path) params.set("project", project_path);
      if (type) params.set("type", type);

      const data = (await apiRequest(`/api/memory/search?${params.toString()}`)) as {
        results: Array<{
          id: string;
          type: string;
          content: string;
          agent_id: string;
          project_path: string;
          created_at: number;
        }>;
      };

      if (data.results.length === 0) {
        return {
          content: [{ type: "text", text: "No memories found matching the query." }],
        };
      }

      // Format results compactly (ID + brief content)
      const formatted = data.results.map((r) => {
        const date = new Date(r.created_at).toLocaleDateString();
        const shortContent = r.content.slice(0, 80) + (r.content.length > 80 ? "..." : "");
        return `[${r.id}] (${r.type}, ${date}): ${shortContent}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.results.length} memories:\n\n${formatted.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching memory: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get memory timeline
server.tool(
  "get_memory_timeline",
  "Get chronological context around a specific observation. Shows what happened before and after.",
  {
    observation_id: z.string().describe("The observation ID to center the timeline on"),
    before: z.number().optional().default(5).describe("Number of observations to show before (default: 5)"),
    after: z.number().optional().default(5).describe("Number of observations to show after (default: 5)"),
  },
  async ({ observation_id, before = 5, after = 5 }) => {
    try {
      const params = new URLSearchParams({
        before: String(before),
        after: String(after),
      });

      const data = (await apiRequest(
        `/api/memory/timeline/${observation_id}?${params.toString()}`
      )) as {
        timeline: Array<{
          id: string;
          type: string;
          content: string;
          created_at: number;
          position: "before" | "target" | "after";
        }>;
      };

      if (data.timeline.length === 0) {
        return {
          content: [{ type: "text", text: "Observation not found or has no timeline context." }],
        };
      }

      const formatted = data.timeline.map((entry) => {
        const time = new Date(entry.created_at).toLocaleTimeString();
        const marker = entry.position === "target" ? ">>> " : "    ";
        return `${marker}[${time}] (${entry.type}): ${entry.content.slice(0, 100)}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Timeline (${data.timeline.length} entries):\n\n${formatted.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting timeline: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get full observation details
server.tool(
  "get_observations",
  "Fetch full details for specific observation IDs. Use after search_memory to get complete content.",
  {
    ids: z.array(z.string()).describe("Array of observation IDs to retrieve"),
  },
  async ({ ids }) => {
    try {
      const data = (await apiRequest(`/api/memory/observations?ids=${ids.join(",")}`)) as {
        observations: Array<{
          id: string;
          session_id: string;
          agent_id: string;
          project_path: string;
          type: string;
          content: string;
          metadata: Record<string, unknown> | null;
          created_at: number;
        }>;
      };

      if (data.observations.length === 0) {
        return {
          content: [{ type: "text", text: "No observations found for the provided IDs." }],
        };
      }

      const formatted = data.observations.map((obs) => {
        const date = new Date(obs.created_at).toLocaleString();
        return `=== ${obs.id} ===
Type: ${obs.type}
Agent: ${obs.agent_id}
Project: ${obs.project_path}
Time: ${date}
Content: ${obs.content}
${obs.metadata ? `Metadata: ${JSON.stringify(obs.metadata)}` : ""}`;
      });

      return {
        content: [
          {
            type: "text",
            text: formatted.join("\n\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting observations: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Store explicit memory
server.tool(
  "remember",
  "Store an explicit memory or learning for future reference. Use this to remember important decisions, preferences, or context.",
  {
    agent_id: z.string().describe("The agent ID to associate this memory with"),
    content: z.string().describe("The content to remember"),
    type: z
      .enum(["learning", "decision", "preference", "context"])
      .describe("Type of memory: learning (something learned), decision (a choice made), preference (user preference), context (background info)"),
  },
  async ({ agent_id, content, type }) => {
    try {
      const data = (await apiRequest("/api/memory/remember", "POST", {
        agent_id,
        content,
        type,
      })) as { success: boolean; observation: { id: string } };

      return {
        content: [
          {
            type: "text",
            text: `Stored ${type}: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}" (ID: ${data.observation.id})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error storing memory: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get agent sessions
server.tool(
  "get_memory_sessions",
  "Get recent sessions for an agent. Sessions represent distinct work periods.",
  {
    agent_id: z.string().describe("The agent ID to get sessions for"),
    limit: z.number().optional().default(10).describe("Maximum sessions to return (default: 10)"),
  },
  async ({ agent_id, limit = 10 }) => {
    try {
      const data = (await apiRequest(`/api/memory/sessions/${agent_id}?limit=${limit}`)) as {
        sessions: Array<{
          id: string;
          agent_id: string;
          project_path: string;
          started_at: number;
          ended_at: number | null;
          summary: string | null;
          task: string | null;
        }>;
      };

      if (data.sessions.length === 0) {
        return {
          content: [{ type: "text", text: "No sessions found for this agent." }],
        };
      }

      const formatted = data.sessions.map((s) => {
        const start = new Date(s.started_at).toLocaleString();
        const end = s.ended_at ? new Date(s.ended_at).toLocaleString() : "ongoing";
        const task = s.task ? s.task.slice(0, 60) + (s.task.length > 60 ? "..." : "") : "No task recorded";
        return `[${s.id}]
  Started: ${start}
  Ended: ${end}
  Task: ${task}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `${data.sessions.length} sessions:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting sessions: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get memory stats
server.tool(
  "get_memory_stats",
  "Get statistics about the memory system (total sessions, observations, database size).",
  {},
  async () => {
    try {
      const data = (await apiRequest("/api/memory/stats")) as {
        totalSessions: number;
        totalObservations: number;
        totalSummaries: number;
        dbSizeBytes: number;
      };

      const sizeKB = (data.dbSizeBytes / 1024).toFixed(1);
      const sizeMB = (data.dbSizeBytes / (1024 * 1024)).toFixed(2);

      return {
        content: [
          {
            type: "text",
            text: `Memory Statistics:
- Total Sessions: ${data.totalSessions}
- Total Observations: ${data.totalObservations}
- Total Summaries: ${data.totalSummaries}
- Database Size: ${data.dbSizeBytes > 1024 * 1024 ? sizeMB + " MB" : sizeKB + " KB"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting memory stats: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Manager Orchestrator MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
