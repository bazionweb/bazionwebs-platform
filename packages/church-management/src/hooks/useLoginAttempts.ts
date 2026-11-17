import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_LOGIN_ATTEMPTS_QUERY, ADD_LOGIN_ATTEMPT_MUTATION } from '../services/graphql/cleanup';
import { LoginAttempt } from '../components/userSessionData';

let cachedIp: string | null = null;

async function detectIp(): Promise<string> {
  if (cachedIp) return cachedIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedIp = data.ip;
    return cachedIp || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function useLoginAttempts(options?: { skipQuery?: boolean }) {
  const [daysBack, setDaysBack] = useState(30);

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toISOString();
  }, [daysBack]);

  const {
    data: queryData,
    loading: queryLoading,
    error,
  } = useQuery(GET_LOGIN_ATTEMPTS_QUERY, {
    variables: { startDate },
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
    skip: options?.skipQuery,
  });

  const [addAttemptMutation] = useMutation(ADD_LOGIN_ATTEMPT_MUTATION);

  const logLoginAttempt = async (attempt: {
    ipAddress?: string;
    email?: string;
    timestamp?: string;
    success?: boolean;
    failureReason?: string;
    userAgent?: string;
    location?: string;
  }) => {
    try {
      const ip = attempt.ipAddress || (await detectIp());
      const id = Date.now().toString();
      await addAttemptMutation({
        variables: {
          object: {
            id,
            email: attempt.email,
            timestamp: attempt.timestamp || new Date().toISOString(),
            success: attempt.success,
            failure_reason: attempt.failureReason,
            ip_address: ip,
            user_agent: attempt.userAgent || navigator.userAgent,
            location: attempt.location || 'Unknown',
          },
        },
        refetchQueries: [{ query: GET_LOGIN_ATTEMPTS_QUERY }],
      });
    } catch (err) {
      console.error('Error logging login attempt:', err);
    }
  };

  const loadMoreAttempts = () => setDaysBack((prev) => prev + 30);

  const attempts: LoginAttempt[] = useMemo(() => {
    const edges = queryData?.login_attemptsCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (e: {
        node: {
          id: string;
          email?: string;
          timestamp?: string;
          success?: boolean;
          failure_reason?: string;
          ip_address?: string;
          user_agent?: string;
          location?: string;
        };
      }) => {
        const a = e.node;
        return {
          id: a.id,
          email: a.email || '',
          timestamp: a.timestamp || '',
          success: a.success || false,
          failureReason: a.failure_reason,
          ipAddress: a.ip_address,
          userAgent: a.user_agent,
          location: a.location,
        };
      },
    );
  }, [queryData]);

  return {
    attempts,
    loading: queryLoading && !queryData,
    error,
    daysBack,
    loadMoreAttempts,
    logLoginAttempt,
  };
}
