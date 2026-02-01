/**
 * Memory Service for Agent Memory System
 *
 * Provides persistent memory storage using SQLite for agents to recall
 * past sessions, decisions, and learnings across restarts.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ============== Types ==============

export interface Session {
  id: string;
  agent_id: string;
  project_path: string;
  started_at: number;
  ended_at: number | null;
  summary: string | null;
  task: string | null;
}

export interface Observation {
  id: string;
  session_id: string;
  agent_id: string;
  project_path: string;
  type: 'tool_use' | 'message' | 'file_edit' | 'command' | 'decision' | 'learning' | 'preference' | 'context';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: number;
}

export interface Summary {
  id: string;
  agent_id: string;
  project_path: string;
  content: string;
  observation_count: number;
  created_at: number;
}

export interface SearchResult {
  id: string;
  type: string;
  content: string;
  agent_id: string;
  project_path: string;
  created_at: number;
  relevance?: number;
}

export interface TimelineEntry extends Observation {
  position: 'before' | 'target' | 'after';
}

// ============== Memory Service ==============

const DATA_DIR = path.join(os.homedir(), '.claude-manager');
const DB_FILE = path.join(DATA_DIR, 'memory.db');

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database and create tables if needed
 */
export function initMemoryDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_FILE);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Sessions track agent work periods
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      project_path TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      summary TEXT,
      task TEXT
    );

    -- Observations are individual events
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      project_path TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- Summaries are AI-compressed context
    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      project_path TEXT NOT NULL,
      content TEXT NOT NULL,
      observation_count INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_obs_agent ON observations(agent_id);
    CREATE INDEX IF NOT EXISTS idx_obs_project ON observations(project_path);
    CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type);
    CREATE INDEX IF NOT EXISTS idx_obs_created ON observations(created_at);
    CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_summaries_agent ON summaries(agent_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_project ON summaries(project_path);
  `);

  console.log('Memory database initialized at:', DB_FILE);
  return db;
}

/**
 * Close the database connection
 */
export function closeMemoryDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Memory database closed');
  }
}

/**
 * Get the database instance (initializes if needed)
 */
function getDb(): Database.Database {
  if (!db) {
    return initMemoryDb();
  }
  return db;
}

// ============== Session Management ==============

/**
 * Start a new session for an agent
 */
export function startSession(agentId: string, projectPath: string, task?: string): Session {
  const session: Session = {
    id: uuidv4(),
    agent_id: agentId,
    project_path: projectPath,
    started_at: Date.now(),
    ended_at: null,
    summary: null,
    task: task || null,
  };

  const stmt = getDb().prepare(`
    INSERT INTO sessions (id, agent_id, project_path, started_at, ended_at, summary, task)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    session.id,
    session.agent_id,
    session.project_path,
    session.started_at,
    session.ended_at,
    session.summary,
    session.task
  );

  console.log(`Started session ${session.id} for agent ${agentId}`);
  return session;
}

/**
 * End a session
 */
export function endSession(sessionId: string, summary?: string): void {
  const stmt = getDb().prepare(`
    UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?
  `);
  stmt.run(Date.now(), summary || null, sessionId);
  console.log(`Ended session ${sessionId}`);
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): Session | null {
  const stmt = getDb().prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(sessionId) as Session | null;
}

/**
 * Get recent sessions for an agent
 */
export function getAgentSessions(agentId: string, limit = 10): Session[] {
  const stmt = getDb().prepare(`
    SELECT * FROM sessions
    WHERE agent_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
  return stmt.all(agentId, limit) as Session[];
}

/**
 * Get recent sessions for a project
 */
export function getProjectSessions(projectPath: string, limit = 10): Session[] {
  const stmt = getDb().prepare(`
    SELECT * FROM sessions
    WHERE project_path = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
  return stmt.all(projectPath, limit) as Session[];
}

// ============== Observation Management ==============

/**
 * Store an observation
 */
export function storeObservation(
  sessionId: string,
  agentId: string,
  projectPath: string,
  type: Observation['type'],
  content: string,
  metadata?: Record<string, unknown>
): Observation {
  const observation: Observation = {
    id: uuidv4(),
    session_id: sessionId,
    agent_id: agentId,
    project_path: projectPath,
    type,
    content,
    metadata: metadata || null,
    created_at: Date.now(),
  };

  const stmt = getDb().prepare(`
    INSERT INTO observations (id, session_id, agent_id, project_path, type, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    observation.id,
    observation.session_id,
    observation.agent_id,
    observation.project_path,
    observation.type,
    observation.content,
    metadata ? JSON.stringify(metadata) : null,
    observation.created_at
  );

  return observation;
}

/**
 * Get observations by IDs
 */
export function getObservations(ids: string[]): Observation[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const stmt = getDb().prepare(`
    SELECT * FROM observations WHERE id IN (${placeholders})
  `);

  const results = stmt.all(...ids) as Array<Omit<Observation, 'metadata'> & { metadata: string | null }>;
  return results.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

/**
 * Get observations for a session
 */
export function getSessionObservations(sessionId: string): Observation[] {
  const stmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);

  const results = stmt.all(sessionId) as Array<Omit<Observation, 'metadata'> & { metadata: string | null }>;
  return results.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

/**
 * Get timeline around an observation
 */
export function getTimeline(observationId: string, before = 5, after = 5): TimelineEntry[] {
  const targetObs = getObservations([observationId])[0];
  if (!targetObs) return [];

  // Get observations before
  const beforeStmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ? AND created_at < ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  const beforeResults = beforeStmt.all(targetObs.session_id, targetObs.created_at, before) as Array<Omit<Observation, 'metadata'> & { metadata: string | null }>;

  // Get observations after
  const afterStmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ? AND created_at > ?
    ORDER BY created_at ASC
    LIMIT ?
  `);
  const afterResults = afterStmt.all(targetObs.session_id, targetObs.created_at, after) as Array<Omit<Observation, 'metadata'> & { metadata: string | null }>;

  // Combine and format
  const timeline: TimelineEntry[] = [
    ...beforeResults.reverse().map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      position: 'before' as const,
    })),
    { ...targetObs, position: 'target' as const },
    ...afterResults.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      position: 'after' as const,
    })),
  ];

  return timeline;
}

// ============== Search ==============

/**
 * Search observations by text content
 */
export function searchMemory(
  query: string,
  options: {
    agentId?: string;
    projectPath?: string;
    type?: Observation['type'];
    limit?: number;
  } = {}
): SearchResult[] {
  const { agentId, projectPath, type, limit = 20 } = options;

  // Build query with optional filters
  let sql = `
    SELECT id, type, content, agent_id, project_path, created_at
    FROM observations
    WHERE content LIKE ?
  `;
  const params: (string | number)[] = [`%${query}%`];

  if (agentId) {
    sql += ' AND agent_id = ?';
    params.push(agentId);
  }

  if (projectPath) {
    sql += ' AND project_path = ?';
    params.push(projectPath);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = getDb().prepare(sql);
  return stmt.all(...params) as SearchResult[];
}

/**
 * Get recent observations for context injection
 */
export function getRecentObservations(
  agentId: string,
  projectPath: string,
  limit = 50
): Observation[] {
  const stmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE agent_id = ? AND project_path = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const results = stmt.all(agentId, projectPath, limit) as Array<Omit<Observation, 'metadata'> & { metadata: string | null }>;
  return results.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

// ============== Summaries ==============

/**
 * Store a summary
 */
export function storeSummary(
  agentId: string,
  projectPath: string,
  content: string,
  observationCount: number
): Summary {
  const summary: Summary = {
    id: uuidv4(),
    agent_id: agentId,
    project_path: projectPath,
    content,
    observation_count: observationCount,
    created_at: Date.now(),
  };

  const stmt = getDb().prepare(`
    INSERT INTO summaries (id, agent_id, project_path, content, observation_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    summary.id,
    summary.agent_id,
    summary.project_path,
    summary.content,
    summary.observation_count,
    summary.created_at
  );

  return summary;
}

/**
 * Get recent summaries for an agent and project
 */
export function getSummaries(
  agentId: string,
  projectPath?: string,
  limit = 5
): Summary[] {
  let sql = 'SELECT * FROM summaries WHERE agent_id = ?';
  const params: (string | number)[] = [agentId];

  if (projectPath) {
    sql += ' AND project_path = ?';
    params.push(projectPath);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = getDb().prepare(sql);
  return stmt.all(...params) as Summary[];
}

// ============== Remember (explicit memories) ==============

/**
 * Store an explicit memory/learning
 */
export function remember(
  agentId: string,
  projectPath: string,
  content: string,
  type: Observation['type'],
  sessionId?: string
): Observation {
  // If no session provided, create a virtual one
  const effectiveSessionId = sessionId || `hook-${agentId}-${Date.now()}`;

  // Mark explicit memories (learning, decision, preference, context) with metadata
  const isExplicit = ['learning', 'decision', 'preference', 'context'].includes(type);

  return storeObservation(
    effectiveSessionId,
    agentId,
    projectPath,
    type,
    content,
    isExplicit ? { explicit: true } : undefined
  );
}

// ============== Stats ==============

/**
 * Get memory stats
 */
export function getMemoryStats(): {
  totalSessions: number;
  totalObservations: number;
  totalSummaries: number;
  dbSizeBytes: number;
} {
  const sessionsStmt = getDb().prepare('SELECT COUNT(*) as count FROM sessions');
  const observationsStmt = getDb().prepare('SELECT COUNT(*) as count FROM observations');
  const summariesStmt = getDb().prepare('SELECT COUNT(*) as count FROM summaries');

  const stats = {
    totalSessions: (sessionsStmt.get() as { count: number }).count,
    totalObservations: (observationsStmt.get() as { count: number }).count,
    totalSummaries: (summariesStmt.get() as { count: number }).count,
    dbSizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
  };

  return stats;
}

// ============== Memory Context Generation ==============

/**
 * Generate memory context for injection when agent starts
 */
export function getMemoryContext(agentId: string, projectPath: string, task?: string): string {
  const summaries = getSummaries(agentId, projectPath, 3);
  const recentObs = getRecentObservations(agentId, projectPath, 20);

  // Filter for relevant observations based on task keywords if provided
  let relevantObs = recentObs;
  if (task) {
    const taskWords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    relevantObs = recentObs.filter(obs => {
      const content = obs.content.toLowerCase();
      return taskWords.some(word => content.includes(word));
    }).slice(0, 10);

    // If no relevant matches, use most recent decisions/learnings
    if (relevantObs.length < 3) {
      relevantObs = recentObs.filter(
        obs => obs.type === 'decision' || obs.type === 'learning'
      ).slice(0, 5);
    }
  }

  if (summaries.length === 0 && relevantObs.length === 0) {
    return 'No previous context found for this agent/project.';
  }

  let context = '<memory>\n';

  if (summaries.length > 0) {
    context += '## Recent Project Context\n';
    for (const summary of summaries) {
      const date = new Date(summary.created_at).toLocaleDateString();
      context += `### ${date}\n${summary.content}\n\n`;
    }
  }

  if (relevantObs.length > 0) {
    context += '## Relevant Past Decisions\n';
    for (const obs of relevantObs) {
      const date = new Date(obs.created_at).toLocaleDateString();
      const typeLabel = obs.type.replace('_', ' ');
      context += `- [${typeLabel}] (${date}): ${obs.content.slice(0, 200)}${obs.content.length > 200 ? '...' : ''}\n`;
    }
  }

  context += '</memory>\n';
  return context;
}

// Export types
export type {
  Session as MemorySession,
  Observation as MemoryObservation,
  Summary as MemorySummary,
  SearchResult as MemorySearchResult,
  TimelineEntry as MemoryTimelineEntry,
};
