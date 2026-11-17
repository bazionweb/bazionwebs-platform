import { describe, it, expect, beforeEach } from 'vitest';

describe('SecureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should import and construct SecureStorage', async () => {
    const { SecureStorage } = await import('./SecureStorage');
    const storage = new SecureStorage('test-namespace');
    expect(storage).toBeDefined();
    expect(storage).toHaveProperty('getItem');
    expect(storage).toHaveProperty('setItem');
    expect(storage).toHaveProperty('removeItem');
  });

  it('should store and retrieve items', async () => {
    const { SecureStorage } = await import('./SecureStorage');
    const storage = new SecureStorage('test-key');
    await storage.setItem('{"data": "test-value"}');
    const result = await storage.getItem();
    expect(result).toBe('{"data": "test-value"}');
  });

  it('should return null for missing items', async () => {
    const { SecureStorage } = await import('./SecureStorage');
    const storage = new SecureStorage('non-existent');
    const result = await storage.getItem();
    expect(result).toBeNull();
  });

  it('should remove items', async () => {
    const { SecureStorage } = await import('./SecureStorage');
    const storage = new SecureStorage('temp-key');
    await storage.setItem('some-value');
    expect(await storage.getItem()).toBe('some-value');
    storage.removeItem();
    expect(await storage.getItem()).toBeNull();
  });

  it('should handle multiple namespaces independently', async () => {
    const { SecureStorage } = await import('./SecureStorage');
    const storageA = new SecureStorage('namespace-a');
    const storageB = new SecureStorage('namespace-b');

    await storageA.setItem('value-a');
    await storageB.setItem('value-b');

    expect(await storageA.getItem()).toBe('value-a');
    expect(await storageB.getItem()).toBe('value-b');
  });
});
