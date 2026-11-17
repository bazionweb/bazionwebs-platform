import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@apollo/client', () => ({
  useQuery: vi.fn().mockReturnValue({ data: null, loading: false }),
  useMutation: vi.fn().mockReturnValue([vi.fn().mockResolvedValue({})]),
  gql: vi.fn((str: string) => str),
}));

vi.mock('../services/graphql/cleanup', () => ({
  GET_LOGIN_ATTEMPTS_QUERY: 'query mock',
  ADD_LOGIN_ATTEMPT_MUTATION: 'mutation mock',
}));

describe('useLoginAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the correct hook interface', async () => {
    const { useLoginAttempts } = await import('./useLoginAttempts');
    const { result } = renderHook(() => useLoginAttempts());

    expect(result.current).toHaveProperty('attempts');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('daysBack');
    expect(result.current).toHaveProperty('loadMoreAttempts');
    expect(result.current).toHaveProperty('logLoginAttempt');
  });

  it('should start with 30 days back', async () => {
    const { useLoginAttempts } = await import('./useLoginAttempts');
    const { result } = renderHook(() => useLoginAttempts());
    expect(result.current.daysBack).toBe(30);
  });

  it('should increase daysBack when loadMoreAttempts is called', async () => {
    const { useLoginAttempts } = await import('./useLoginAttempts');
    const { result } = renderHook(() => useLoginAttempts());
    expect(result.current.daysBack).toBe(30);

    act(() => {
      result.current.loadMoreAttempts();
    });

    expect(result.current.daysBack).toBe(60);
  });

  it('should log login attempt via mutation', async () => {
    const { useLoginAttempts } = await import('./useLoginAttempts');
    const { result } = renderHook(() => useLoginAttempts());

    const attempt = {
      email: 'test@church.com',
      timestamp: new Date().toISOString(),
      success: true,
    };

    await expect(result.current.logLoginAttempt(attempt)).resolves.toBeUndefined();
  });
});
