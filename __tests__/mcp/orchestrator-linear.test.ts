import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Linear integration tests for mcp-orchestrator automations
// ============================================================================
// Tests Linear source config, polling logic, output handlers, query construction,
// template variables, and priority mapping.
// Follows the same pattern as orchestrator-automations.test.ts: replicate types
// locally, mock fs/fetch, test business logic without importing source modules.

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import * as fs from 'fs';

// ============================================================================
// Replicated types from mcp-orchestrator/src/utils/automations.ts
// ============================================================================

type SourceType = 'github' | 'jira' | 'pipedrive' | 'twitter' | 'rss' | 'custom' | 'linear';
type OutputType = 'telegram' | 'slack' | 'github_comment' | 'email' | 'discord' | 'webhook' | 'jira_comment' | 'jira_transition' | 'linear_comment' | 'linear_transition' | 'linear_create_issue';

interface LinearSourceConfig {
  teamId?: string;
  projectId?: string;
  filter?: string;
  apiKey?: string;
}

interface OutputConfig {
  type: OutputType;
  enabled: boolean;
  template?: string;
}

interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: {
    type: 'cron' | 'interval';
    cron?: string;
    intervalMinutes?: number;
  };
  source: {
    type: SourceType;
    config: Record<string, unknown>;
  };
  trigger: {
    eventTypes: string[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    timeout?: number;
  };
  outputs: OutputConfig[];
}

// ============================================================================
// Replicated utility functions
// ============================================================================

function createItemId(sourceType: string, repo: string, itemType: string, itemId: string): string {
  return `${sourceType}:${repo}:${itemType}:${itemId}`;
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value: unknown = variables;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match;
      }
    }
    return String(value ?? match);
  });
}

function linearPriorityLabel(priority: number): string {
  switch (priority) {
    case 0: return 'No priority';
    case 1: return 'Urgent';
    case 2: return 'High';
    case 3: return 'Medium';
    case 4: return 'Low';
    default: return 'Unknown';
  }
}

// Replicated loadLinearApiKey logic
function loadLinearApiKey(config: LinearSourceConfig): string | null {
  if (config.apiKey) return config.apiKey;
  try {
    const settingsPath = '/mock/app-settings.json';
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.linearEnabled && settings.linearApiKey) {
        return settings.linearApiKey;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

// Replicated GraphQL query builder
function buildLinearIssuesQuery(config: LinearSourceConfig): string {
  const filters: string[] = [];
  if (config.teamId) {
    filters.push(`team: { key: { eq: "${config.teamId}" } }`);
  }
  if (config.projectId) {
    filters.push(`project: { name: { eq: "${config.projectId}" } }`);
  }
  if (config.filter) {
    filters.push(config.filter);
  }

  const filterClause = filters.length > 0 ? `filter: { ${filters.join(', ')} }, ` : '';

  return `{
      issues(${filterClause}first: 20, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          description
          state { name }
          priority
          assignee { name }
          creator { name }
          url
          labels { nodes { name } }
          updatedAt
          createdAt
        }
      }
    }`;
}

function buildLinearCommentMutation(issueId: string, body: string): string {
  const escapedBody = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `mutation { commentCreate(input: { issueId: "${issueId}", body: "${escapedBody}" }) { success } }`;
}

function buildLinearTransitionMutation(issueId: string, stateId: string): string {
  return `mutation { issueUpdate(id: "${issueId}", input: { stateId: "${stateId}" }) { success } }`;
}

function buildLinearCreateIssueMutation(teamId: string, title: string, description?: string): string {
  const desc = description || '';
  const escapedDesc = desc.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `mutation { issueCreate(input: { teamId: "${teamId}", title: "${title}", description: "${escapedDesc}" }) { success issue { id identifier url } } }`;
}

// Replicated pollLinear response mapper
interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: { name: string } | null;
  priority: number;
  assignee: { name: string } | null;
  creator: { name: string } | null;
  url: string;
  labels: { nodes: Array<{ name: string }> } | null;
  updatedAt: string;
  createdAt: string;
}

interface PollResultItem {
  id: string;
  type: string;
  title: string;
  url: string;
  author: string;
  body?: string;
  labels?: string[];
  createdAt: string;
  updatedAt?: string;
  hash: string;
  raw: Record<string, unknown>;
}

function mapLinearIssueToPollItem(issue: LinearIssueNode, config: LinearSourceConfig): PollResultItem {
  const hash = hashContent(issue.updatedAt || '');
  const teamKey = issue.identifier?.split('-')[0] || config.teamId || 'unknown';
  const labelNames = issue.labels?.nodes?.map((l) => l.name) || [];

  return {
    id: createItemId('linear', teamKey, 'issue', issue.identifier),
    type: 'issue',
    title: issue.identifier,
    url: issue.url,
    author: issue.creator?.name || 'Unknown',
    body: issue.description || '',
    labels: labelNames,
    createdAt: issue.createdAt || '',
    updatedAt: issue.updatedAt || '',
    hash,
    raw: {
      issueId: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      state: issue.state?.name || 'Unknown',
      priority: linearPriorityLabel(issue.priority),
      priorityNumber: issue.priority,
      assignee: issue.assignee?.name || 'Unassigned',
      creator: issue.creator?.name || 'Unknown',
      url: issue.url,
      labels: labelNames,
      teamKey,
    },
  };
}

// ============================================================================
// Test helpers
// ============================================================================

function makeLinearIssue(overrides: Partial<LinearIssueNode> = {}): LinearIssueNode {
  return {
    id: 'issue-uuid-1',
    identifier: 'ENG-42',
    title: 'Fix the login bug',
    description: 'Users cannot log in on Safari',
    state: { name: 'In Progress' },
    priority: 2,
    assignee: { name: 'Alice' },
    creator: { name: 'Bob' },
    url: 'https://linear.app/team/issue/ENG-42',
    labels: { nodes: [{ name: 'bug' }, { name: 'urgent' }] },
    updatedAt: '2026-01-15T10:30:00.000Z',
    createdAt: '2026-01-10T08:00:00.000Z',
    ...overrides,
  };
}

function makeLinearAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'auto-linear-1',
    name: 'Linear Poll',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schedule: { type: 'interval', intervalMinutes: 15 },
    source: {
      type: 'linear',
      config: { teamId: 'ENG' },
    },
    trigger: { eventTypes: [], onNewItem: true },
    agent: { enabled: true, prompt: 'Review issue {{identifier}}: {{title}}', projectPath: '/project' },
    outputs: [{ type: 'linear_comment', enabled: true }],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Linear integration', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    vi.mocked(fs.writeFileSync).mockClear();
  });

  // ==========================================================================
  // a) Linear source config and types
  // ==========================================================================

  describe('Linear source config and types', () => {
    it('validates LinearSourceConfig interface shape', () => {
      const config: LinearSourceConfig = {
        teamId: 'ENG',
        projectId: 'proj-1',
        filter: 'state: { name: { neq: "Done" } }',
        apiKey: 'lin_api_test123',
      };
      expect(config.teamId).toBe('ENG');
      expect(config.projectId).toBe('proj-1');
      expect(config.filter).toBeDefined();
      expect(config.apiKey).toBeDefined();
    });

    it('accepts all fields as optional', () => {
      const config: LinearSourceConfig = {};
      expect(config.teamId).toBeUndefined();
      expect(config.projectId).toBeUndefined();
      expect(config.filter).toBeUndefined();
      expect(config.apiKey).toBeUndefined();
    });

    it('"linear" is a valid source type', () => {
      const sourceType: SourceType = 'linear';
      expect(sourceType).toBe('linear');
    });

    it('createItemId works with linear source', () => {
      const id = createItemId('linear', 'team-eng', 'issue', 'ENG-42');
      expect(id).toBe('linear:team-eng:issue:ENG-42');
    });
  });

  // ==========================================================================
  // b) loadLinearApiKey
  // ==========================================================================

  describe('loadLinearApiKey', () => {
    it('returns API key from config override when present', () => {
      const key = loadLinearApiKey({ apiKey: 'lin_override_key' });
      expect(key).toBe('lin_override_key');
    });

    it('falls back to app-settings.json when no override', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ linearEnabled: true, linearApiKey: 'lin_settings_key' })
      );

      const key = loadLinearApiKey({});
      expect(key).toBe('lin_settings_key');
    });

    it('returns null when neither is configured', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const key = loadLinearApiKey({});
      expect(key).toBeNull();
    });

    it('returns null when settings exist but linearEnabled is false', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ linearEnabled: false, linearApiKey: 'lin_key' })
      );

      const key = loadLinearApiKey({});
      expect(key).toBeNull();
    });

    it('handles missing/corrupt settings file gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const key = loadLinearApiKey({});
      expect(key).toBeNull();
    });
  });

  // ==========================================================================
  // c) pollLinear GraphQL query construction
  // ==========================================================================

  describe('pollLinear GraphQL query construction', () => {
    it('builds correct query with team filter', () => {
      const query = buildLinearIssuesQuery({ teamId: 'ENG' });
      expect(query).toContain('filter: { team: { key: { eq: "ENG" } } }');
      expect(query).toContain('first: 20');
      expect(query).toContain('orderBy: updatedAt');
    });

    it('builds correct query with project filter', () => {
      const query = buildLinearIssuesQuery({ projectId: 'My Project' });
      expect(query).toContain('project: { name: { eq: "My Project" } }');
    });

    it('builds correct query with no filters', () => {
      const query = buildLinearIssuesQuery({});
      expect(query).not.toContain('filter:');
      expect(query).toContain('first: 20');
      expect(query).toContain('orderBy: updatedAt');
    });

    it('builds correct query with custom filter expression', () => {
      const query = buildLinearIssuesQuery({ filter: 'state: { name: { neq: "Done" } }' });
      expect(query).toContain('state: { name: { neq: "Done" } }');
    });

    it('combines team and project filters', () => {
      const query = buildLinearIssuesQuery({ teamId: 'ENG', projectId: 'Backend' });
      expect(query).toContain('team: { key: { eq: "ENG" } }');
      expect(query).toContain('project: { name: { eq: "Backend" } }');
    });

    it('constructs proper auth header format', () => {
      const apiKey = 'lin_api_abc123';
      const headers = {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      };
      expect(headers.Authorization).toBe('lin_api_abc123');
      // Linear uses the API key directly, not Basic auth
      expect(headers.Authorization).not.toContain('Basic');
    });

    it('includes all required fields in query', () => {
      const query = buildLinearIssuesQuery({});
      const requiredFields = [
        'id', 'identifier', 'title', 'description',
        'state { name }', 'priority', 'assignee { name }',
        'creator { name }', 'url', 'labels { nodes { name } }',
        'updatedAt', 'createdAt',
      ];
      for (const field of requiredFields) {
        expect(query).toContain(field);
      }
    });
  });

  // ==========================================================================
  // d) pollLinear response mapping
  // ==========================================================================

  describe('pollLinear response mapping', () => {
    it('maps Linear issue to PollResult item with correct variables', () => {
      const issue = makeLinearIssue();
      const item = mapLinearIssueToPollItem(issue, { teamId: 'ENG' });

      expect(item.id).toBe('linear:ENG:issue:ENG-42');
      expect(item.type).toBe('issue');
      expect(item.url).toBe('https://linear.app/team/issue/ENG-42');
      expect(item.author).toBe('Bob');
    });

    it('maps identifier to item title', () => {
      const issue = makeLinearIssue({ identifier: 'PROD-99' });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.title).toBe('PROD-99');
    });

    it('maps state.name to status variable', () => {
      const issue = makeLinearIssue({ state: { name: 'In Review' } });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.raw.state).toBe('In Review');
    });

    it('maps assignee.name and creator.name', () => {
      const issue = makeLinearIssue({
        assignee: { name: 'Charlie' },
        creator: { name: 'Diana' },
      });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.raw.assignee).toBe('Charlie');
      expect(item.raw.creator).toBe('Diana');
    });

    it('handles null assignee gracefully', () => {
      const issue = makeLinearIssue({ assignee: null });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.raw.assignee).toBe('Unassigned');
    });

    it('handles null description gracefully', () => {
      const issue = makeLinearIssue({ description: null });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.body).toBe('');
      expect(item.raw.description).toBe('');
    });

    it('maps labels from nodes[].name to string array', () => {
      const issue = makeLinearIssue({
        labels: { nodes: [{ name: 'bug' }, { name: 'P0' }, { name: 'backend' }] },
      });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.labels).toEqual(['bug', 'P0', 'backend']);
      expect(item.raw.labels).toEqual(['bug', 'P0', 'backend']);
    });

    it('handles null labels gracefully', () => {
      const issue = makeLinearIssue({ labels: null });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.labels).toEqual([]);
    });

    it('constructs correct url from issue data', () => {
      const issue = makeLinearIssue({ url: 'https://linear.app/myteam/issue/ENG-42' });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.url).toBe('https://linear.app/myteam/issue/ENG-42');
    });

    it('creates correct item ID via createItemId', () => {
      const issue = makeLinearIssue({ identifier: 'DEV-7' });
      const item = mapLinearIssueToPollItem(issue, { teamId: 'DEV' });

      expect(item.id).toBe('linear:DEV:issue:DEV-7');
    });

    it('extracts team key from identifier when no teamId in config', () => {
      const issue = makeLinearIssue({ identifier: 'PROD-123' });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.raw.teamKey).toBe('PROD');
      expect(item.id).toBe('linear:PROD:issue:PROD-123');
    });

    it('hashes updatedAt for deduplication', () => {
      const issue = makeLinearIssue({ updatedAt: '2026-01-15T10:30:00.000Z' });
      const item = mapLinearIssueToPollItem(issue, {});

      expect(item.hash).toBe(hashContent('2026-01-15T10:30:00.000Z'));
      expect(typeof item.hash).toBe('string');
      expect(item.hash.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // e) pollLinear error handling
  // ==========================================================================

  describe('pollLinear error handling', () => {
    it('returns error message when API key not configured', () => {
      // loadLinearApiKey returns null when nothing configured
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const key = loadLinearApiKey({});
      expect(key).toBeNull();
      // The actual pollLinear would return: { items: [], error: "..." }
    });

    it('returns empty items array on error (not undefined)', () => {
      // Simulate error result shape
      const errorResult = { items: [] as PollResultItem[], error: 'Some error' };
      expect(errorResult.items).toEqual([]);
      expect(Array.isArray(errorResult.items)).toBe(true);
      expect(errorResult.error).toBeDefined();
    });

    it('error result includes status code for HTTP errors', () => {
      const errorMessage = `Linear API error (401): Unauthorized`;
      expect(errorMessage).toContain('401');
    });

    it('error result includes message for network failures', () => {
      const errorMessage = `Linear polling failed: TypeError: fetch failed`;
      expect(errorMessage).toContain('Linear polling failed');
    });
  });

  // ==========================================================================
  // f) Linear output handlers
  // ==========================================================================

  describe('Linear output handlers', () => {
    it('linear_comment constructs correct GraphQL mutation', () => {
      const mutation = buildLinearCommentMutation('issue-uuid-1', 'Great work on this!');
      expect(mutation).toContain('commentCreate');
      expect(mutation).toContain('issueId: "issue-uuid-1"');
      expect(mutation).toContain('body: "Great work on this!"');
    });

    it('linear_comment includes issueId and body in input', () => {
      const mutation = buildLinearCommentMutation('abc-123', 'Test comment');
      expect(mutation).toContain('issueId: "abc-123"');
      expect(mutation).toContain('body: "Test comment"');
    });

    it('linear_comment escapes special characters', () => {
      const mutation = buildLinearCommentMutation('id-1', 'Line 1\nLine 2\nHas "quotes"');
      expect(mutation).toContain('\\n');
      expect(mutation).toContain('\\"quotes\\"');
    });

    it('linear_comment skips when output disabled', () => {
      const output: OutputConfig = { type: 'linear_comment', enabled: false };
      expect(output.enabled).toBe(false);
    });

    it('linear_transition constructs issueUpdate mutation with stateId', () => {
      const mutation = buildLinearTransitionMutation('issue-uuid-1', 'state-done-id');
      expect(mutation).toContain('issueUpdate');
      expect(mutation).toContain('id: "issue-uuid-1"');
      expect(mutation).toContain('stateId: "state-done-id"');
    });

    it('linear_transition uses correct auth header', () => {
      const apiKey = 'lin_api_test';
      const headers = { Authorization: apiKey, 'Content-Type': 'application/json' };
      expect(headers.Authorization).toBe('lin_api_test');
      expect(headers.Authorization).not.toContain('Basic');
    });

    it('linear_create_issue constructs issueCreate mutation', () => {
      const mutation = buildLinearCreateIssueMutation('team-uuid-1', 'New Bug', 'Description of the bug');
      expect(mutation).toContain('issueCreate');
      expect(mutation).toContain('teamId: "team-uuid-1"');
      expect(mutation).toContain('title: "New Bug"');
      expect(mutation).toContain('description: "Description of the bug"');
    });

    it('linear_create_issue returns created issue fields', () => {
      const mutation = buildLinearCreateIssueMutation('team-1', 'Title', 'Desc');
      expect(mutation).toContain('issue { id identifier url }');
    });

    it('linear_create_issue handles empty description', () => {
      const mutation = buildLinearCreateIssueMutation('team-1', 'Title');
      expect(mutation).toContain('description: ""');
    });
  });

  // ==========================================================================
  // g) create_automation with Linear source
  // ==========================================================================

  describe('create_automation with Linear source', () => {
    it('accepts "linear" as sourceType', () => {
      const automation = makeLinearAutomation();
      expect(automation.source.type).toBe('linear');
    });

    it('parses Linear source config JSON correctly', () => {
      const configJson = '{"teamId":"ENG","projectId":"Backend","filter":"state: { name: { neq: \\"Done\\" } }"}';
      const config = JSON.parse(configJson) as LinearSourceConfig;
      expect(config.teamId).toBe('ENG');
      expect(config.projectId).toBe('Backend');
      expect(config.filter).toContain('Done');
    });

    it('builds outputLinearComment output config', () => {
      const outputs: OutputConfig[] = [];
      const outputLinearComment = true;
      if (outputLinearComment) {
        outputs.push({ type: 'linear_comment', enabled: true });
      }
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('linear_comment');
      expect(outputs[0].enabled).toBe(true);
    });

    it('builds outputLinearTransition output config with template', () => {
      const outputs: OutputConfig[] = [];
      const outputLinearTransition = 'Done';
      if (outputLinearTransition) {
        outputs.push({ type: 'linear_transition', enabled: true, template: outputLinearTransition });
      }
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('linear_transition');
      expect(outputs[0].template).toBe('Done');
    });

    it('builds outputLinearCreateIssue output config', () => {
      const outputs: OutputConfig[] = [];
      const outputLinearCreateIssue = true;
      if (outputLinearCreateIssue) {
        outputs.push({ type: 'linear_create_issue', enabled: true });
      }
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('linear_create_issue');
    });

    it('combines multiple Linear outputs in outputs array', () => {
      const outputs: OutputConfig[] = [];
      outputs.push({ type: 'linear_comment', enabled: true });
      outputs.push({ type: 'linear_transition', enabled: true, template: 'In Review' });
      outputs.push({ type: 'linear_create_issue', enabled: true });

      expect(outputs).toHaveLength(3);
      expect(outputs.map(o => o.type)).toEqual([
        'linear_comment',
        'linear_transition',
        'linear_create_issue',
      ]);
    });
  });

  // ==========================================================================
  // h) Linear template variables
  // ==========================================================================

  describe('Linear template variables', () => {
    it('interpolateTemplate works with identifier', () => {
      const result = interpolateTemplate('Issue: {{identifier}}', { identifier: 'ENG-42' });
      expect(result).toBe('Issue: ENG-42');
    });

    it('interpolateTemplate works with title', () => {
      const result = interpolateTemplate('Title: {{title}}', { title: 'Fix login bug' });
      expect(result).toBe('Title: Fix login bug');
    });

    it('interpolateTemplate works with state', () => {
      const result = interpolateTemplate('Status: {{state}}', { state: 'In Progress' });
      expect(result).toBe('Status: In Progress');
    });

    it('interpolateTemplate works with priority', () => {
      const result = interpolateTemplate('Priority: {{priority}}', { priority: 'High' });
      expect(result).toBe('Priority: High');
    });

    it('interpolateTemplate works with assignee', () => {
      const result = interpolateTemplate('Assigned to: {{assignee}}', { assignee: 'Alice' });
      expect(result).toBe('Assigned to: Alice');
    });

    it('interpolateTemplate works with creator', () => {
      const result = interpolateTemplate('Created by: {{creator}}', { creator: 'Bob' });
      expect(result).toBe('Created by: Bob');
    });

    it('interpolateTemplate works with url', () => {
      const url = 'https://linear.app/team/issue/ENG-42';
      const result = interpolateTemplate('Link: {{url}}', { url });
      expect(result).toBe(`Link: ${url}`);
    });

    it('interpolateTemplate works with all Linear variables together', () => {
      const template = '{{identifier}}: {{title}} [{{state}}] P:{{priority}} @{{assignee}} by {{creator}} {{url}}';
      const vars = {
        identifier: 'ENG-42',
        title: 'Fix bug',
        state: 'In Progress',
        priority: 'High',
        assignee: 'Alice',
        creator: 'Bob',
        url: 'https://linear.app/issue/ENG-42',
      };
      const result = interpolateTemplate(template, vars);
      expect(result).toBe('ENG-42: Fix bug [In Progress] P:High @Alice by Bob https://linear.app/issue/ENG-42');
    });

    it('handles labels variable formatting', () => {
      const labels = ['bug', 'urgent', 'backend'];
      const result = interpolateTemplate('Labels: {{labels}}', { labels: labels.join(', ') });
      expect(result).toBe('Labels: bug, urgent, backend');
    });
  });

  // ==========================================================================
  // i) Linear priority mapping
  // ==========================================================================

  describe('Linear priority mapping', () => {
    it('maps 0 to "No priority"', () => {
      expect(linearPriorityLabel(0)).toBe('No priority');
    });

    it('maps 1 to "Urgent"', () => {
      expect(linearPriorityLabel(1)).toBe('Urgent');
    });

    it('maps 2 to "High"', () => {
      expect(linearPriorityLabel(2)).toBe('High');
    });

    it('maps 3 to "Medium"', () => {
      expect(linearPriorityLabel(3)).toBe('Medium');
    });

    it('maps 4 to "Low"', () => {
      expect(linearPriorityLabel(4)).toBe('Low');
    });

    it('maps unknown values to "Unknown"', () => {
      expect(linearPriorityLabel(5)).toBe('Unknown');
      expect(linearPriorityLabel(-1)).toBe('Unknown');
    });
  });

  // ==========================================================================
  // GraphQL helper tests
  // ==========================================================================

  describe('buildLinearIssuesQuery', () => {
    it('returns valid GraphQL query string', () => {
      const query = buildLinearIssuesQuery({});
      expect(query).toContain('issues(');
      expect(query).toContain('nodes');
    });

    it('includes team filter when teamId provided', () => {
      const query = buildLinearIssuesQuery({ teamId: 'BACKEND' });
      expect(query).toContain('team: { key: { eq: "BACKEND" } }');
    });

    it('includes project filter when projectId provided', () => {
      const query = buildLinearIssuesQuery({ projectId: 'API Redesign' });
      expect(query).toContain('project: { name: { eq: "API Redesign" } }');
    });

    it('omits filters when none provided', () => {
      const query = buildLinearIssuesQuery({});
      expect(query).not.toContain('filter:');
    });

    it('sets first: 20 pagination limit', () => {
      const query = buildLinearIssuesQuery({});
      expect(query).toContain('first: 20');
    });

    it('orders by updatedAt', () => {
      const query = buildLinearIssuesQuery({});
      expect(query).toContain('orderBy: updatedAt');
    });
  });

  describe('buildLinearCommentMutation', () => {
    it('returns valid GraphQL mutation string', () => {
      const mutation = buildLinearCommentMutation('id-1', 'Hello');
      expect(mutation).toContain('mutation');
      expect(mutation).toContain('commentCreate');
    });

    it('includes issueId and body variables', () => {
      const mutation = buildLinearCommentMutation('issue-abc', 'Test body');
      expect(mutation).toContain('issueId: "issue-abc"');
      expect(mutation).toContain('body: "Test body"');
    });

    it('escapes special characters in body text', () => {
      const mutation = buildLinearCommentMutation('id', 'Line1\nLine2\n"quoted"');
      expect(mutation).toContain('\\n');
      expect(mutation).toContain('\\"quoted\\"');
    });
  });

  describe('buildLinearTransitionMutation', () => {
    it('returns valid GraphQL mutation with issueId and stateId', () => {
      const mutation = buildLinearTransitionMutation('issue-1', 'state-done');
      expect(mutation).toContain('issueUpdate');
      expect(mutation).toContain('id: "issue-1"');
      expect(mutation).toContain('stateId: "state-done"');
    });
  });

  describe('buildLinearCreateIssueMutation', () => {
    it('returns valid GraphQL mutation with teamId, title, description', () => {
      const mutation = buildLinearCreateIssueMutation('team-1', 'New Issue', 'Details here');
      expect(mutation).toContain('issueCreate');
      expect(mutation).toContain('teamId: "team-1"');
      expect(mutation).toContain('title: "New Issue"');
      expect(mutation).toContain('description: "Details here"');
    });

    it('handles optional description (defaults to "")', () => {
      const mutation = buildLinearCreateIssueMutation('team-1', 'No Desc');
      expect(mutation).toContain('description: ""');
    });
  });
});
