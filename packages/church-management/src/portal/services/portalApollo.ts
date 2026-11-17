import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

import { setContext } from '@apollo/client/link/context';
import { MemberUser } from '../types';

// Supabase pg_graphql endpoint
const graphQlUrl = import.meta.env.VITE_SUPABASE_GRAPHQL_URL;
if (!graphQlUrl) {
  console.warn('⚠️ Missing VITE_SUPABASE_GRAPHQL_URL. Falling back to local Supabase (http://localhost:54321).');
}
const httpLink = createHttpLink({
  uri: graphQlUrl || 'http://localhost:54321/graphql/v1',
});

const authLink = setContext((_, { headers }) => {
  const sessionStr = localStorage.getItem('hkm_portal_session');
  let token = import.meta.env.VITE_SUPABASE_ANON_KEY || ''; // Default to anon key

  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr) as MemberUser;
      if (session.token) {
        token = session.token;
      }
    } catch {
      // ignore parse error
    }
  }

  return {
    headers: {
      ...headers,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      Authorization: `Bearer ${token}`,
    },
  };
});

export const portalApolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
