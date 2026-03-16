import { agents, saveAgents } from '../../core/agent-manager';
import { findAgentByIdOrSession } from './utils';
import { RouteApp, RouteContext } from './types';
import { AgentStatus } from '../../types';
import { broadcastToAllWindows } from '../../utils/broadcast';
import { scheduleTick } from '../../utils/agents-tick';

export function registerHooksRoutes(app: RouteApp, ctx: RouteContext): void {
  // POST /api/hooks/output — capture clean text output from agent transcript
  app.post('/api/hooks/output', (req, sendJson) => {
    const { agent_id, session_id, output } = req.body as {
      agent_id: string;
      session_id?: string;
      output: string;
    };

    if (!agent_id || !output) {
      sendJson({ error: 'agent_id and output are required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    if (agent) {
      agent.lastCleanOutput = output;
      saveAgents();
    }

    sendJson({ success: true });
  });

  // POST /api/hooks/status
  app.post('/api/hooks/status', (req, sendJson) => {
    const { agent_id, session_id, status, waiting_reason, current_task } = req.body as {
      agent_id: string;
      session_id: string;
      status: 'running' | 'waiting' | 'idle' | 'completed';
      source?: string;
      reason?: string;
      waiting_reason?: string;
      current_task?: string;
    };

    console.log(`[hooks] POST /api/hooks/status — agent_id=${agent_id}, status=${status}, session_id=${session_id}`);

    if (!agent_id || !status) {
      sendJson({ error: 'agent_id and status are required' }, 400);
      return;
    }

    const agent: AgentStatus | undefined = findAgentByIdOrSession(agent_id, session_id);
    if (!agent) {
      sendJson({ success: false, message: 'Agent not found' });
      return;
    }

    const oldStatus = agent.status;

    if (status === 'running' && agent.status !== 'running') {
      agent.status = 'running';
      agent.currentSessionId = session_id;
      if (current_task) agent.currentTask = current_task;
    } else if (status === 'waiting' && agent.status !== 'waiting') {
      agent.status = 'waiting';
    } else if (status === 'idle') {
      agent.status = 'idle';
      agent.currentSessionId = undefined;
    } else if (status === 'completed') {
      agent.status = 'completed';
    }

    agent.lastActivity = new Date().toISOString();

    if (oldStatus !== agent.status) {
      console.log(`[hooks] Status changed: ${agent.id} ${oldStatus} → ${agent.status}`);
      ctx.handleStatusChangeNotificationCallback(agent, agent.status);
      ctx.agentStatusEmitter.emit(`status:${agent.id}`);

      broadcastToAllWindows('agent:status', {
        agentId: agent.id,
        status: agent.status,
        waitingReason: waiting_reason,
      });
      scheduleTick();
    }

    sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
  });

  // POST /api/hooks/task-completed — dedicated endpoint for TaskCompleted hook
  app.post('/api/hooks/task-completed', (req, sendJson) => {
    const { agent_id, session_id } = req.body as {
      agent_id: string;
      session_id?: string;
    };

    if (!agent_id) {
      sendJson({ error: 'agent_id is required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    if (!agent) {
      sendJson({ success: false, message: 'Agent not found' });
      return;
    }

    const oldStatus = agent.status;
    agent.status = 'completed';
    agent.lastActivity = new Date().toISOString();

    const agentName = agent.name || `Agent ${agent.id.slice(0, 6)}`;

    // Send native notification if user has completion notifications enabled
    if (ctx.getAppSettings().notificationsEnabled && ctx.getAppSettings().notifyOnComplete) {
      ctx.sendNotificationCallback(
        `${agentName} finished`,
        agent.currentTask ? `Done: ${agent.currentTask.slice(0, 80)}` : 'Task completed successfully.',
        agent.id,
        ctx.getAppSettings()
      );
    }

    if (oldStatus !== 'completed') {
      console.log(`[hooks] Task completed: ${agent.id} ${oldStatus} → completed`);
      ctx.handleStatusChangeNotificationCallback(agent, 'completed');
      ctx.agentStatusEmitter.emit(`status:${agent.id}`);

      broadcastToAllWindows('agent:status', {
        agentId: agent.id,
        status: agent.status,
      });
      scheduleTick();
    }

    sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
  });

  // POST /api/hooks/agent-stopped — Send notification when agent finishes a response (Stop hook)
  app.post('/api/hooks/agent-stopped', (req, sendJson) => {
    const { agent_id, session_id } = req.body as {
      agent_id: string;
      session_id?: string;
    };

    if (!agent_id) {
      sendJson({ error: 'agent_id is required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    if (!agent) {
      sendJson({ success: false, message: 'Agent not found' });
      return;
    }

    if (ctx.getAppSettings().notificationsEnabled && ctx.getAppSettings().notifyOnStop) {
      const agentName = agent.name || `Agent ${agent.id.slice(0, 6)}`;
      ctx.sendNotificationCallback(
        `${agentName}`,
        agent.lastCleanOutput ? agent.lastCleanOutput.slice(0, 80) : 'Agent has finished and is ready for the next prompt.',
        agent.id,
        ctx.getAppSettings()
      );
    }

    sendJson({ success: true });
  });

  // POST /api/hooks/notification
  app.post('/api/hooks/notification', (req, sendJson) => {
    const { agent_id, session_id, type, title, message } = req.body as {
      agent_id: string;
      session_id: string;
      type: string;
      title: string;
      message: string;
    };

    if (!agent_id || !type) {
      sendJson({ error: 'agent_id and type are required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    const agentName = agent?.name || 'Claude';

    if (type === 'permission_prompt') {
      if (ctx.getAppSettings().notifyOnWaiting) {
        ctx.sendNotificationCallback(
          `${agentName} needs permission`,
          message || 'Claude needs your permission to proceed',
          agent?.id,
          ctx.getAppSettings()
        );
      }
    } else if (type === 'idle_prompt') {
      if (ctx.getAppSettings().notifyOnWaiting) {
        ctx.sendNotificationCallback(
          `${agentName} is waiting`,
          message || 'Claude is waiting for your input',
          agent?.id,
          ctx.getAppSettings()
        );
      }
    }

    broadcastToAllWindows('agent:notification', {
      agentId: agent?.id,
      type,
      title,
      message,
    });

    sendJson({ success: true });
  });
}
