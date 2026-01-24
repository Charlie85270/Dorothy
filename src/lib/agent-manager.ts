import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { AgentConfig, AgentStatus, AgentEvent } from '@/types/agent';

export type { AgentConfig, AgentStatus, AgentEvent };

class AgentManager extends EventEmitter {
  private agents: Map<string, AgentStatus> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  createAgent(config: Omit<AgentConfig, 'id' | 'createdAt'>): AgentStatus {
    const id = uuidv4();
    const status: AgentStatus = {
      id,
      status: 'idle',
      projectPath: config.projectPath,
      skills: config.skills,
      output: [],
      lastActivity: new Date().toISOString(),
    };
    this.agents.set(id, status);
    return status;
  }

  getAgent(id: string): AgentStatus | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentStatus[] {
    return Array.from(this.agents.values());
  }

  async startAgent(id: string, prompt: string, options?: { model?: string; resume?: boolean }): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');

    // Build Claude Code command
    const args: string[] = [];

    // Add model if specified
    if (options?.model) {
      args.push('--model', options.model);
    }

    // Add resume flag
    if (options?.resume) {
      args.push('--resume');
    }

    // Add print mode for easier parsing
    args.push('--print');

    // Add the prompt
    args.push(prompt);

    // Update status
    agent.status = 'running';
    agent.currentTask = prompt.slice(0, 100);
    agent.lastActivity = new Date().toISOString();
    agent.output = [];

    // Spawn the process
    const proc = spawn('claude', args, {
      cwd: agent.projectPath,
      env: {
        ...process.env,
        // Enable skills
        CLAUDE_SKILLS: agent.skills.join(','),
      },
      shell: true,
    });

    this.processes.set(id, proc);

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      agent.output.push(text);
      agent.lastActivity = new Date().toISOString();

      // Parse for progress indicators
      this.parseOutput(id, text);

      this.emit('output', {
        type: 'output',
        agentId: id,
        data: text,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      agent.output.push(`[stderr] ${text}`);

      this.emit('error', {
        type: 'error',
        agentId: id,
        data: text,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    });

    // Handle exit
    proc.on('exit', (code) => {
      agent.status = code === 0 ? 'completed' : 'error';
      agent.lastActivity = new Date().toISOString();
      if (code !== 0) {
        agent.error = `Process exited with code ${code}`;
      }
      this.processes.delete(id);

      this.emit('complete', {
        type: 'complete',
        agentId: id,
        data: `Exited with code ${code}`,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    });
  }

  private parseOutput(agentId: string, text: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Detect tool usage
    if (text.includes('Tool:') || text.includes('Using tool')) {
      this.emit('tool_use', {
        type: 'tool_use',
        agentId,
        data: text,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    }

    // Detect thinking
    if (text.includes('Thinking') || text.includes('...')) {
      agent.status = 'running';
      this.emit('thinking', {
        type: 'thinking',
        agentId,
        data: text,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    }

    // Detect waiting for input
    if (text.includes('?') || text.includes('waiting')) {
      agent.status = 'waiting';
    }

    // Update current task from output
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.length > 10 && lastLine.length < 200) {
        agent.currentTask = lastLine.slice(0, 100);
      }
    }
  }

  stopAgent(id: string): void {
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(id);
    }
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = 'idle';
      agent.lastActivity = new Date().toISOString();
    }
  }

  removeAgent(id: string): void {
    this.stopAgent(id);
    this.agents.delete(id);
  }

  sendInput(id: string, input: string): void {
    const proc = this.processes.get(id);
    if (proc?.stdin) {
      proc.stdin.write(input + '\n');
    }
  }
}

// Singleton instance
export const agentManager = new AgentManager();
