import '@testing-library/jest-dom';

// Use Node.js Web Crypto API (jsdom's crypto.subtle has issues with importKey)
const nodeCrypto = await import('node:crypto');
Object.defineProperty(globalThis, 'crypto', {
  value: nodeCrypto.webcrypto as Crypto,
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock });

// Mock window.Clerk
Object.defineProperty(globalThis, 'Clerk', {
  value: {
    session: {
      getToken: async () => 'mock-clerk-token',
    },
  },
  writable: true,
});

// Mock fetch for tests that use it
globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('api.ipify.org')) {
    return new Response(JSON.stringify({ ip: '203.0.113.42' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 404 });
};
