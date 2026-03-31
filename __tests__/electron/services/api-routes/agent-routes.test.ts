import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const mockPtyProcess = {
  onData: vi.fn(),
  onExit: vi.fn(),
  kill: vi.fn(),
  write: vi.fn(),
};

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => mockPtyProcess),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/Users/test' },
  BrowserWindow: vi.fn(),
}));

vi.mock('../../../../electron/core/agent-manager', () => ({
  agents: new Map(),
  saveAgents: vi.fn(),
  initAgentPty: vi.fn(),
}));

vi.mock('../../../../electron/core/pty-manager', () => ({
  ptyProcesses: new Map(),
  writeProgrammaticInput: vi.fn(),
}));

vi.mock('../../../../electron/utils/path-builder', () => ({
  buildFullPath: vi.fn(() => '/usr/bin'),
}));

import { registerAgentRoutes } from '../../../../electron/services/api-routes/agent-routes';
import { agents, saveAgents } from '../../../../electron/core/agent-manager';
import { ptyProcesses, writeProgrammaticInput } from '../../../../electron/core/pty-manager';
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
    projectPath: '/test/project',
    skills: [],
    output: [],
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

function makeReq(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    method: 'GET',
    pathname: '',
    url: new URL('http://localhost/'),
    body: {},
    raw: {} as any,
    res: {} as any,
    params: {},
    ...overrides,
  };
}

let ctx: RouteContext;

beforeEach(() => {
  agents.clear();
  ptyProcesses.clear();
  vi.mocked(saveAgents).mockClear();
  mockPtyProcess.onData.mockClear();
  mockPtyProcess.onExit.mockClear();
  mockPtyProcess.kill.mockClear();

  ctx = {
    mainWindow: { isDestroyed: () => false, webContents: { send: vi.fn() } } as any,
    appSettings: {} as AppSettings,
    getTelegramBot: () => null,
    getSlackApp: () => null,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(async () => 'new-pty-id'),
    agentStatusEmitter: new EventEmitter(),
  };
});

describe('agent-routes', () => {
  function findHandler(app: RouteApp, method: string, patternStr: string) {
    return app.routes.find(r => r.method === method && String(r.pattern).includes(patternStr))!.handler;
  }

  describe('GET /api/agents', () => {
    it('returns list of agents', async () => {
      agents.set('a1', makeAgent({ id: 'a1', name: 'Agent A' }));
      agents.set('a2', makeAgent({ id: 'a2', name: 'Agent B' }));

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/agents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq(), sendJson, ctx);

      expect(sendJson).toHaveBeenCalledTimes(1);
      const result = sendJson.mock.calls[0][0];
      expect(result.agents).toHaveLength(2);
    });
  });

  describe('GET /api/agents/:id', () => {
    it('returns single agent', async () => {
      const agent = makeAgent({ id: 'a1' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'agents\\/([^/]+)$');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' } }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ agent });
    });

    it('returns 404 for missing agent', async () => {
      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'agents\\/([^/]+)$');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'nope' } }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'Agent not found' }, 404);
    });
  });

  describe('GET /api/agents/:id/output', () => {
    it('returns agent output', async () => {
      const agent = makeAgent({ id: 'a1', output: ['line1', 'line2', 'line3'], status: 'running' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'output');

      const sendJson = vi.fn();
      const url = new URL('http://localhost/api/agents/a1/output?lines=2');
      await handler(makeReq({ params: { id: 'a1' }, url }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ output: 'line2line3', status: 'running' });
    });
  });

  describe('POST /api/agents', () => {
    it('creates a new agent', async () => {
      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/agents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: { projectPath: '/my/project', name: 'Test Agent' } }), sendJson, ctx);

      expect(sendJson).toHaveBeenCalledTimes(1);
      const result = sendJson.mock.calls[0][0];
      expect(result.agent.name).toBe('Test Agent');
      expect(result.agent.status).toBe('idle');
      expect(agents.size).toBe(1);
      expect(saveAgents).toHaveBeenCalled();
    });

    it('returns 400 without projectPath', async () => {
      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/agents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: {} }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'projectPath is required' }, 400);
    });
  });

  describe('POST /api/agents/:id/stop', () => {
    it('stops a running agent', async () => {
      const mockPty = { kill: vi.fn() };
      ptyProcesses.set('pty-1', mockPty as any);
      const agent = makeAgent({ id: 'a1', status: 'running', ptyId: 'pty-1' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'stop');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' } }), sendJson, ctx);

      expect(mockPty.kill).toHaveBeenCalled();
      expect(agent.status).toBe('idle');
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('POST /api/agents/:id/message', () => {
    it('sends message to agent PTY', async () => {
      const mockPty = { write: vi.fn() };
      ptyProcesses.set('pty-1', mockPty as any);
      const agent = makeAgent({ id: 'a1', status: 'running', ptyId: 'pty-1' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'message');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' }, body: { message: 'hello' } }), sendJson, ctx);

      expect(writeProgrammaticInput).toHaveBeenCalledWith(mockPty, 'hello', true);
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });

    it('initializes PTY if not present', async () => {
      const mockPty = { write: vi.fn() };
      const agent = makeAgent({ id: 'a1', status: 'waiting' });
      agents.set('a1', agent);

      // initAgentPtyCallback returns 'new-pty-id', so set up that PTY
      ptyProcesses.set('new-pty-id', mockPty as any);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'message');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' }, body: { message: 'hello' } }), sendJson, ctx);

      expect(ctx.initAgentPtyCallback).toHaveBeenCalledWith(agent);
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('deletes agent and kills PTY', async () => {
      const mockPty = { kill: vi.fn() };
      ptyProcesses.set('pty-1', mockPty as any);
      const agent = makeAgent({ id: 'a1', ptyId: 'pty-1' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'DELETE', 'agents');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' } }), sendJson, ctx);

      expect(mockPty.kill).toHaveBeenCalled();
      expect(agents.has('a1')).toBe(false);
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /api/agents/:id/wait', () => {
    it('returns immediately for terminal state', async () => {
      const agent = makeAgent({ id: 'a1', status: 'completed', lastCleanOutput: 'done' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'wait');

      const sendJson = vi.fn();
      const url = new URL('http://localhost/api/agents/a1/wait');
      await handler(makeReq({ params: { id: 'a1' }, url }), sendJson, ctx);

      expect(sendJson).toHaveBeenCalledWith({
        status: 'completed',
        lastCleanOutput: 'done',
        error: undefined,
      });
    });
  });
});
