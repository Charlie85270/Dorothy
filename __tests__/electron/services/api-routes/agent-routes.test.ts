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
  killStalePty: vi.fn(),
}));

vi.mock('../../../../electron/core/pty-manager', () => ({
  ptyProcesses: new Map(),
  writeProgrammaticInput: vi.fn(),
}));

vi.mock('../../../../electron/utils/path-builder', () => ({
  buildFullPath: vi.fn(() => '/usr/bin'),
}));

import { registerAgentRoutes } from '../../../../electron/services/api-routes/agent-routes';
import { agents, saveAgents, killStalePty } from '../../../../electron/core/agent-manager';
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
  vi.mocked(killStalePty).mockClear();
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

  describe('POST /api/agents/:id/start', () => {
    it('kills existing PTY before spawning a new one', async () => {
      const existingPty = { kill: vi.fn() };
      ptyProcesses.set('existing-pty', existingPty as any);
      const agent = makeAgent({ id: 'a1', status: 'idle', ptyId: 'existing-pty' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'start');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' }, body: { prompt: 'Do something' } }), sendJson, ctx);

      expect(existingPty.kill).toHaveBeenCalled();
      expect(ptyProcesses.has('existing-pty')).toBe(false);
      expect(sendJson).toHaveBeenCalledWith({ success: true, agent: { id: 'a1', status: 'running' } });
    });

    it('transitions waiting→error when PTY exits while agent is waiting', async () => {
      const agent = makeAgent({ id: 'a1', status: 'idle' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'start');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' }, body: { prompt: 'Do something' } }), sendJson, ctx);

      // Simulate status being set to 'waiting' by a hook while the PTY is running
      agent.status = 'waiting';

      // Simulate PTY exit
      const exitHandler = mockPtyProcess.onExit.mock.calls[0][0] as (args: { exitCode: number }) => void;
      exitHandler({ exitCode: 1 });

      // After the 1500ms delay, status should become 'error' not stay 'waiting'
      await new Promise(r => setTimeout(r, 1600));
      expect(agent.status).toBe('error');
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

    it('auto-respawns PTY with message as prompt when PTY is missing', async () => {
      const agent = makeAgent({ id: 'a1', status: 'waiting', projectPath: '/test/project' });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'message');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'a1' }, body: { message: 'continue the task' } }), sendJson, ctx);

      // Should NOT call the legacy initAgentPtyCallback (bare bash shell)
      expect(ctx.initAgentPtyCallback).not.toHaveBeenCalled();
      // Should have spawned a new one-shot PTY
      const pty = await import('node-pty');
      expect(pty.spawn).toHaveBeenCalled();
      // Agent should be running and PTY registered
      expect(agent.status).toBe('running');
      expect(agent.ptyId).toBe('test-uuid');
      expect(ptyProcesses.has('test-uuid')).toBe(true);
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });

    it('BUG 4: calls killStalePty before reusing existing PTY', async () => {
      const mockPty = { write: vi.fn() };
      ptyProcesses.set('pty-1', mockPty as any);
      const agent = makeAgent({
        id: 'a1',
        status: 'running',
        ptyId: 'pty-1',
        projectPath: '/test/project',
        worktreePath: '/test/project/.worktrees/feat/backend',
        ptyCwd: '/test/project/.worktrees/feat/backend',
      });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'message');

      await handler(makeReq({ params: { id: 'a1' }, body: { message: 'hi' } }), vi.fn(), ctx);

      // killStalePty must be called on every /message so stale cwd is caught
      expect(killStalePty).toHaveBeenCalledWith(agent);
    });

    it('BUG 4: reconnect path records worktreePath as ptyCwd', async () => {
      const agent = makeAgent({
        id: 'a1',
        status: 'waiting',
        projectPath: '/test/project',
        worktreePath: '/test/project/.worktrees/feat/backend',
      });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'message');

      await handler(makeReq({ params: { id: 'a1' }, body: { message: 'go' } }), vi.fn(), ctx);

      // ptyCwd must match the worktree path — this is the cwd bash/claude
      // actually inherits from pty.spawn. Without it, killStalePty can't
      // detect a later worktree change.
      expect(agent.ptyCwd).toBe('/test/project/.worktrees/feat/backend');

      // pty.spawn must receive the raw path (not the shell-escaped version)
      // so it works for paths that legitimately contain a single quote.
      const pty = await import('node-pty');
      expect(pty.spawn).toHaveBeenCalled();
      const spawnOpts = (pty.spawn as any).mock.calls.at(-1)[2];
      expect(spawnOpts.cwd).toBe('/test/project/.worktrees/feat/backend');
    });
  });

  describe('BUG 4 cwd invariants', () => {
    it('POST /start uses worktreePath as raw spawn cwd and records ptyCwd', async () => {
      const agent = makeAgent({
        id: 'a1',
        status: 'idle',
        projectPath: '/test/project',
        worktreePath: '/test/project/.worktrees/feat/backend',
      });
      agents.set('a1', agent);

      const app = makeRouteApp();
      registerAgentRoutes(app, ctx);
      const handler = findHandler(app, 'POST', 'start');

      await handler(makeReq({ params: { id: 'a1' }, body: { prompt: 'work' } }), vi.fn(), ctx);

      // ptyCwd must match the logical worktree path so killStalePty has
      // ground truth to compare against when worktreePath later changes.
      expect(agent.ptyCwd).toBe('/test/project/.worktrees/feat/backend');

      // pty.spawn must receive the raw (non-shell-escaped) worktree path.
      // Passing the escaped form would break paths containing single quotes.
      const pty = await import('node-pty');
      const spawnOpts = (pty.spawn as any).mock.calls.at(-1)[2];
      expect(spawnOpts.cwd).toBe('/test/project/.worktrees/feat/backend');
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
