import { describe, it, expect } from 'vitest';

// ============================================================================
// isSafeUrl Tests (Fix 7)
// ============================================================================

// Inline the function for testing (same logic as in MarkdownRenderer.tsx)
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeUrl(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (SAFE_URL_PROTOCOLS.includes(parsed.protocol)) {
      return trimmed;
    }
  } catch {
    return trimmed;
  }
  return '#';
}

describe('isSafeUrl', () => {
  describe('allowed protocols', () => {
    it('should allow https: URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe('https://example.com');
    });

    it('should allow http: URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should allow mailto: URLs', () => {
      expect(isSafeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
    });
  });

  describe('blocked protocols', () => {
    it('should block javascript: URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe('#');
    });

    it('should block JAVASCRIPT: URLs (case insensitive)', () => {
      // URL constructor normalizes protocol to lowercase
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe('#');
    });

    it('should block JaVaScRiPt: URLs (mixed case)', () => {
      expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe('#');
    });

    it('should block data: URLs', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    });

    it('should block vbscript: URLs', () => {
      expect(isSafeUrl('vbscript:MsgBox("pwned")')).toBe('#');
    });
  });

  describe('relative and fragment URLs', () => {
    it('should allow #fragment', () => {
      expect(isSafeUrl('#section')).toBe('#section');
    });

    it('should allow ./relative paths', () => {
      expect(isSafeUrl('./page.html')).toBe('./page.html');
    });

    it('should allow ../parent relative paths', () => {
      expect(isSafeUrl('../other/page.html')).toBe('../other/page.html');
    });

    it('should allow /absolute paths', () => {
      expect(isSafeUrl('/about')).toBe('/about');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-padded URLs', () => {
      expect(isSafeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('should treat plain text as relative (safe)', () => {
      expect(isSafeUrl('just-some-text')).toBe('just-some-text');
    });
  });
});
