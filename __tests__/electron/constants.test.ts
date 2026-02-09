import { describe, it, expect } from 'vitest';
import { CLAUDE_PATTERNS, MIME_TYPES, API_PORT, TG_CHARACTER_FACES, SLACK_CHARACTER_FACES } from '../../electron/constants';

describe('Constants', () => {
  describe('API_PORT', () => {
    it('should be 31415', () => {
      expect(API_PORT).toBe(31415);
    });
  });

  describe('MIME_TYPES', () => {
    it('maps common extensions correctly', () => {
      expect(MIME_TYPES['.html']).toBe('text/html');
      expect(MIME_TYPES['.js']).toBe('application/javascript');
      expect(MIME_TYPES['.css']).toBe('text/css');
      expect(MIME_TYPES['.json']).toBe('application/json');
      expect(MIME_TYPES['.png']).toBe('image/png');
      expect(MIME_TYPES['.jpg']).toBe('image/jpeg');
      expect(MIME_TYPES['.svg']).toBe('image/svg+xml');
      expect(MIME_TYPES['.mp4']).toBe('video/mp4');
      expect(MIME_TYPES['.woff2']).toBe('font/woff2');
    });

    it('returns undefined for unknown extensions', () => {
      expect(MIME_TYPES['.xyz']).toBeUndefined();
    });
  });

  describe('TG_CHARACTER_FACES', () => {
    it('maps all characters to emojis', () => {
      expect(TG_CHARACTER_FACES.robot).toBe('🤖');
      expect(TG_CHARACTER_FACES.ninja).toBe('🥷');
      expect(TG_CHARACTER_FACES.wizard).toBe('🧙');
      expect(TG_CHARACTER_FACES.astronaut).toBe('👨‍🚀');
      expect(TG_CHARACTER_FACES.alien).toBe('👽');
    });
  });

  describe('SLACK_CHARACTER_FACES', () => {
    it('maps characters to Slack emoji codes', () => {
      expect(SLACK_CHARACTER_FACES.robot).toBe(':robot_face:');
      expect(SLACK_CHARACTER_FACES.ninja).toBe(':ninja:');
      expect(SLACK_CHARACTER_FACES.wizard).toBe(':mage:');
    });
  });
});

describe('CLAUDE_PATTERNS', () => {
  describe('waitingForInput patterns', () => {
    it('matches prompt character ❯', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      const hasMatch = patterns.some(p => p.test('❯ '));
      expect(hasMatch).toBe(true);
    });

    it('matches Y/n confirmation prompts', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('Continue? [Y/n]'))).toBe(true);
      expect(patterns.some(p => p.test('Continue? [y/N]'))).toBe(true);
      expect(patterns.some(p => p.test('Continue? (y/n)'))).toBe(true);
    });

    it('matches "Do you want to" patterns', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('Do you want to create this file?'))).toBe(true);
      expect(patterns.some(p => p.test('Do you want to proceed?'))).toBe(true);
      expect(patterns.some(p => p.test('Do you want to run this command?'))).toBe(true);
    });

    it('matches question patterns', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('What would you like me to do?'))).toBe(true);
      expect(patterns.some(p => p.test('How would you like to proceed?'))).toBe(true);
      expect(patterns.some(p => p.test('Should I continue?'))).toBe(true);
      expect(patterns.some(p => p.test('Would you like me to fix this?'))).toBe(true);
    });

    it('matches Esc to cancel', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('Esc to cancel'))).toBe(true);
    });

    it('matches arrow key prompt', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('(Use arrow keys)'))).toBe(true);
    });

    it('matches shell prompt $', () => {
      const patterns = CLAUDE_PATTERNS.waitingForInput;
      expect(patterns.some(p => p.test('user@host $ '))).toBe(true);
    });
  });

  describe('working patterns', () => {
    it('matches spinner characters', () => {
      const patterns = CLAUDE_PATTERNS.working;
      expect(patterns.some(p => p.test('⠋ Processing...'))).toBe(true);
      expect(patterns.some(p => p.test('⠙ Loading'))).toBe(true);
      expect(patterns.some(p => p.test('◐ Working'))).toBe(true);
    });

    it('matches progress messages', () => {
      const patterns = CLAUDE_PATTERNS.working;
      expect(patterns.some(p => p.test('Thinking...'))).toBe(true);
      expect(patterns.some(p => p.test('Working...'))).toBe(true);
      expect(patterns.some(p => p.test('Analyzing...'))).toBe(true);
      expect(patterns.some(p => p.test('Reading file.ts...'))).toBe(true);
      expect(patterns.some(p => p.test('Running tests...'))).toBe(true);
    });
  });

  describe('completed patterns', () => {
    it('matches completion markers', () => {
      const patterns = CLAUDE_PATTERNS.completed;
      expect(patterns.some(p => p.test('Task completed'))).toBe(true);
      expect(patterns.some(p => p.test('Done!'))).toBe(true);
      expect(patterns.some(p => p.test('Successfully compiled'))).toBe(true);
      expect(patterns.some(p => p.test('✓ All tests passed'))).toBe(true);
      expect(patterns.some(p => p.test('Worked for 5 minutes'))).toBe(true);
    });
  });

  describe('error patterns', () => {
    it('matches error markers', () => {
      const patterns = CLAUDE_PATTERNS.error;
      expect(patterns.some(p => p.test('Error: Something went wrong'))).toBe(true);
      expect(patterns.some(p => p.test('Failed: build step'))).toBe(true);
      expect(patterns.some(p => p.test('FATAL: cannot continue'))).toBe(true);
      expect(patterns.some(p => p.test('Permission denied'))).toBe(true);
      expect(patterns.some(p => p.test('✗ Test failed'))).toBe(true);
    });
  });
});
