import { useMutation, useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { User as AppUser } from '../components/userData';
import {
  GET_USERS_QUERY,
  UPSERT_USER_MUTATION,
  UPDATE_USER_MUTATION,
  DELETE_USER_MUTATION,
} from '../services/graphql/users';
import { toTitleCase } from '../utils/stringFormatter';

export function useUsers() {
  const {
    data: queryData,
    loading,
    error,
  } = useQuery(GET_USERS_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [upsertUserMutation] = useMutation(UPSERT_USER_MUTATION, {
    refetchQueries: [{ query: GET_USERS_QUERY }],
  });
  const [updateUserMutation] = useMutation(UPDATE_USER_MUTATION, {
    refetchQueries: [{ query: GET_USERS_QUERY }],
  });
  const [deleteUserMutation] = useMutation(DELETE_USER_MUTATION, {
    refetchQueries: [{ query: GET_USERS_QUERY }],
  });

  const users: AppUser[] = useMemo(() => {
    if (!queryData?.usersCollection?.edges) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return queryData.usersCollection.edges.map((e: any) => {
      const u = e.node;
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: toTitleCase(u.role || 'Data Personnel'),
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${u.username}`,
        lastLogin: u.last_login || '',
        passwordHash: 'MANAGED_BY_FIREBASE',
      };
    });
  }, [queryData]);

  const upsertUser = async (user: Partial<AppUser>) => {
    if (!user.id || !user.email) return;

    const isExistingUser = users.some((u) => u.id === user.id);
    const roleValue = toTitleCase(user.role || 'Data Personnel');

    if (isExistingUser) {
      await updateUserMutation({
        variables: {
          id: user.id,
          changes: {
            username: user.username || user.email.split('@')[0],
            role: roleValue,
            avatar: user.avatar,
            updated_at: new Date().toISOString(),
          },
        },
      });
    } else {
      await upsertUserMutation({
        variables: {
          object: {
            id: user.id,
            username: user.username || user.email.split('@')[0],
            email: user.email,
            role: roleValue,
            avatar: user.avatar,
            last_login: user.lastLogin || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      });
    }
  };

  const deleteUser = async (id: string) => {
    await deleteUserMutation({
      variables: { id },
    });
  };

  return {
    users,
    loading,
    error,
    upsertUser,
    deleteUser,
  };
}
