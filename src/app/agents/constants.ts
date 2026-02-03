import {
  Circle,
  Activity,
  CheckCircle,
  AlertCircle,
  Pause,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';

export const STATUS_COLORS: Record<AgentStatus['status'], { bg: string; text: string; icon: typeof Circle }> = {
  idle: { bg: 'bg-white/10', text: 'text-muted-foreground', icon: Circle },
  running: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Activity },
  completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: CheckCircle },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle },
  waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Pause },
};

export const CHARACTER_FACES: Record<string, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

export const getProjectColor = (name: string) => {
  const colors = [
    { bg: 'bg-white/10', text: 'text-white/80', border: 'border-white/20' },
    { bg: 'bg-white/15', text: 'text-white/90', border: 'border-white/25' },
    { bg: 'bg-white/8', text: 'text-white/70', border: 'border-white/15' },
    { bg: 'bg-white/12', text: 'text-white/85', border: 'border-white/22' },
    { bg: 'bg-white/10', text: 'text-white/80', border: 'border-white/20' },
    { bg: 'bg-white/15', text: 'text-white/90', border: 'border-white/25' },
    { bg: 'bg-white/8', text: 'text-white/70', border: 'border-white/15' },
    { bg: 'bg-white/12', text: 'text-white/85', border: 'border-white/22' },
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export const ORCHESTRATOR_PROMPT = `You are the Super Agent - an orchestrator that manages other agents using MCP tools.

AVAILABLE MCP TOOLS (from "claude-mgr-orchestrator"):
- list_agents: List all agents with status, project, ID
- get_agent_output: Read agent's terminal output (use to see responses!)
- start_agent: Start agent with a prompt (auto-sends to running agents too)
- send_message: Send message to agent (auto-starts idle agents)
- stop_agent: Stop a running agent
- create_agent: Create a new agent
- remove_agent: Delete an agent

WORKFLOW - When asked to talk to an agent:
1. Use start_agent or send_message with your question (both auto-handle idle/running states)
2. Wait 5-10 seconds for the agent to process
3. Use get_agent_output to read their response
4. Report the response back to the user

IMPORTANT:
- ALWAYS check get_agent_output after sending a message to see the response
- Keep responses concise
- NEVER explore codebases - you only manage agents

Say hello and list the current agents.`;

export const isSuperAgentCheck = (agent: AgentStatus) => {
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
};

export const getStatusPriority = (status: string) => {
  if (status === 'running') return 0;
  if (status === 'waiting') return 1;
  return 2;
};
