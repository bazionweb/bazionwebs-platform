import { describe, it, expect } from 'vitest';

const sanitise = (input: any): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>\/]/g, '')
    .replace(/\0/g, '')
    .trim()
    .substring(0, 500);
};

describe('sanitise tests', () => {
  it('HTML angle brackets removed', () => {
    expect(sanitise('<b>hello</b>')).toBe('bhellob');
  });

  it('null bytes stripped', () => {
    expect(sanitise('hello\0world')).toBe('helloworld');
  });

  it('whitespace trimmed', () => {
    expect(sanitise('  hello  ')).toBe('hello');
  });

  it('longer than 500 chars truncated', () => {
    const long = 'a'.repeat(600);
    expect(sanitise(long)).toHaveLength(500);
  });

  it('non-string input returns empty string', () => {
    expect(sanitise(null)).toBe('');
    expect(sanitise(123)).toBe('');
  });
});






