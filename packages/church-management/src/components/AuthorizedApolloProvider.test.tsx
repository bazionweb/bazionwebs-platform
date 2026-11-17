import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn().mockReturnValue({
    getToken: vi.fn().mockResolvedValue('mock-clerk-jwt-token'),
  }),
}));

const mockClient = {
  link: {},
  cache: {},
  query: vi.fn().mockResolvedValue({ data: {} }),
  mutate: vi.fn().mockResolvedValue({ data: {} }),
};

class MockApolloClient {
  constructor() {
    return mockClient;
  }
}

vi.mock('@apollo/client', () => ({
  ApolloClient: MockApolloClient,
  ApolloProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  InMemoryCache: class {
    constructor() {
      return {};
    }
  },
  createHttpLink: vi.fn().mockReturnValue({}),
}));

vi.mock('@apollo/client/link/context', () => ({
  setContext: vi.fn().mockReturnValue({
    concat: vi.fn().mockReturnValue({}),
  }),
}));

describe('AuthorizedApolloProvider', () => {
  it('should render children without admin secret header', async () => {
    const { AuthorizedApolloProvider } = await import('./AuthorizedApolloProvider');

    render(
      <AuthorizedApolloProvider>
        <div data-testid="child">Test Child</div>
      </AuthorizedApolloProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should export client instance', async () => {
    const mod = await import('./AuthorizedApolloProvider');
    expect(mod.client).toBeDefined();
    expect(typeof mod.client.query).toBe('function');
  });
});
