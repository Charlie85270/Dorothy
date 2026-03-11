import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import TelegramBot from 'node-telegram-bot-api';
import { App as SlackApp } from '@slack/bolt';
import { AgentStatus, AppSettings } from '../types';
import { API_PORT, API_TOKEN_FILE } from '../constants';
import { RouteApp, RouteContext, RouteRequest } from './api-routes';
import { registerAllRoutes } from './api-routes';

// EventEmitter for agent status changes — used by long-poll wait endpoint
export const agentStatusEmitter = new EventEmitter();
agentStatusEmitter.setMaxListeners(50);

let apiServer: http.Server | null = null;
let apiToken: string | null = null;

function initApiToken(): string {
  try {
    if (fs.existsSync(API_TOKEN_FILE)) {
      const existing = fs.readFileSync(API_TOKEN_FILE, 'utf-8').trim();
      if (existing.length >= 32) {
        apiToken = existing;
        return existing;
      }
    }
  } catch { /* regenerate */ }

  const token = crypto.randomBytes(32).toString('hex');
  const dir = path.dirname(API_TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(API_TOKEN_FILE, token, { mode: 0o600 });
  apiToken = token;
  return token;
}

export function getApiToken(): string {
  if (!apiToken) {
    return initApiToken();
  }
  return apiToken;
}

function createRouteApp(): RouteApp {
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

function matchRoute(pattern: string | RegExp, pathname: string): Record<string, string> | null {
  if (typeof pattern === 'string') {
    return pathname === pattern ? {} : null;
  }
  const m = pathname.match(pattern);
  if (!m) return null;
  // Map positional captures to 'id' (first group) — all parameterized routes use a single :id param
  return m[1] ? { id: m[1] } : {};
}

export function startApiServer(
  mainWindow: BrowserWindow | null,
  appSettings: AppSettings,
  getTelegramBot: () => TelegramBot | null,
  getSlackApp: () => SlackApp | null,
  slackResponseChannel: string | null,
  slackResponseThreadTs: string | null,
  handleStatusChangeNotificationCallback: (agent: AgentStatus, newStatus: string) => void,
  sendNotificationCallback: (title: string, body: string, agentId?: string) => void,
  initAgentPtyCallback: (agent: AgentStatus) => Promise<string>,
  getAppSettings?: () => AppSettings
) {
  if (apiServer) return;

  initApiToken();

  const routeApp = createRouteApp();
  const ctx: RouteContext = {
    mainWindow,
    appSettings,
    getAppSettings: getAppSettings || (() => appSettings),
    getTelegramBot,
    getSlackApp,
    slackResponseChannel,
    slackResponseThreadTs,
    handleStatusChangeNotificationCallback,
    sendNotificationCallback,
    initAgentPtyCallback,
    agentStatusEmitter,
  };
  registerAllRoutes(routeApp, ctx);

  apiServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${API_PORT}`);
    const pathname = url.pathname;

    // Auth check: exempt local-only endpoints called from hooks/shell scripts
    const authExempt = pathname === '/api/local-file'
      || pathname === '/api/health'
      || pathname.startsWith('/api/hooks/')
      || pathname === '/api/kanban/complete'
      || pathname === '/api/scheduler/status';

    if (!authExempt) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // Parse body for POST and PUT requests
    let body: Record<string, unknown> = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const data = Buffer.concat(chunks).toString();
        if (data) {
          body = JSON.parse(data);
        }
      } catch {
        // Ignore parse errors
      }
    }

    const sendJson = (data: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // Dispatch to first matching route
      for (const route of routeApp.routes) {
        if (route.method !== req.method) continue;
        const params = matchRoute(route.pattern, pathname);
        if (params === null) continue;

        const routeReq: RouteRequest = {
          method: req.method!,
          pathname,
          url,
          body,
          raw: req,
          res,
          params,
        };
        await route.handler(routeReq, sendJson, ctx);
        return;
      }

      sendJson({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API error:', error);
      sendJson({ error: 'Internal server error' }, 500);
    }
  });

  apiServer.listen(API_PORT, '127.0.0.1', () => {
    console.log(`Agent API server running on http://127.0.0.1:${API_PORT}`);
  });

  apiServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${API_PORT} is in use, API server not started`);
    } else {
      console.error('API server error:', err);
    }
  });
}

export function stopApiServer() {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
}
