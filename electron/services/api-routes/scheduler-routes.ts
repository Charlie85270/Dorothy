import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { RouteApp, RouteContext } from './types';

export function registerSchedulerRoutes(app: RouteApp, ctx: RouteContext): void {
  // POST /api/scheduler/status
  app.post('/api/scheduler/status', (req, sendJson) => {
    const { task_id, status, summary } = req.body as {
      task_id: string;
      status: 'running' | 'success' | 'error' | 'partial';
      summary?: string;
    };

    if (!task_id || !status) {
      sendJson({ error: 'task_id and status are required' }, 400);
      return;
    }

    const validStatuses = ['running', 'success', 'error', 'partial'];
    if (!validStatuses.includes(status)) {
      sendJson({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
      return;
    }

    try {
      const metadataPath = path.join(os.homedir(), '.echelon', 'scheduler-metadata.json');
      let metadata: Record<string, Record<string, unknown>> = {};
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      }

      if (!metadata[task_id]) {
        metadata[task_id] = {};
      }
      metadata[task_id].lastRunStatus = status;
      metadata[task_id].lastRun = new Date().toISOString();
      if (summary) {
        metadata[task_id].lastRunSummary = summary;
      }

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('scheduler:task-status', { taskId: task_id, status, summary });
      }

      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: `Failed to update status: ${err}` }, 500);
    }
  });
}
