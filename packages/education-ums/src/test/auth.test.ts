import { describe, it, expect } from 'vitest';

const isExpired = (exp: number): boolean => exp < Math.floor(Date.now() / 1000);
const hasValidExp = (payload: any): boolean => typeof payload.exp === 'number';

describe('auth tests', () => {
  it('expired token detection', () => {
    expect(isExpired(Math.floor(Date.now() / 1000) - 60)).toBe(true);
  });

  it('valid token detection', () => {
    expect(isExpired(Math.floor(Date.now() / 1000) + 3600)).toBe(false);
  });

  it('missing exp field rejection', () => {
    expect(hasValidExp({})).toBe(false);
  });
});





