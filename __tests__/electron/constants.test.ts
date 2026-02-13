import { describe, it, expect } from 'vitest';
import { MIME_TYPES, API_PORT, TG_CHARACTER_FACES, SLACK_CHARACTER_FACES } from '../../electron/constants';

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
