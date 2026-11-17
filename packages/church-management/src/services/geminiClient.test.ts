import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {}
    models = {
      generateContent: vi.fn().mockResolvedValue({ text: 'Mocked AI response' }),
    };
  },
}));

describe('Gemini Client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export generateWithGemini function', async () => {
    const mod = await import('./geminiClient');
    expect(mod.generateWithGemini).toBeDefined();
    expect(typeof mod.generateWithGemini).toBe('function');
  });

  it('should call the Gemini proxy by default', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Proxy response' }] } }],
      }),
    });
    globalThis.fetch = mockFetch;

    const mod = await import('./geminiClient');
    const result = await mod.generateWithGemini('test prompt');
    expect(result).toBe('Proxy response');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should use direct API key when VITE_AI_API_KEY is set', async () => {
    vi.stubEnv('VITE_AI_API_KEY', 'test-api-key');

    const mod = await import('./geminiClient');
    const result = await mod.generateWithGemini('hello');
    expect(result).toBe('Mocked AI response');
  });

  it('should handle proxy errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    });
    globalThis.fetch = mockFetch;

    vi.unstubAllEnvs();

    const mod = await import('./geminiClient');
    await expect(mod.generateWithGemini('test')).rejects.toThrow();
  });
});
