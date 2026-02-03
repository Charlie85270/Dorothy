"use strict";
/**
 * Memory Service for Agent Memory System
 *
 * Provides persistent memory storage using SQLite for agents to recall
 * past sessions, decisions, and learnings across restarts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initMemoryDb = initMemoryDb;
exports.closeMemoryDb = closeMemoryDb;
exports.startSession = startSession;
exports.endSession = endSession;
exports.getSession = getSession;
exports.getAgentSessions = getAgentSessions;
exports.getProjectSessions = getProjectSessions;
exports.storeObservation = storeObservation;
exports.getObservations = getObservations;
exports.getSessionObservations = getSessionObservations;
exports.getTimeline = getTimeline;
exports.searchMemory = searchMemory;
exports.getRecentObservations = getRecentObservations;
exports.storeSummary = storeSummary;
exports.getSummaries = getSummaries;
exports.remember = remember;
exports.getMemoryStats = getMemoryStats;
exports.getMemoryContext = getMemoryContext;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
// ============== Memory Service ==============
const DATA_DIR = path.join(os.homedir(), '.claude-manager');
const DB_FILE = path.join(DATA_DIR, 'memory.db');
let db = null;
/**
 * Initialize the SQLite database and create tables if needed
 */
function initMemoryDb() {
    if (db)
        return db;
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new better_sqlite3_1.default(DB_FILE);
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
function closeMemoryDb() {
    if (db) {
        db.close();
        db = null;
        console.log('Memory database closed');
    }
}
/**
 * Get the database instance (initializes if needed)
 */
function getDb() {
    if (!db) {
        return initMemoryDb();
    }
    return db;
}
// ============== Session Management ==============
/**
 * Start a new session for an agent
 */
function startSession(agentId, projectPath, task) {
    const session = {
        id: (0, uuid_1.v4)(),
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
    stmt.run(session.id, session.agent_id, session.project_path, session.started_at, session.ended_at, session.summary, session.task);
    console.log(`Started session ${session.id} for agent ${agentId}`);
    return session;
}
/**
 * End a session
 */
function endSession(sessionId, summary) {
    const stmt = getDb().prepare(`
    UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?
  `);
    stmt.run(Date.now(), summary || null, sessionId);
    console.log(`Ended session ${sessionId}`);
}
/**
 * Get session by ID
 */
function getSession(sessionId) {
    const stmt = getDb().prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(sessionId);
}
/**
 * Get recent sessions for an agent
 */
function getAgentSessions(agentId, limit = 10) {
    const stmt = getDb().prepare(`
    SELECT * FROM sessions
    WHERE agent_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
    return stmt.all(agentId, limit);
}
/**
 * Get recent sessions for a project
 */
function getProjectSessions(projectPath, limit = 10) {
    const stmt = getDb().prepare(`
    SELECT * FROM sessions
    WHERE project_path = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
    return stmt.all(projectPath, limit);
}
// ============== Observation Management ==============
/**
 * Store an observation
 */
function storeObservation(sessionId, agentId, projectPath, type, content, metadata) {
    const observation = {
        id: (0, uuid_1.v4)(),
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
    stmt.run(observation.id, observation.session_id, observation.agent_id, observation.project_path, observation.type, observation.content, metadata ? JSON.stringify(metadata) : null, observation.created_at);
    return observation;
}
/**
 * Get observations by IDs
 */
function getObservations(ids) {
    if (ids.length === 0)
        return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = getDb().prepare(`
    SELECT * FROM observations WHERE id IN (${placeholders})
  `);
    const results = stmt.all(...ids);
    return results.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
}
/**
 * Get observations for a session
 */
function getSessionObservations(sessionId) {
    const stmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);
    const results = stmt.all(sessionId);
    return results.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
}
/**
 * Get timeline around an observation
 */
function getTimeline(observationId, before = 5, after = 5) {
    const targetObs = getObservations([observationId])[0];
    if (!targetObs)
        return [];
    // Get observations before
    const beforeStmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ? AND created_at < ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
    const beforeResults = beforeStmt.all(targetObs.session_id, targetObs.created_at, before);
    // Get observations after
    const afterStmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE session_id = ? AND created_at > ?
    ORDER BY created_at ASC
    LIMIT ?
  `);
    const afterResults = afterStmt.all(targetObs.session_id, targetObs.created_at, after);
    // Combine and format
    const timeline = [
        ...beforeResults.reverse().map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            position: 'before',
        })),
        { ...targetObs, position: 'target' },
        ...afterResults.map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            position: 'after',
        })),
    ];
    return timeline;
}
// ============== Search ==============
/**
 * Search observations by text content
 */
function searchMemory(query, options = {}) {
    const { agentId, projectPath, type, limit = 20 } = options;
    // Build query with optional filters
    let sql = `
    SELECT id, type, content, agent_id, project_path, created_at
    FROM observations
    WHERE content LIKE ?
  `;
    const params = [`%${query}%`];
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
    return stmt.all(...params);
}
/**
 * Get recent observations for context injection
 */
function getRecentObservations(agentId, projectPath, limit = 50) {
    const stmt = getDb().prepare(`
    SELECT * FROM observations
    WHERE agent_id = ? AND project_path = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
    const results = stmt.all(agentId, projectPath, limit);
    return results.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
}
// ============== Summaries ==============
/**
 * Store a summary
 */
function storeSummary(agentId, projectPath, content, observationCount) {
    const summary = {
        id: (0, uuid_1.v4)(),
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
    stmt.run(summary.id, summary.agent_id, summary.project_path, summary.content, summary.observation_count, summary.created_at);
    return summary;
}
/**
 * Get recent summaries for an agent and project
 */
function getSummaries(agentId, projectPath, limit = 5) {
    let sql = 'SELECT * FROM summaries WHERE agent_id = ?';
    const params = [agentId];
    if (projectPath) {
        sql += ' AND project_path = ?';
        params.push(projectPath);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
}
// ============== Remember (explicit memories) ==============
/**
 * Store an explicit memory/learning
 */
function remember(agentId, projectPath, content, type, sessionId) {
    // If no session provided, create a virtual one
    const effectiveSessionId = sessionId || `hook-${agentId}-${Date.now()}`;
    // Mark explicit memories (learning, decision, preference, context) with metadata
    const isExplicit = ['learning', 'decision', 'preference', 'context'].includes(type);
    return storeObservation(effectiveSessionId, agentId, projectPath, type, content, isExplicit ? { explicit: true } : undefined);
}
// ============== Stats ==============
/**
 * Get memory stats
 */
function getMemoryStats() {
    const sessionsStmt = getDb().prepare('SELECT COUNT(*) as count FROM sessions');
    const observationsStmt = getDb().prepare('SELECT COUNT(*) as count FROM observations');
    const summariesStmt = getDb().prepare('SELECT COUNT(*) as count FROM summaries');
    const stats = {
        totalSessions: sessionsStmt.get().count,
        totalObservations: observationsStmt.get().count,
        totalSummaries: summariesStmt.get().count,
        dbSizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
    };
    return stats;
}
// ============== Memory Context Generation ==============
/**
 * Generate memory context for injection when agent starts
 */
function getMemoryContext(agentId, projectPath, task) {
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
            relevantObs = recentObs.filter(obs => obs.type === 'decision' || obs.type === 'learning').slice(0, 5);
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
//# sourceMappingURL=memory.js.map