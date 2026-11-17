import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOrgEmail, loadImprovMXConfig } from './improvmxService';

describe('improvmxService', () => {
  describe('generateOrgEmail', () => {
    it('generates email from full name', () => {
      const email = generateOrgEmail('John Doe', 'hkmministries.org');
      expect(email).toBe('john.doe@hkmministries.org');
    });

    it('handles multiple spaces', () => {
      const email = generateOrgEmail('Jane  Wanjiku', 'hkmministries.org');
      expect(email).toBe('jane.wanjiku@hkmministries.org');
    });

    it('handles special characters', () => {
      const email = generateOrgEmail("Mary O'Brien", 'hkmministries.org');
      expect(email).toBe('mary.obrien@hkmministries.org');
    });

    it('trims whitespace', () => {
      const email = generateOrgEmail('  Peter Kamau  ', 'hkmministries.org');
      expect(email).toBe('peter.kamau@hkmministries.org');
    });

    it('lowercases the result', () => {
      const email = generateOrgEmail('JOHN DOE', 'hkmministries.org');
      expect(email).toBe('john.doe@hkmministries.org');
    });

    it('uses custom domain', () => {
      const email = generateOrgEmail('Test User', 'custom.church.org');
      expect(email).toBe('test.user@custom.church.org');
    });
  });

  describe('loadImprovMXConfig', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
      });
    });

    it('returns defaults when no settings stored', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      const config = loadImprovMXConfig();
      expect(config.apiKey).toBe('');
      expect(config.domain).toBe('hkmministries.org');
    });

    it('returns stored config when available', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify({
          improvmxConfig: { apiKey: 'test-key-123', domain: 'test.org' },
        }),
      );
      const config = loadImprovMXConfig();
      expect(config.apiKey).toBe('test-key-123');
      expect(config.domain).toBe('test.org');
    });

    it('returns defaults when config section is missing', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ smsConfig: { apiKey: 'x' } }));
      const config = loadImprovMXConfig();
      expect(config.apiKey).toBe('');
      expect(config.domain).toBe('hkmministries.org');
    });

    it('returns defaults on corrupt JSON', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('not-json');
      const config = loadImprovMXConfig();
      expect(config.apiKey).toBe('');
      expect(config.domain).toBe('hkmministries.org');
    });
  });
});
