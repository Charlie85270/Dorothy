import { ipcMain } from 'electron';
import {
  listProjectMemories,
  readMemoryFileContent,
  writeMemoryFileContent,
  createMemoryFile,
  deleteMemoryFile,
} from '../services/memory-service';

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:list-projects', async () => {
    try {
      const projects = listProjectMemories();
      return { projects, error: null };
    } catch (err) {
      return { projects: [], error: err instanceof Error ? err.message : 'Failed to list memory projects' };
    }
  });

  ipcMain.handle('memory:read-file', async (_event, filePath: string) => {
    return readMemoryFileContent(filePath);
  });

  ipcMain.handle('memory:write-file', async (_event, filePath: string, content: string) => {
    return writeMemoryFileContent(filePath, content);
  });

  ipcMain.handle('memory:create-file', async (_event, memoryDir: string, fileName: string, content: string) => {
    return createMemoryFile(memoryDir, fileName, content);
  });

  ipcMain.handle('memory:delete-file', async (_event, filePath: string) => {
    return deleteMemoryFile(filePath);
  });
}
