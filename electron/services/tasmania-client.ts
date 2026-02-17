import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const TASMANIA_API_BASE = 'http://localhost:3999';
const TOKEN_PATH = path.join(os.homedir(), 'Library', 'Application Support', 'Tasmania', '.control-api-token');

/** Read the Tasmania Control API auth token */
export function getAuthToken(): string | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
    }
  } catch {
    // Token file not readable
  }
  return null;
}

/** Make an authenticated request to the Tasmania Control API */
export async function tasmaniaFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${TASMANIA_API_BASE}${endpoint}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(5000),
  });
}

export interface TasmaniaStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  backend: string | null;
  port: number | null;
  modelName: string | null;
  modelPath: string | null;
  endpoint: string | null;
  startedAt: number | null;
  error?: string;
}

/** Get Tasmania server status from Control API */
export async function getTasmaniaStatus(): Promise<TasmaniaStatus> {
  try {
    const res = await tasmaniaFetch('/api/status');
    if (!res.ok) {
      return { status: 'stopped', backend: null, port: null, modelName: null, modelPath: null, endpoint: null, startedAt: null, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      status: data.status || 'stopped',
      backend: data.backend || null,
      port: data.port || null,
      modelName: data.modelName || null,
      modelPath: data.modelPath || null,
      endpoint: data.endpoint || null,
      startedAt: data.startedAt || null,
    };
  } catch {
    return { status: 'stopped', backend: null, port: null, modelName: null, modelPath: null, endpoint: null, startedAt: null };
  }
}
