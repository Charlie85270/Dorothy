import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
}));

const mockMemoryService = {
  listProjectMemories: vi.fn(() => [{ name: 'project-1', path: '/mock/path' }]),
  readMemoryFileContent: vi.fn((_path: string) => ({ content: 'file content', error: null })),
  writeMemoryFileContent: vi.fn((_path: string, _content: string) => ({ success: true, error: null })),
  createMemoryFile: vi.fn((_dir: string, _name: string, _content: string) => ({ success: true, path: '/mock/new', error: null })),
  deleteMemoryFile: vi.fn((_path: string) => ({ success: true, error: null })),
};

vi.mock('../../../electron/services/memory-service', () => mockMemoryService);

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  handlers = new Map();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('memory-handlers', () => {
  async function registerHandlers() {
    const { registerMemoryHandlers } = await import('../../../electron/handlers/memory-handlers');
    registerMemoryHandlers();
  }

  it('registers all 5 handlers', async () => {
    await registerHandlers();
    expect(handlers.has('memory:list-projects')).toBe(true);
    expect(handlers.has('memory:read-file')).toBe(true);
    expect(handlers.has('memory:write-file')).toBe(true);
    expect(handlers.has('memory:create-file')).toBe(true);
    expect(handlers.has('memory:delete-file')).toBe(true);
  });

  describe('memory:list-projects', () => {
    it('returns projects from memory service', async () => {
      await registerHandlers();
      const result = await invokeHandler('memory:list-projects') as { projects: unknown[] };
      expect(result.projects).toHaveLength(1);
      expect(mockMemoryService.listProjectMemories).toHaveBeenCalled();
    });

    it('returns error on service failure', async () => {
      mockMemoryService.listProjectMemories.mockImplementationOnce(() => { throw new Error('Service down'); });
      await registerHandlers();
      const result = await invokeHandler('memory:list-projects') as { projects: unknown[]; error: string };
      expect(result.projects).toEqual([]);
      expect(result.error).toBe('Service down');
    });
  });

  describe('memory:read-file', () => {
    it('delegates to readMemoryFileContent', async () => {
      await registerHandlers();
      const result = await invokeHandler('memory:read-file', '/some/path');
      expect(mockMemoryService.readMemoryFileContent).toHaveBeenCalledWith('/some/path');
      expect(result).toEqual({ content: 'file content', error: null });
    });
  });

  describe('memory:write-file', () => {
    it('delegates to writeMemoryFileContent', async () => {
      await registerHandlers();
      const result = await invokeHandler('memory:write-file', '/some/path', 'new content');
      expect(mockMemoryService.writeMemoryFileContent).toHaveBeenCalledWith('/some/path', 'new content');
      expect(result).toEqual({ success: true, error: null });
    });
  });

  describe('memory:create-file', () => {
    it('delegates to createMemoryFile', async () => {
      await registerHandlers();
      const result = await invokeHandler('memory:create-file', '/dir', 'notes.md', 'content');
      expect(mockMemoryService.createMemoryFile).toHaveBeenCalledWith('/dir', 'notes.md', 'content');
      expect(result).toEqual({ success: true, path: '/mock/new', error: null });
    });
  });

  describe('memory:delete-file', () => {
    it('delegates to deleteMemoryFile', async () => {
      await registerHandlers();
      const result = await invokeHandler('memory:delete-file', '/file/to/delete');
      expect(mockMemoryService.deleteMemoryFile).toHaveBeenCalledWith('/file/to/delete');
      expect(result).toEqual({ success: true, error: null });
    });
  });
});
