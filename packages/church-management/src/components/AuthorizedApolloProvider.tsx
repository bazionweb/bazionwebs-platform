import React, { useEffect } from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { useAuth } from '@clerk/clerk-react';

// Supabase pg_graphQL endpoint
// VITE_SUPABASE_GRAPHQL_URL = https://<project-ref>.supabase.co/graphql/v1
// VITE_SUPABASE_ANON_KEY    = your supabase anon key
const graphQlUrl = import.meta.env.VITE_SUPABASE_GRAPHQL_URL;
if (!graphQlUrl) {
  console.warn(
    '⚠️ Missing VITE_SUPABASE_GRAPHQL_URL. Falling back to local Supabase (localhost) instead of a remote database — configure it in .env.',
  );
}
const httpUri = graphQlUrl || 'http://localhost:54321/graphql/v1';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''; // Must be a valid JWT starting with eyJ...

const isValidKey = anonKey && (anonKey.startsWith('eyJ') || anonKey.startsWith('sb_publishable_'));
if (!isValidKey) {
  console.warn('⚠️ Invalid or missing VITE_SUPABASE_ANON_KEY. Supabase requests will fail with 401 Unauthorized.');
}

let _getToken: (() => Promise<string | null>) | null = null;

export const setTokenProvider = (getTokenFn: () => Promise<string | null>) => {
  _getToken = getTokenFn;
};

const httpLink = createHttpLink({ uri: httpUri });

const authLink = setContext(async (_, { headers }) => {
  const token = _getToken ? await _getToken() : null;
  return {
    headers: {
      ...headers,
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${anonKey}` }),
    },
  };
});

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Tell Apollo how to handle Supabase's Relay-style paginated collections
        // so cached pages are merged rather than replaced on refetch.
        membersCollection: { merge: true },
        visitorsCollection: { merge: true },
        transactionsCollection: { merge: true },
        attendance_records: { merge: true },
        groupsCollection: { merge: true },
        equipmentCollection: { merge: true },
        sms_recordsCollection: { merge: true },
        branchesCollection: { merge: true },
        recycle_binCollection: { merge: true },
        usersCollection: { merge: true },
        permission_requestsCollection: { merge: true },
      },
    },
  },
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
  // Configure DevTools
  devtools: {
    enabled: import.meta.env.DEV,
  },
});

export const AuthorizedApolloProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    // 'supabase' is the Clerk JWT template name for Supabase integration
    setTokenProvider(async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) {
          console.error(
            'CLERK JWT ERROR: Supabase template returned null. Is the template created in Clerk Dashboard?',
          );
          window.dispatchEvent(new CustomEvent('clerk-jwt-error', { detail: 'Template missing or returned null' }));
        }
        return token;
      } catch (err) {
        console.error('CLERK JWT ERROR: Failed to get Supabase token.', err);
        window.dispatchEvent(new CustomEvent('clerk-jwt-error', { detail: (err as Error).message }));
        return null;
      }
    });
  }, [getToken]);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};
