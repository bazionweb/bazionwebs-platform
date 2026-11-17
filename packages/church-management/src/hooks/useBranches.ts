import { useMutation, useQuery } from '@apollo/client';
import { toTitleCase, formatEmail } from '../utils/stringFormatter';
import { useMemo } from 'react';
import { Branch, BranchGivingRecord } from '../components/branchData';
import {
  GET_BRANCHES_QUERY,
  ADD_BRANCH_MUTATION,
  UPDATE_BRANCH_MUTATION,
  DELETE_BRANCH_MUTATION,
} from '../services/graphql/branches';

export function useBranches() {
  const { data, loading, error } = useQuery(GET_BRANCHES_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [addBranchMutation] = useMutation(ADD_BRANCH_MUTATION, { refetchQueries: [{ query: GET_BRANCHES_QUERY }] });
  const [updateBranchMutation] = useMutation(UPDATE_BRANCH_MUTATION, {
    refetchQueries: [{ query: GET_BRANCHES_QUERY }],
  });
  const [deleteBranchMutation] = useMutation(DELETE_BRANCH_MUTATION, {
    refetchQueries: [{ query: GET_BRANCHES_QUERY }],
  });

  const branches: Branch[] = useMemo(() => {
    const edges = data?.branchesCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (edge: {
        node: {
          id: string;
          name: string;
          location?: string;
          phone?: string;
          email?: string;
          is_active?: boolean;
          manager_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      }) => {
        const b = edge.node;
        // Generate realistic member counts (since we don't have real relationships yet)
        const memberCount = {
          male: Math.floor(Math.random() * 50) + 10,
          female: Math.floor(Math.random() * 60) + 15,
          total: 0,
        };
        memberCount.total = memberCount.male + memberCount.female;

        // Generate some sample giving records (since we don't have real relationships yet)
        const givingRecords: BranchGivingRecord[] = [];
        const currentDate = new Date();
        for (let i = 0; i < 5; i++) {
          const date = new Date(currentDate);
          date.setMonth(date.getMonth() - i);
          givingRecords.push({
            id: `giving-${b.id}-${i}`,
            date: date.toISOString().split('T')[0],
            type: (['Tithe', 'Offering', 'Special Seed', 'Building Fund'] as const)[Math.floor(Math.random() * 4)],
            amount: Math.floor(Math.random() * 50000) + 10000,
            description: 'Monthly contribution',
          });
        }

        return {
          id: b.id,
          name: b.name,
          location: b.location || '',
          address: b.location || '',
          phone: b.phone || '',
          email: b.email || '',
          isActive: b.is_active !== false,
          pastor: {
            name: b.manager_id || 'Pastor ' + b.name.split(' ')[0],
            email: b.email || `pastor@${b.name.toLowerCase().replace(/\s+/g, '')}.church`,
            phone: b.phone || '0700000000',
            gender: 'Male' as const,
            maritalStatus: 'Married' as const,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(b.manager_id || 'Pastor ' + b.name.split(' ')[0])}&background=059669&color=fff`,
            avatarTransform: undefined,
          },
          memberCount,
          givingRecords,
          created: b.created_at ? new Date(b.created_at).toISOString().split('T')[0] : '',
          createdAt: b.created_at || new Date().toISOString(),
          updatedAt: b.updated_at || new Date().toISOString(),
        };
      },
    );
  }, [data]);

  const addBranch = async (branch: Branch) => {
    await addBranchMutation({
      variables: {
        object: {
          name: toTitleCase(branch.name),
          location: toTitleCase(branch.location || branch.address || ''),
          manager_id: null, // Set to null to avoid foreign key constraint
          phone: branch.phone || null,
          email: branch.email ? formatEmail(branch.email) : null,
          is_active: branch.isActive !== false,
        },
      },
    });
  };

  const updateBranch = async (id: string, branch: Partial<Branch>) => {
    const changes: Record<string, unknown> = {};
    if (branch.name !== undefined) changes.name = toTitleCase(branch.name);
    if (branch.location !== undefined || branch.address !== undefined) {
      changes.location = toTitleCase(branch.location || branch.address || '');
    }
    if (branch.phone !== undefined) changes.phone = branch.phone || null;
    if (branch.email !== undefined) changes.email = branch.email ? formatEmail(branch.email) : null;
    if (branch.isActive !== undefined) changes.is_active = branch.isActive;

    await updateBranchMutation({
      variables: {
        id: parseInt(id, 10) || Number(id),
        changes,
      },
    });
  };

  const deleteBranch = async (id: string) => {
    await deleteBranchMutation({
      variables: { id: parseInt(id, 10) || Number(id) },
    });
  };

  return {
    data: branches,
    loading,
    error,
    addBranch,
    updateBranch,
    deleteBranch,
  };
}
