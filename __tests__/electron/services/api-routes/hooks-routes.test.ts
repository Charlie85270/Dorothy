import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('../../../../electron/core/agent-manager', () => ({
  agents: new Map(),
  saveAgents: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { registerHooksRoutes } from '../../../../electron/services/api-routes/hooks-routes';
import { agents, saveAgents } from '../../../../electron/core/agent-manager';
import { RouteApp, RouteContext, RouteRequest, SendJson } from '../../../../electron/services/api-routes/types';
import { AgentStatus, AppSettings } from '../../../../electron/types';

function makeRouteApp(): RouteApp {
  const app: RouteApp = {
    routes: [],
    add(method, pattern, handler) { this.routes.push({ method, pattern, handler }); },
    get(pattern, handler) { this.add('GET', pattern, handler); },
    post(pattern, handler) { this.add('POST', pattern, handler); },
    put(pattern, handler) { this.add('PUT', pattern, handler); },
    delete(pattern, handler) { this.add('DELETE', pattern, handler); },
  };
  return app;
}

function makeAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    id: 'agent-1',
    status: 'idle',
    projectPath: '/test',
    skills: [],
    output: [],
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

function makeReq(body: Record<string, unknown>): RouteRequest {
  return { body, params: {} } as RouteRequest;
}

let ctx: RouteContext;

beforeEach(() => {
  agents.clear();
  vi.mocked(saveAgents).mockClear();
  const appSettings = { notifyOnWaiting: true } as AppSettings;
  ctx = {
    mainWindow: { isDestroyed: () => false, webContents: { send: vi.fn() } } as any,
    appSettings,
    getAppSettings: () => appSettings,
    getTelegramBot: () => null,
    getSlackApp: () => null,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(),
    agentStatusEmitter: new EventEmitter(),
  };
});

describe('hooks-routes', () => {
  function getHandler(app: RouteApp, pattern: string) {
    return app.routes.find(r => r.pattern === pattern)!.handler;
  }

  describe('POST /api/hooks/output', () => {
    it('captures output on agent', async () => {
      const agent = makeAgent();
      agents.set('agent-1', agent);

      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/output');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'agent-1', output: 'hello world' }), sendJson, ctx);

      expect(agent.lastCleanOutput).toBe('hello world');
      expect(saveAgents).toHaveBeenCalled();
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });

    it('returns 400 when agent_id or output missing', async () => {
      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/output');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'agent-1' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'agent_id and output are required' }, 400);
    });

    it('finds agent by session_id fallback', async () => {
      const agent = makeAgent({ id: 'a2', currentSessionId: 'sess-1' });
      agents.set('a2', agent);

      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/output');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'unknown', session_id: 'sess-1', output: 'hi' }), sendJson, ctx);
      expect(agent.lastCleanOutput).toBe('hi');
    });
  });

  describe('POST /api/hooks/status', () => {
    it('transitions agent status and emits events', async () => {
      const agent = makeAgent({ id: 'a1', status: 'idle' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/status');

      const sendJson = vi.fn();
      const emitSpy = vi.spyOn(ctx.agentStatusEmitter, 'emit');
      await handler(makeReq({ agent_id: 'a1', session_id: 'sess', status: 'running' }), sendJson, ctx);

      expect(agent.status).toBe('running');
      expect(agent.currentSessionId).toBe('sess');
      expect(ctx.handleStatusChangeNotificationCallback).toHaveBeenCalledWith(agent, 'running');
      expect(emitSpy).toHaveBeenCalledWith('status:a1');
      expect(sendJson).toHaveBeenCalledWith({ success: true, agent: { id: 'a1', status: 'running' } });
    });

    it('returns 400 when agent_id or status missing', async () => {
      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/status');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'a1' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'agent_id and status are required' }, 400);
    });

    it('returns not found for unknown agent', async () => {
      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/status');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'nope', status: 'running' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ success: false, message: 'Agent not found' });
    });
  });

  describe('POST /api/hooks/notification', () => {
    it('sends permission_prompt notification', async () => {
      const agent = makeAgent({ id: 'a1', name: 'MyAgent' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/notification');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'a1', session_id: 'sess', type: 'permission_prompt', title: 'Test', message: 'help' }), sendJson, ctx);

      expect(ctx.sendNotificationCallback).toHaveBeenCalledWith('MyAgent needs permission', 'help', 'a1', expect.objectContaining({ notifyOnWaiting: true }));
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });

    it('returns 400 when agent_id or type missing', async () => {
      const app = makeRouteApp();
      registerHooksRoutes(app, ctx);
      const handler = getHandler(app, '/api/hooks/notification');

      const sendJson = vi.fn();
      await handler(makeReq({ agent_id: 'a1' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'agent_id and type are required' }, 400);
    });
  });
});
