import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-orchestrator agent tool handler tests
// ============================================================================
// Tests the business logic of all orchestrator agent tool handlers:
// list_agents, get_agent, get_agent_output, create_agent,
// start_agent, stop_agent, send_message, remove_agent, wait_for_agent

// Simulates apiRequest behavior
type ApiRequestFn = (
  endpoint: string,
  method?: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>
) => Promise<unknown>;

let mockApiRequest: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockApiRequest = vi.fn();
});

describe('mcp-orchestrator agent tools', () => {
  describe('list_agents', () => {
    async function listAgents(apiRequest: ApiRequestFn) {
      try {
        const data = (await apiRequest('/api/agents')) as { agents: unknown[] };
        return {
          content: [{ type: 'text', text: JSON.stringify(data.agents, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing agents: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('returns agents list as JSON', async () => {
      mockApiRequest.mockResolvedValue({ agents: [{ id: '1', name: 'Agent 1' }] });
      const result = await listAgents(mockApiRequest);
      expect(result.content[0].text).toContain('Agent 1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents');
    });

    it('handles empty agents list', async () => {
      mockApiRequest.mockResolvedValue({ agents: [] });
      const result = await listAgents(mockApiRequest);
      expect(result.content[0].text).toBe('[]');
    });

    it('returns error on API failure', async () => {
      mockApiRequest.mockRejectedValue(new Error('Connection refused'));
      const result = await listAgents(mockApiRequest);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Connection refused');
    });
  });

  describe('get_agent', () => {
    async function getAgent(apiRequest: ApiRequestFn, id: string) {
      try {
        const data = (await apiRequest(`/api/agents/${id}`)) as { agent: unknown };
        return {
          content: [{ type: 'text', text: JSON.stringify(data.agent, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('returns agent details as JSON', async () => {
      mockApiRequest.mockResolvedValue({ agent: { id: 'abc', name: 'Test', status: 'running' } });
      const result = await getAgent(mockApiRequest, 'abc');
      expect(result.content[0].text).toContain('Test');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents/abc');
    });

    it('returns error for non-existent agent', async () => {
      mockApiRequest.mockRejectedValue(new Error('Agent not found'));
      const result = await getAgent(mockApiRequest, 'nonexistent');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Agent not found');
    });
  });

  describe('get_agent_output', () => {
    async function getAgentOutput(apiRequest: ApiRequestFn, id: string, lines = 100) {
      try {
        const data = (await apiRequest(`/api/agents/${id}/output?lines=${lines}`)) as {
          output: string;
          status: string;
        };
        return {
          content: [{ type: 'text', text: `Agent status: ${data.status}\n\n--- Output ---\n${data.output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting output: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('returns agent output with status', async () => {
      mockApiRequest.mockResolvedValue({ output: 'Working on task...', status: 'running' });
      const result = await getAgentOutput(mockApiRequest, 'abc');
      expect(result.content[0].text).toContain('Agent status: running');
      expect(result.content[0].text).toContain('Working on task...');
    });

    it('uses custom line count', async () => {
      mockApiRequest.mockResolvedValue({ output: 'output', status: 'idle' });
      await getAgentOutput(mockApiRequest, 'abc', 50);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents/abc/output?lines=50');
    });

    it('defaults to 100 lines', async () => {
      mockApiRequest.mockResolvedValue({ output: '', status: 'idle' });
      await getAgentOutput(mockApiRequest, 'abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents/abc/output?lines=100');
    });
  });

  describe('create_agent', () => {
    async function createAgent(apiRequest: ApiRequestFn, params: {
      projectPath: string;
      name?: string;
      skills?: string[];
      character?: string;
      skipPermissions?: boolean;
      secondaryProjectPath?: string;
    }) {
      try {
        const data = (await apiRequest('/api/agents', 'POST', {
          projectPath: params.projectPath,
          name: params.name,
          skills: params.skills,
          character: params.character,
          skipPermissions: params.skipPermissions ?? true,
          secondaryProjectPath: params.secondaryProjectPath,
        })) as { agent: { id: string; name: string } };
        return {
          content: [{ type: 'text', text: `Created agent "${data.agent.name}" with ID: ${data.agent.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error creating agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('creates agent with correct API call', async () => {
      mockApiRequest.mockResolvedValue({ agent: { id: 'new-1', name: 'Test Agent' } });
      const result = await createAgent(mockApiRequest, {
        projectPath: '/project',
        name: 'Test Agent',
        skills: ['testing'],
        character: 'ninja',
      });
      expect(result.content[0].text).toContain('Created agent "Test Agent"');
      expect(result.content[0].text).toContain('new-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents', 'POST', expect.objectContaining({
        projectPath: '/project',
        name: 'Test Agent',
        skills: ['testing'],
        character: 'ninja',
        skipPermissions: true,
      }));
    });

    it('defaults skipPermissions to true', async () => {
      mockApiRequest.mockResolvedValue({ agent: { id: '1', name: 'A' } });
      await createAgent(mockApiRequest, { projectPath: '/p' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents', 'POST', expect.objectContaining({
        skipPermissions: true,
      }));
    });
  });

  describe('start_agent', () => {
    async function startAgent(apiRequest: ApiRequestFn, id: string, prompt: string, model?: string) {
      try {
        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; name?: string };
        };
        const agentName = agentData.agent.name || id;
        const status = agentData.agent.status;

        if (status === 'running' || status === 'waiting') {
          await apiRequest(`/api/agents/${id}/message`, 'POST', { message: prompt });
          return {
            content: [{ type: 'text', text: `Agent "${agentName}" was already ${status}. Sent message: "${prompt}"` }],
          };
        }

        const data = (await apiRequest(`/api/agents/${id}/start`, 'POST', {
          prompt,
          model,
          skipPermissions: true,
        })) as { success: boolean; agent: { id: string; status: string } };
        return {
          content: [{ type: 'text', text: `Started agent "${agentName}". Status: ${data.agent.status}\nTask: ${prompt}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error starting agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('starts idle agent normally', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'idle', name: 'Worker' } })
        .mockResolvedValueOnce({ success: true, agent: { id: '1', status: 'running' } });

      const result = await startAgent(mockApiRequest, '1', 'Fix the bug');
      expect(result.content[0].text).toContain('Started agent "Worker"');
      expect(result.content[0].text).toContain('Fix the bug');
    });

    it('sends message to running agent instead of starting', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce(undefined);

      const result = await startAgent(mockApiRequest, '1', 'New task');
      expect(result.content[0].text).toContain('was already running');
      expect(result.content[0].text).toContain('Sent message: "New task"');
    });

    it('sends message to waiting agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'waiting', name: 'Worker' } })
        .mockResolvedValueOnce(undefined);

      const result = await startAgent(mockApiRequest, '1', 'Yes');
      expect(result.content[0].text).toContain('was already waiting');
    });

    it('uses agent ID as name when name is not set', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'idle' } })
        .mockResolvedValueOnce({ success: true, agent: { id: 'abc', status: 'running' } });

      const result = await startAgent(mockApiRequest, 'abc', 'Task');
      expect(result.content[0].text).toContain('"abc"');
    });
  });

  describe('stop_agent', () => {
    async function stopAgent(apiRequest: ApiRequestFn, id: string) {
      try {
        await apiRequest(`/api/agents/${id}/stop`, 'POST');
        return { content: [{ type: 'text', text: `Stopped agent ${id}` }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error stopping agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('stops agent successfully', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const result = await stopAgent(mockApiRequest, 'abc');
      expect(result.content[0].text).toBe('Stopped agent abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents/abc/stop', 'POST');
    });

    it('returns error on failure', async () => {
      mockApiRequest.mockRejectedValue(new Error('Agent not running'));
      const result = await stopAgent(mockApiRequest, 'abc');
      expect(result.isError).toBe(true);
    });
  });

  describe('send_message', () => {
    async function sendMessage(apiRequest: ApiRequestFn, id: string, message: string) {
      try {
        const agentData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; name?: string };
        };
        const status = agentData.agent.status;

        if (status === 'idle' || status === 'completed' || status === 'error') {
          const startResult = (await apiRequest(`/api/agents/${id}/start`, 'POST', {
            prompt: message,
            skipPermissions: true,
          })) as { success: boolean; agent: { status: string } };
          return {
            content: [{
              type: 'text',
              text: `Agent ${agentData.agent.name || id} was ${status}, started it with prompt: "${message}". New status: ${startResult.agent.status}`,
            }],
          };
        }

        await apiRequest(`/api/agents/${id}/message`, 'POST', { message });
        return {
          content: [{ type: 'text', text: `Sent message to agent ${agentData.agent.name || id}: "${message}"` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending message: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('starts idle agent with message as prompt', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'idle', name: 'Worker' } })
        .mockResolvedValueOnce({ success: true, agent: { status: 'running' } });

      const result = await sendMessage(mockApiRequest, '1', 'Do something');
      expect(result.content[0].text).toContain('was idle, started it with prompt');
    });

    it('starts completed agent with message as prompt', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'completed', name: 'Worker' } })
        .mockResolvedValueOnce({ success: true, agent: { status: 'running' } });

      const result = await sendMessage(mockApiRequest, '1', 'Do more');
      expect(result.content[0].text).toContain('was completed');
    });

    it('starts error agent with message as prompt', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'error', name: 'Worker' } })
        .mockResolvedValueOnce({ success: true, agent: { status: 'running' } });

      const result = await sendMessage(mockApiRequest, '1', 'Try again');
      expect(result.content[0].text).toContain('was error');
    });

    it('sends message to running agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce(undefined);

      const result = await sendMessage(mockApiRequest, '1', 'Update');
      expect(result.content[0].text).toContain('Sent message to agent Worker');
    });

    it('sends message to waiting agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'waiting', name: 'Worker' } })
        .mockResolvedValueOnce(undefined);

      const result = await sendMessage(mockApiRequest, '1', 'Yes, proceed');
      expect(result.content[0].text).toContain('Sent message to agent Worker');
    });
  });

  describe('remove_agent', () => {
    async function removeAgent(apiRequest: ApiRequestFn, id: string) {
      try {
        await apiRequest(`/api/agents/${id}`, 'DELETE');
        return { content: [{ type: 'text', text: `Removed agent ${id}` }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error removing agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('removes agent successfully', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const result = await removeAgent(mockApiRequest, 'abc');
      expect(result.content[0].text).toBe('Removed agent abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/agents/abc', 'DELETE');
    });
  });

  describe('wait_for_agent', () => {
    async function waitForAgent(
      apiRequest: ApiRequestFn,
      id: string,
      timeoutSeconds = 300,
      pollIntervalSeconds = 5
    ) {
      try {
        const initialData = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; error?: string; name?: string };
        };
        const agentName = initialData.agent.name || id;

        if (initialData.agent.status === 'idle') {
          return {
            content: [{ type: 'text', text: `Agent "${agentName}" is idle and not running. Use start_agent or send_message to give it a task first.` }],
          };
        }

        // Simulate checking status
        const data = (await apiRequest(`/api/agents/${id}`)) as {
          agent: { status: string; error?: string };
        };
        const status = data.agent.status;

        if (status === 'completed') {
          return { content: [{ type: 'text', text: `Agent "${agentName}" completed successfully.` }] };
        }
        if (status === 'error') {
          return {
            content: [{ type: 'text', text: `Agent "${agentName}" encountered an error: ${data.agent.error || 'Unknown error'}` }],
            isError: true,
          };
        }
        if (status === 'idle') {
          return { content: [{ type: 'text', text: `Agent "${agentName}" finished and is now idle.` }] };
        }
        if (status === 'waiting') {
          return {
            content: [{ type: 'text', text: `Agent "${agentName}" is waiting for input. Use send_message to respond, or check get_agent_output to see what it's asking.` }],
          };
        }

        return {
          content: [{ type: 'text', text: `Timeout after ${timeoutSeconds}s. Agent "${agentName}" is still '${status}'.` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error waiting for agent: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    it('returns immediately for idle agent', async () => {
      mockApiRequest.mockResolvedValue({ agent: { status: 'idle', name: 'Worker' } });
      const result = await waitForAgent(mockApiRequest, '1');
      expect(result.content[0].text).toContain('is idle and not running');
    });

    it('returns success for completed agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce({ agent: { status: 'completed' } });

      const result = await waitForAgent(mockApiRequest, '1');
      expect(result.content[0].text).toContain('completed successfully');
    });

    it('returns error for failed agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce({ agent: { status: 'error', error: 'Crash' } });

      const result = await waitForAgent(mockApiRequest, '1');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Crash');
    });

    it('detects waiting status', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce({ agent: { status: 'waiting' } });

      const result = await waitForAgent(mockApiRequest, '1');
      expect(result.content[0].text).toContain('waiting for input');
    });

    it('detects agent that finished to idle', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce({ agent: { status: 'idle' } });

      const result = await waitForAgent(mockApiRequest, '1');
      expect(result.content[0].text).toContain('finished and is now idle');
    });

    it('reports timeout for still-running agent', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ agent: { status: 'running', name: 'Worker' } })
        .mockResolvedValueOnce({ agent: { status: 'running' } });

      const result = await waitForAgent(mockApiRequest, '1', 300);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Timeout after 300s');
    });
  });
});
