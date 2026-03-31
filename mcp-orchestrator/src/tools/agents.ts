/**
 * Agent management tools for the MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../utils/api.js";

export function registerAgentTools(server: McpServer): void {
  // Tool: List all agents
  server.tool(
    "list_agents",
    "List all agents and their current status. Returns agent IDs, names, status (idle/running/waiting/completed/error), projects, and current tasks.",
    {},
    async () => {
      try {
        const data = (await apiRequest("/api/agents")) as { agents: unknown[] };
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
        const data = (await apiRequest(`/api/agents/${id}`)) as { agent: unknown };
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

  // Tool: Get agent output (clean text from transcript, no ANSI)
  server.tool(
    "get_agent_output",
    "Get the agent's last response as clean text (no terminal formatting). This is captured from the agent's transcript by hooks. Falls back to noting output is available in terminal view if no clean output is captured yet.",
    {
      id: z.string().describe("The agent ID"),
    },
    async ({ id }) => {
      try {
        const data = (await apiRequest(`/api/agents/${id}`)) as {
          agent: {
            status: string;
            name?: string;
            lastCleanOutput?: string;
          };
        };
        const agentName = data.agent.name || id;

        if (data.agent.lastCleanOutput) {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" (${data.agent.status}):\n\n${data.agent.lastCleanOutput}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Agent "${agentName}" (${data.agent.status}): No clean output captured yet. The agent's terminal output is available in the Dorothy UI. Clean output is captured when the agent pauses or completes.`,
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
      secondaryProjectPath: z.string().optional().describe("Secondary project path to add as context (--add-dir)"),
    },
    async ({ projectPath, name, skills, character, skipPermissions = true, secondaryProjectPath }) => {
      try {
        const data = (await apiRequest("/api/agents", "POST", {
          projectPath,
          name,
          skills,
          character,
          skipPermissions,
          secondaryProjectPath,
        })) as { agent: { id: string; name: string } };
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
        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; name?: string };
        };
        const agentName = agentData.agent.name || id;
        const status = agentData.agent.status;

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

        const data = (await apiRequest(`/api/agents/${id}/start`, "POST", {
          prompt,
          model,
          skipPermissions: true,
        })) as { success: boolean; agent: { id: string; status: string } };
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
    "Send input/message to an agent. If the agent is idle/completed/error, this will START the agent with the message as the prompt. If the agent is 'waiting', this sends the message as input. WARNING: Sending to a 'running' agent may interfere with its current work — prefer waiting until it reaches 'waiting' or 'completed' status.",
    {
      id: z.string().describe("The agent ID"),
      message: z.string().optional().describe("The message to send to the agent"),
      prompt: z.string().optional().describe("Alias for 'message' — use either one"),
    },
    async ({ id, message, prompt }) => {
      // Accept either "message" or "prompt" so the LLM doesn't trip on naming
      const resolvedMessage = message || prompt;
      if (!resolvedMessage) {
        return {
          content: [{ type: "text", text: "Error: either 'message' or 'prompt' is required." }],
          isError: true,
        };
      }
      try {
        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; name?: string };
        };
        const status = agentData.agent.status;
        const agentName = agentData.agent.name || id;

        if (status === "idle" || status === "completed" || status === "error") {
          const startResult = (await apiRequest(`/api/agents/${id}/start`, "POST", {
            prompt: resolvedMessage,
            skipPermissions: true,
          })) as { success: boolean; agent: { status: string } };
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" was ${status}, started it with prompt: "${resolvedMessage}". New status: ${startResult.agent.status}`,
              },
            ],
          };
        }

        if (status === "running") {
          await apiRequest(`/api/agents/${id}/message`, "POST", { message: resolvedMessage });
          return {
            content: [
              {
                type: "text",
                text: `⚠️ Agent "${agentName}" is currently running. Message sent but may interfere with current work. Consider using wait_for_agent first to wait until the agent is done.\nMessage sent: "${resolvedMessage}"`,
              },
            ],
          };
        }

        await apiRequest(`/api/agents/${id}/message`, "POST", { message: resolvedMessage });
        return {
          content: [
            {
              type: "text",
              text: `Sent message to agent "${agentName}" (${status}): "${resolvedMessage}"`,
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

  // Tool: Wait for agent completion (long-poll, no polling loop)
  server.tool(
    "wait_for_agent",
    "Wait for an agent to finish its current task. Uses long-polling for efficient waiting — returns as soon as the agent's status changes (no 5-second polling delay). Returns immediately if agent is already idle/waiting/completed/error.",
    {
      id: z.string().describe("The agent ID"),
      timeoutSeconds: z.number().optional().describe("Maximum time to wait in seconds (default: 300)"),
    },
    async ({ id, timeoutSeconds = 300 }) => {
      try {
        // Single long-poll request to the wait endpoint
        const data = (await apiRequest(
          `/api/agents/${id}/wait?timeout=${timeoutSeconds}`
        )) as {
          status: string;
          lastCleanOutput?: string;
          error?: string;
          timeout?: boolean;
        };

        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { name?: string };
        };
        const agentName = agentData.agent.name || id;

        if (data.timeout) {
          return {
            content: [
              {
                type: "text",
                text: `Timeout after ${timeoutSeconds}s. Agent "${agentName}" is still '${data.status}'. Use get_agent_output to check progress.`,
              },
            ],
            isError: true,
          };
        }

        if (data.status === "completed" || data.status === "idle") {
          const outputInfo = data.lastCleanOutput
            ? `\n\nOutput:\n${data.lastCleanOutput}`
            : "\n\nUse get_agent_output to read the result.";
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" finished (${data.status}).${outputInfo}`,
              },
            ],
          };
        }

        if (data.status === "error") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" encountered an error: ${data.error || "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }

        if (data.status === "waiting") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" is waiting for input. Use send_message to respond, or get_agent_output to see what it's asking.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Agent "${agentName}" status: ${data.status}`,
            },
          ],
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

  // Tool: Delegate task (composite: start + wait + get output)
  server.tool(
    "delegate_task",
    "Delegate a task to an agent and wait for the result. This is the primary tool for task delegation — it starts the agent, waits for completion using long-polling, and returns the clean text result. Much more efficient than calling start_agent + wait_for_agent + get_agent_output separately.",
    {
      id: z.string().describe("The agent ID to delegate to"),
      prompt: z.string().describe("The task/instruction for the agent"),
      model: z.string().optional().describe("Optional model to use (e.g., 'sonnet', 'opus')"),
      timeoutSeconds: z.number().optional().describe("Maximum time to wait in seconds (default: 300)"),
    },
    async ({ id, prompt, model, timeoutSeconds = 300 }) => {
      try {
        // Get agent info
        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; name?: string };
        };
        const agentName = agentData.agent.name || id;
        const status = agentData.agent.status;

        // Start or send message
        if (status === "running" || status === "waiting") {
          await apiRequest(`/api/agents/${id}/message`, "POST", { message: prompt });
        } else {
          await apiRequest(`/api/agents/${id}/start`, "POST", {
            prompt,
            model,
            skipPermissions: true,
          });
        }

        // Wait for completion via long-poll
        const waitData = (await apiRequest(
          `/api/agents/${id}/wait?timeout=${timeoutSeconds}`
        )) as {
          status: string;
          lastCleanOutput?: string;
          error?: string;
          timeout?: boolean;
        };

        if (waitData.timeout) {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" is still running after ${timeoutSeconds}s. Use wait_for_agent to continue waiting, or get_agent_output to check progress.`,
              },
            ],
            isError: true,
          };
        }

        if (waitData.status === "error") {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" failed: ${waitData.error || "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }

        if (waitData.status === "waiting") {
          // Agent asked for confirmation — auto-reply "continue" and wait again
          try {
            await apiRequest(`/api/agents/${id}/message`, "POST", {
              message: "Yes, continue. Do not ask for confirmation — complete the task and report your results.",
            });
            // Wait again for the agent to finish
            const retryData = (await apiRequest(
              `/api/agents/${id}/wait?timeout=${Math.max(timeoutSeconds - 30, 60)}`
            )) as {
              status: string;
              lastCleanOutput?: string;
              error?: string;
              timeout?: boolean;
            };

            if (retryData.status === "waiting") {
              // Still waiting after retry — give up and let orchestrator handle it
              const outputInfo = retryData.lastCleanOutput
                ? `\n\nAgent output:\n${retryData.lastCleanOutput}`
                : "";
              return {
                content: [
                  {
                    type: "text",
                    text: `Agent "${agentName}" is still waiting for input after auto-continue.${outputInfo}\n\nUse send_message to respond.`,
                  },
                ],
              };
            }

            if (retryData.timeout) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Agent "${agentName}" is still running after auto-continue. Use wait_for_agent to continue waiting.`,
                  },
                ],
                isError: true,
              };
            }

            // Agent finished after auto-continue — get output
            const retryAgent = (await apiRequest(`/api/agents/${id}`)) as {
              agent: { lastCleanOutput?: string; status: string };
            };
            const retryOutput = retryAgent.agent.lastCleanOutput || retryData.lastCleanOutput;
            if (retryOutput) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Agent "${agentName}" completed.\n\n${retryOutput}`,
                  },
                ],
              };
            }
          } catch {
            // If auto-continue fails, fall through to original behavior
          }

          const outputInfo = waitData.lastCleanOutput
            ? `\n\nAgent output:\n${waitData.lastCleanOutput}`
            : "";
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" is waiting for input.${outputInfo}\n\nUse send_message to respond.`,
              },
            ],
          };
        }

        // Completed or idle — get the output
        // Re-fetch to get latest lastCleanOutput (hooks may have updated it)
        const finalAgent = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { lastCleanOutput?: string; status: string };
        };

        const output = finalAgent.agent.lastCleanOutput || waitData.lastCleanOutput;

        if (output) {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentName}" completed.\n\n${output}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Agent "${agentName}" completed (${waitData.status}). No clean output captured — check the agent's terminal in Dorothy UI for details.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error delegating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
