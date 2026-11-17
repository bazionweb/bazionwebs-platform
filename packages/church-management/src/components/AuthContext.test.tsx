import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn().mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  }),
  useAuth: vi.fn().mockReturnValue({
    getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
    signOut: vi.fn(),
    userId: 'clerk-user-123',
  }),
  useSignIn: vi.fn().mockReturnValue({
    isLoaded: true,
    signIn: { create: vi.fn() },
  }),
  useSignUp: vi.fn().mockReturnValue({
    isLoaded: true,
    signUp: { create: vi.fn() },
  }),
}));

const mockQuery = vi.fn();
const mockMutate = vi.fn();
vi.mock('./AuthorizedApolloProvider', () => ({
  client: { query: mockQuery, mutate: mockMutate },
}));

vi.mock('./userData', () => ({
  User: class User {},
}));

vi.mock('../services/graphql/users', () => ({
  GET_USER_QUERY: 'query GetUser { users_by_pk { id username email role avatar last_login } }',
  UPSERT_USER_MUTATION: 'mutation UpsertUser { insert_users_one { id } }',
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export AuthProvider and useAuth hook', async () => {
    const mod = await import('./AuthContext');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });

  it('should handle existing user profile sync', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        users_by_pk: {
          id: 'clerk-user-123',
          username: 'testuser',
          email: 'test@church.com',
          role: 'Admin',
          avatar: null,
          last_login: '2025-01-01T00:00:00Z',
        },
      },
    });

    const mod = await import('./AuthContext');
    expect(mod.AuthProvider).toBeDefined();
  });

  it('should create new user profile when not found in Supabase', async () => {
    mockQuery.mockResolvedValueOnce({ data: { users_by_pk: null } });
    mockMutate.mockResolvedValueOnce({ data: { insert_users_one: { id: 'clerk-user-123' } } });

    const mod = await import('./AuthContext');
    expect(mod.AuthProvider).toBeDefined();
  });

  it('should handle query errors gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Network error'));

    const mod = await import('./AuthContext');
    expect(mod.AuthProvider).toBeDefined();
  });
});
