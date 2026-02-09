import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron before importing utils
vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/mock/app/path',
  },
  Notification: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    show: vi.fn(),
  })),
  BrowserWindow: vi.fn(),
}));

import {
  isSuperAgent,
  getSuperAgent,
  formatAgentStatus,
  formatSlackAgentStatus,
  detectAgentStatus,
} from '../../electron/utils';
import type { AgentStatus } from '../../electron/types';

function makeAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    id: 'test-id',
    status: 'idle',
    projectPath: '/home/user/projects/my-app',
    skills: [],
    output: [],
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

describe('isSuperAgent', () => {
  it('returns true for "Super Agent" name', () => {
    expect(isSuperAgent(makeAgent({ name: 'Super Agent' }))).toBe(true);
  });

  it('returns true for "super agent" (case insensitive)', () => {
    expect(isSuperAgent(makeAgent({ name: 'My super agent' }))).toBe(true);
  });

  it('returns true for "orchestrator" name', () => {
    expect(isSuperAgent(makeAgent({ name: 'orchestrator' }))).toBe(true);
  });

  it('returns false for regular agent names', () => {
    expect(isSuperAgent(makeAgent({ name: 'Backend Worker' }))).toBe(false);
    expect(isSuperAgent(makeAgent({ name: 'Test Runner' }))).toBe(false);
  });

  it('returns false when name is undefined', () => {
    expect(isSuperAgent(makeAgent({ name: undefined }))).toBe(false);
  });
});

describe('getSuperAgent', () => {
  it('finds the super agent in a map', () => {
    const agents = new Map<string, AgentStatus>();
    agents.set('1', makeAgent({ id: '1', name: 'Worker' }));
    agents.set('2', makeAgent({ id: '2', name: 'Super Agent' }));
    agents.set('3', makeAgent({ id: '3', name: 'Tester' }));

    const result = getSuperAgent(agents);
    expect(result?.id).toBe('2');
  });

  it('returns undefined when no super agent exists', () => {
    const agents = new Map<string, AgentStatus>();
    agents.set('1', makeAgent({ id: '1', name: 'Worker' }));

    expect(getSuperAgent(agents)).toBeUndefined();
  });

  it('returns undefined for empty map', () => {
    expect(getSuperAgent(new Map())).toBeUndefined();
  });
});

describe('formatAgentStatus', () => {
  it('formats super agent with crown emoji', () => {
    const agent = makeAgent({ name: 'Super Agent', status: 'running' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('👑');
    expect(result).toContain('*Super Agent*');
    expect(result).toContain('🟢');
  });

  it('formats regular agent with character emoji', () => {
    const agent = makeAgent({ name: 'Worker', character: 'ninja', status: 'idle' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('🥷');
    expect(result).toContain('*Worker*');
    expect(result).toContain('⚪');
  });

  it('shows status emojis correctly', () => {
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'idle' }))).toContain('⚪');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'running' }))).toContain('🟢');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'completed' }))).toContain('✅');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'error' }))).toContain('🔴');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'waiting' }))).toContain('🟡');
  });

  it('truncates long task names', () => {
    const agent = makeAgent({ name: 'A', currentTask: 'A'.repeat(100) });
    const result = formatAgentStatus(agent);
    expect(result).toContain('...');
  });

  it('shows project for non-super agents', () => {
    const agent = makeAgent({ name: 'Worker', projectPath: '/home/user/my-project' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('`my-project`');
  });

  it('hides project for super agents', () => {
    const agent = makeAgent({ name: 'Super Agent', projectPath: '/home/user/my-project' });
    const result = formatAgentStatus(agent);
    expect(result).not.toContain('Project:');
  });
});

describe('formatSlackAgentStatus', () => {
  it('uses Slack emoji codes', () => {
    const agent = makeAgent({ name: 'Worker', character: 'robot', status: 'running', skills: [] });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain(':robot_face:');
    expect(result).toContain(':large_green_circle:');
  });

  it('shows skills when present', () => {
    const agent = makeAgent({ name: 'Worker', skills: ['skill1', 'skill2'], status: 'idle' });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain(':wrench:');
    expect(result).toContain('skill1');
  });

  it('truncates skills list beyond 3', () => {
    const agent = makeAgent({ name: 'Worker', skills: ['a', 'b', 'c', 'd'], status: 'idle' });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain('...');
  });

  it('shows current task when running', () => {
    const agent = makeAgent({ name: 'Worker', status: 'running', currentTask: 'Fix bug', skills: [] });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain('Fix bug');
  });
});

describe('detectAgentStatus', () => {
  it('detects running from spinner characters', () => {
    const agent = makeAgent({
      status: 'running',
      output: ['Some text', '⠋ Loading...'],
      lastActivity: new Date().toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('running');
  });

  it('detects running from working patterns', () => {
    const agent = makeAgent({
      status: 'running',
      output: ['Thinking...'],
      lastActivity: new Date().toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('running');
  });

  it('detects error from error patterns', () => {
    const agent = makeAgent({
      status: 'running',
      output: Array(10).fill('some output').concat(['Error: Something went wrong']),
      lastActivity: new Date(Date.now() - 5000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('error');
  });

  it('detects waiting from Y/n prompts', () => {
    const agent = makeAgent({
      status: 'running',
      output: Array(10).fill('some output').concat(['Continue? [Y/n]']),
      lastActivity: new Date(Date.now() - 5000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('waiting');
  });

  it('detects waiting from "Do you want to" prompts', () => {
    const agent = makeAgent({
      status: 'running',
      output: Array(10).fill('some output').concat(['Do you want to create this file?']),
      lastActivity: new Date(Date.now() - 5000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('waiting');
  });

  it('detects completed from completion markers', () => {
    const agent = makeAgent({
      status: 'running',
      output: Array(10).fill('some output').concat(['Task completed successfully']),
      lastActivity: new Date(Date.now() - 5000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('completed');
  });

  it('detects completed from ✓ marker', () => {
    const agent = makeAgent({
      status: 'running',
      output: Array(10).fill('some output').concat(['✓ All done']),
      lastActivity: new Date(Date.now() - 5000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('completed');
  });

  it('strips ANSI codes before pattern matching', () => {
    const agent = makeAgent({
      status: 'running',
      output: ['\x1B[32mThinking...\x1B[0m'],
      lastActivity: new Date().toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('running');
  });

  it('returns current status for idle agent with no recent output', () => {
    const agent = makeAgent({
      status: 'idle',
      output: [],
      lastActivity: new Date(Date.now() - 10000).toISOString(),
    });
    expect(detectAgentStatus(agent)).toBe('idle');
  });

  it('detects running when recently active with output', () => {
    const agent = makeAgent({
      status: 'idle',
      output: ['some new output'],
      lastActivity: new Date(Date.now() - 500).toISOString(), // 500ms ago
    });
    expect(detectAgentStatus(agent)).toBe('running');
  });
});
