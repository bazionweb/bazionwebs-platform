import { useCallback, useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toTitleCase } from '../utils/stringFormatter';
import { Group } from '../components/GroupsManagementPage';
import {
  GET_GROUPS_QUERY,
  ADD_GROUP_MUTATION,
  UPDATE_GROUP_MUTATION,
  DELETE_GROUP_MUTATION,
} from '../services/graphql/groups';
import { Member } from '../components/memberData';

export function useGroups(members: Member[] = []) {
  const { data, loading, error } = useQuery(GET_GROUPS_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [addGroupMutation] = useMutation(ADD_GROUP_MUTATION, { refetchQueries: [{ query: GET_GROUPS_QUERY }] });
  const [updateGroupMutation] = useMutation(UPDATE_GROUP_MUTATION, { refetchQueries: [{ query: GET_GROUPS_QUERY }] });
  const [deleteGroupMutation] = useMutation(DELETE_GROUP_MUTATION, { refetchQueries: [{ query: GET_GROUPS_QUERY }] });

  const groups: Group[] = useMemo(() => {
    const edges = data?.groupsCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (edge: {
        node: {
          id: number;
          name: string;
          leader?: { email?: string } | null;
          leader_id?: string;
          member_count?: number;
          created_at?: string;
          category?: string;
        };
      }) => {
        const g = edge.node;
        return {
          id: g.id,
          name: g.name,
          leader: g.leader?.email || g.leader_id || '',
          members: g.member_count || 0,
          created: g.created_at ? new Date(g.created_at).toISOString().split('T')[0] : '',
          category: g.category || 'General',
        };
      },
    );
  }, [data]);

  const addGroup = useCallback(
    async (groupData: Partial<Group>) => {
      // Find member ID by email (UI uses email for leader)
      const leaderMember = members.find((m) => m.email === groupData.leader);

      await addGroupMutation({
        variables: {
          object: {
            name: toTitleCase(groupData.name),
            leader_id: leaderMember?.id || null,
            member_count: groupData.members || 0,
            category: toTitleCase(groupData.category) || 'General',
          },
        },
      });
    },
    [members, addGroupMutation],
  );

  const updateGroup = useCallback(
    async (id: number, updates: Partial<Group> & { leaderId?: string }) => {
      const set: Record<string, unknown> = {};
      if (updates.name) set.name = toTitleCase(updates.name);
      if (updates.leaderId !== undefined) {
        set.leader_id = updates.leaderId || null;
      } else if (updates.leader) {
        const leaderMember = members.find((m) => m.email === updates.leader);
        set.leader_id = leaderMember?.id || null;
      }
      if (updates.members !== undefined) set.member_count = updates.members;
      if (updates.category) set.category = toTitleCase(updates.category);

      await updateGroupMutation({
        variables: { id, _set: set },
      });
    },
    [members, updateGroupMutation],
  );

  const deleteGroup = useCallback(
    async (id: number) => {
      await deleteGroupMutation({
        variables: { id },
      });
    },
    [deleteGroupMutation],
  );

  return {
    data: groups,
    loading,
    error,
    addGroup,
    updateGroup,
    deleteGroup,
    setData: () => {}, // Compatibility
  };
}
