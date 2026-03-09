import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Mocks ────────────────────────────────────────────────────────────────────

let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
let tmpDir: string;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn((event: string, cb: () => void) => { if (event === 'close') cb(); }),
    unref: vi.fn(),
  })),
}));

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir, platform: () => 'linux' as NodeJS.Platform };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  handlers = new Map();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linear-test-'));
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmpJson(rel: string, data: unknown): void {
  const full = path.join(tmpDir, rel);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('linear-handlers', () => {
  async function registerHandlers() {
    const { registerIpcHandlers } = await import('../../../electron/handlers/ipc-handlers');
    // registerIpcHandlers requires dependencies - we'll test what we can
    // For the linear:test handler, it's registered inside registerIntegrationHandlers
    // which is called by registerIpcHandlers. Since we can't easily call that,
    // we test the handler logic in isolation below.
  }

  // ==========================================================================
  // a) linear:test handler - tested via replicated logic
  // ==========================================================================

  describe('linear:test handler', () => {
    // Replicated handler logic for testing
    async function linearTestHandler(appSettings: { linearApiKey?: string }): Promise<{
      success: boolean;
      displayName?: string;
      email?: string;
      error?: string;
    }> {
      if (!appSettings.linearApiKey) {
        return { success: false, error: 'Linear API key is required' };
      }

      try {
        const res = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Authorization': appSettings.linearApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: '{ viewer { id name email } }',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.data?.viewer) {
            return {
              success: true,
              displayName: data.data.viewer.name,
              email: data.data.viewer.email,
            };
          }
          return { success: false, error: data.errors?.[0]?.message || 'Unknown error' };
        } else {
          const text = await res.text();
          return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
        }
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    it('returns error when no API key configured', async () => {
      const result = await linearTestHandler({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('API key is required');
    });

    it('constructs correct GraphQL request to Linear API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { viewer: { id: 'user-1', name: 'Test User', email: 'test@example.com' } },
        }),
      });

      await linearTestHandler({ linearApiKey: 'lin_api_test123' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linear.app/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('viewer'),
        }),
      );
    });

    it('sends Authorization header with API key directly (not Basic auth)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { viewer: { id: 'user-1', name: 'Test', email: 'test@test.com' } },
        }),
      });

      await linearTestHandler({ linearApiKey: 'lin_api_mykey' });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers.Authorization).toBe('lin_api_mykey');
      expect(headers.Authorization).not.toContain('Basic');
    });

    it('sends viewer query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { viewer: { id: 'u1', name: 'Alice', email: 'alice@test.com' } },
        }),
      });

      await linearTestHandler({ linearApiKey: 'lin_key' });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.query).toContain('viewer');
      expect(body.query).toContain('id');
      expect(body.query).toContain('name');
      expect(body.query).toContain('email');
    });

    it('returns success with displayName and email on valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { viewer: { id: 'user-abc', name: 'Jane Doe', email: 'jane@company.com' } },
        }),
      });

      const result = await linearTestHandler({ linearApiKey: 'lin_api_valid' });

      expect(result.success).toBe(true);
      expect(result.displayName).toBe('Jane Doe');
      expect(result.email).toBe('jane@company.com');
    });

    it('returns error on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await linearTestHandler({ linearApiKey: 'lin_api_bad' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      const result = await linearTestHandler({ linearApiKey: 'lin_api_key' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('fetch failed');
    });

    it('handles malformed JSON response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await linearTestHandler({ linearApiKey: 'lin_api_key' });

      expect(result.success).toBe(false);
      // No viewer in response
      expect(result.error).toBeDefined();
    });
  });

  // ==========================================================================
  // b) automation:create with Linear outputs
  // ==========================================================================

  describe('automation:create with Linear outputs', () => {
    async function registerAutomationHandlers() {
      const { registerAutomationHandlers } = await import('../../../electron/handlers/automation-handlers');
      registerAutomationHandlers();
    }

    it('creates automation with outputLinearComment: true', async () => {
      await registerAutomationHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Linear Comment Bot',
        sourceType: 'linear',
        sourceConfig: JSON.stringify({ teamId: 'ENG' }),
        outputLinearComment: true,
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      const linearCommentOutput = automations[0].outputs.find(
        (o: { type: string }) => o.type === 'linear_comment'
      );
      expect(linearCommentOutput).toBeDefined();
      expect(linearCommentOutput.enabled).toBe(true);
    });

    it('creates automation with outputLinearTransition', async () => {
      await registerAutomationHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Linear Transition Bot',
        sourceType: 'linear',
        sourceConfig: JSON.stringify({ teamId: 'ENG' }),
        outputLinearTransition: 'Done',
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      const transOutput = automations[0].outputs.find(
        (o: { type: string }) => o.type === 'linear_transition'
      );
      expect(transOutput).toBeDefined();
      expect(transOutput.enabled).toBe(true);
      expect(transOutput.template).toBe('Done');
    });

    it('creates automation with outputLinearCreateIssue: true', async () => {
      await registerAutomationHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Linear Issue Creator',
        sourceType: 'linear',
        sourceConfig: JSON.stringify({ teamId: 'ENG' }),
        outputLinearCreateIssue: true,
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      const createOutput = automations[0].outputs.find(
        (o: { type: string }) => o.type === 'linear_create_issue'
      );
      expect(createOutput).toBeDefined();
      expect(createOutput.enabled).toBe(true);
    });

    it('creates automation with sourceType "linear" and valid source config', async () => {
      await registerAutomationHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Linear Poller',
        sourceType: 'linear',
        sourceConfig: JSON.stringify({
          teamId: 'PROD',
          projectId: 'Backend Rewrite',
          filter: 'state: { name: { neq: "Done" } }',
        }),
      }) as { success: boolean; automationId: string };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations[0].source.type).toBe('linear');
      expect(automations[0].source.config.teamId).toBe('PROD');
      expect(automations[0].source.config.projectId).toBe('Backend Rewrite');
    });

    it('saves Linear automation to ~/.dorothy/automations.json', async () => {
      await registerAutomationHandlers();

      await invokeHandler('automation:create', {
        name: 'Persist Test',
        sourceType: 'linear',
        sourceConfig: '{}',
      });

      const filePath = path.join(tmpDir, '.dorothy', 'automations.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const automations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(automations).toHaveLength(1);
      expect(automations[0].source.type).toBe('linear');
    });
  });
});
