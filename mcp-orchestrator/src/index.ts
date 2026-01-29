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
  "Create a new agent for a specific project. The agent will be in 'idle' state until started.",
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
      .describe("If true, agent runs with --dangerously-skip-permissions flag"),
    secondaryProjectPath: z
      .string()
      .optional()
      .describe("Secondary project path to add as context (--add-dir)"),
  },
  async ({ projectPath, name, skills, character, skipPermissions, secondaryProjectPath }) => {
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
  "Start an agent with a specific task/prompt. The agent will begin working on the task immediately.",
  {
    id: z.string().describe("The agent ID"),
    prompt: z.string().describe("The task or instruction for the agent to work on"),
    model: z.string().optional().describe("Optional model to use (e.g., 'sonnet', 'opus')"),
  },
  async ({ id, prompt, model }) => {
    try {
      const data = await apiRequest(`/api/agents/${id}/start`, "POST", {
        prompt,
        model,
      }) as { success: boolean; agent: { id: string; status: string } };
      return {
        content: [
          {
            type: "text",
            text: `Started agent ${id}. Status: ${data.agent.status}\nTask: ${prompt}`,
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
  "Send input/message to an agent that is waiting for input. Use this to respond to prompts or provide additional instructions.",
  {
    id: z.string().describe("The agent ID"),
    message: z.string().describe("The message to send to the agent"),
  },
  async ({ id, message }) => {
    try {
      await apiRequest(`/api/agents/${id}/message`, "POST", { message });
      return {
        content: [
          {
            type: "text",
            text: `Sent message to agent ${id}: "${message}"`,
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
  "Poll an agent's status until it completes, errors, or times out. Useful for synchronizing multiple agents.",
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
      while (Date.now() - startTime < timeoutMs) {
        const data = await apiRequest(`/api/agents/${id}`) as {
          agent: { status: string; error?: string; currentTask?: string };
        };
        const status = data.agent.status;

        if (status === "completed") {
          return {
            content: [
              {
                type: "text",
                text: `Agent ${id} completed successfully.`,
              },
            ],
          };
        }

        if (status === "error") {
          return {
            content: [
              {
                type: "text",
                text: `Agent ${id} encountered an error: ${data.agent.error || "Unknown error"}`,
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
                text: `Agent ${id} is idle (not running).`,
              },
            ],
          };
        }

        // Still running or waiting, continue polling
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      return {
        content: [
          {
            type: "text",
            text: `Timeout waiting for agent ${id} after ${timeoutSeconds} seconds. Agent is still in '${(await apiRequest(`/api/agents/${id}`) as { agent: { status: string } }).agent.status}' state.`,
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
