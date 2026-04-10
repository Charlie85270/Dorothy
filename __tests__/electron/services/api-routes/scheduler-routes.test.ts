import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { registerSchedulerRoutes } from '../../../../electron/services/api-routes/scheduler-routes';
import { RouteApp, RouteContext, RouteRequest } from '../../../../electron/services/api-routes/types';
import { AppSettings } from '../../../../electron/types';

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

let ctx: RouteContext;
let tmpDir: string;

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir };
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-test-'));
  fs.mkdirSync(path.join(tmpDir, '.echelon'), { recursive: true });

  ctx = {
    mainWindow: { isDestroyed: () => false, webContents: { send: vi.fn() } } as any,
    appSettings: {} as AppSettings,
    getTelegramBot: () => null,
    getSlackApp: () => null,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(),
    agentStatusEmitter: {} as any,
  };
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scheduler-routes', () => {
  it('writes scheduler metadata', async () => {
    const app = makeRouteApp();
    registerSchedulerRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler(
      { body: { task_id: 'task-1', status: 'success', summary: 'all good' }, params: {} } as RouteRequest,
      sendJson,
      ctx
    );

    expect(sendJson).toHaveBeenCalledWith({ success: true });

    const metadataPath = path.join(tmpDir, '.echelon', 'scheduler-metadata.json');
    expect(fs.existsSync(metadataPath)).toBe(true);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    expect(metadata['task-1'].lastRunStatus).toBe('success');
    expect(metadata['task-1'].lastRunSummary).toBe('all good');
  });

  it('returns 400 when task_id or status missing', async () => {
    const app = makeRouteApp();
    registerSchedulerRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler(
      { body: { task_id: 'task-1' }, params: {} } as RouteRequest,
      sendJson,
      ctx
    );
    expect(sendJson).toHaveBeenCalledWith({ error: 'task_id and status are required' }, 400);
  });

  it('returns 400 for invalid status', async () => {
    const app = makeRouteApp();
    registerSchedulerRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler(
      { body: { task_id: 'task-1', status: 'invalid' }, params: {} } as RouteRequest,
      sendJson,
      ctx
    );
    expect(sendJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid status') }), 400);
  });

  it('emits event to frontend', async () => {
    const app = makeRouteApp();
    registerSchedulerRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler(
      { body: { task_id: 'task-2', status: 'running' }, params: {} } as RouteRequest,
      sendJson,
      ctx
    );

    expect(ctx.mainWindow!.webContents.send).toHaveBeenCalledWith('scheduler:task-status', {
      taskId: 'task-2',
      status: 'running',
      summary: undefined,
    });
  });
});
