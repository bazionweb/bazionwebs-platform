import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '@clerk/clerk-react';
import { toTitleCase, formatEmail } from '../utils/stringFormatter';
import { Member, EmailTier } from '../components/memberData';
import {
  GET_MEMBERS_QUERY,
  ADD_MEMBER_MUTATION,
  UPDATE_MEMBER_MUTATION,
  DELETE_MEMBER_MUTATION,
} from '../services/graphql/members';
import { ADD_AUDIT_LOG_MUTATION } from '../services/graphql/transactions';
import { updateAlias, deleteAlias } from '../services/improvmxService';

const GRAPHQL_SUFFIX = '/graphql/v1';

function getSupabaseRestUrl() {
  const explicitUrl = import.meta.env.VITE_SUPABASE_URL;
  const graphQlUrl = import.meta.env.VITE_SUPABASE_GRAPHQL_URL;
  // Local Supabase (localhost) is a safe non-production fallback; never silently
  // point at a remote database when env vars are missing.
  const baseUrl = explicitUrl || (graphQlUrl ? graphQlUrl.replace(GRAPHQL_SUFFIX, '') : 'http://localhost:54321');
  return `${baseUrl}/rest/v1`;
}

function parseCountHeader(contentRange: string | null): number | null {
  if (!contentRange) return null;

  const total = contentRange.split('/').pop();
  if (!total || total === '*') return null;

  const parsed = Number.parseInt(total, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

interface SupabaseMember {
  id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  department?: string;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Pending Fee';
  dob?: string;
  gender: 'Male' | 'Female';
  avatar_transform?: string;
  address?: string;
  joined_at?: string;
  occupation?: string;
  marital_status?: string;
  pin?: string | null;
  avatar?: string | null;
  is_portal_active?: boolean;
  email_tier?: EmailTier;
  org_email?: string;
}

// Transform Supabase data to frontend Member format
function transformMember(SupabaseMember: SupabaseMember): Member {
  const firstName = SupabaseMember.first_name || '';
  const lastName = SupabaseMember.last_name || '';
  let fullName = `${firstName} ${lastName}`.trim();

  // Fallback to email or ID if name is empty
  if (!fullName || fullName.length === 0) {
    if (SupabaseMember.email) {
      fullName = SupabaseMember.email.split('@')[0]; // Use email username part
    } else {
      fullName = `Member ${SupabaseMember.id}`; // Fallback to ID
    }
    console.warn('Member with empty name found, using fallback:', {
      id: SupabaseMember.id,
      firstName,
      lastName,
      email: SupabaseMember.email,
      fallbackName: fullName,
    });
  }

  return {
    id: SupabaseMember.id,
    name: fullName,
    title: SupabaseMember.title || '',
    avatar: SupabaseMember.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}`,
    avatarTransform: SupabaseMember.avatar_transform ? JSON.parse(SupabaseMember.avatar_transform) : undefined,
    phone: SupabaseMember.phone || '',
    email: SupabaseMember.email || '',
    department: SupabaseMember.department || '',
    role: 'Member', // Default role since it's not in the database
    status: SupabaseMember.status,
    dateAdded: SupabaseMember.joined_at || new Date().toISOString().split('T')[0],
    dob: SupabaseMember.dob || '',
    gender: SupabaseMember.gender,
    occupation: SupabaseMember.occupation,
    maritalStatus: SupabaseMember.marital_status,
    location: SupabaseMember.address,
    pin: SupabaseMember.pin || null,
    is_portal_active: SupabaseMember.is_portal_active || false,
    email_tier: SupabaseMember.email_tier || 'member',
    org_email: SupabaseMember.org_email || undefined,
  };
}

export function useMembers() {
  const { getToken } = useAuth();
  const { data, loading, error, fetchMore } = useQuery(GET_MEMBERS_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [exactTotal, setExactTotal] = useState<number | null>(null);
  const [totalCountLoading, setTotalCountLoading] = useState(false);

  const pageInfo = data?.membersCollection?.pageInfo;
  const hasNextPage = !!pageInfo?.hasNextPage;
  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || !pageInfo?.endCursor) return;
    await fetchMore({
      variables: {
        after: pageInfo.endCursor,
      },
    });
  }, [fetchMore, hasNextPage, pageInfo?.endCursor]);

  const [addMemberMutation] = useMutation(ADD_MEMBER_MUTATION, {
    refetchQueries: [{ query: GET_MEMBERS_QUERY }],
  });
  const [updateMemberMutation] = useMutation(UPDATE_MEMBER_MUTATION, {
    refetchQueries: [{ query: GET_MEMBERS_QUERY }],
  });
  const [deleteMemberMutation] = useMutation(DELETE_MEMBER_MUTATION, {
    refetchQueries: [{ query: GET_MEMBERS_QUERY }],
  });
  const [addAuditLogMutation] = useMutation(ADD_AUDIT_LOG_MUTATION);

  const members: Member[] = useMemo(() => {
    // Supabase pg_graphql wraps results in membersCollection.edges[].node
    const rows =
      data?.membersCollection?.edges?.map((e: { node: SupabaseMember }) => e.node) ??
      data?.members ?? // fallback for tests
      [];
    return rows.map(transformMember);
  }, [data]);

  // Since members are fetched in full (first: 10000), members.length IS the
  // exact total. We only hit the REST count endpoint as a fallback when the
  // GraphQL page looks truncated (>= page size), so no extra request is made
  // on every startup or after every mutation.
  const refreshTotalCount = useCallback(async () => {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (!anonKey || members.length < 10000) {
      setTotalCountLoading(false);
      return;
    }

    setTotalCountLoading(true);

    try {
      const token = await getToken({ template: 'supabase' });
      const response = await fetch(`${getSupabaseRestUrl()}/members?select=id&limit=1`, {
        method: 'HEAD',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token || anonKey}`,
          Prefer: 'count=exact',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch members count (${response.status})`);
      }

      setExactTotal(parseCountHeader(response.headers.get('content-range')));
    } catch (countError) {
      console.warn('Failed to fetch exact members count:', countError);
    } finally {
      setTotalCountLoading(false);
    }
  }, [getToken, members.length]);

  useEffect(() => {
    if (members.length >= 10000) void refreshTotalCount();
  }, [refreshTotalCount, members.length]);

  const addMember = async (member: Partial<Member>) => {
    try {
      // Check for duplicate member
      const isDuplicate = members.some((m) => {
        const nameMatches = m.name?.trim().toLowerCase() === member.name?.trim().toLowerCase();
        const phoneMatches = m.phone && member.phone && m.phone.trim() === member.phone.trim();
        const emailMatches =
          m.email && member.email && m.email.trim().toLowerCase() === member.email.trim().toLowerCase();

        return (nameMatches && phoneMatches) || (emailMatches && emailMatches === true); // email must be present and match
      });

      if (isDuplicate) {
        throw new Error(
          'A member with this name, phone, or email already exists. If they are pending registration, please go to Finances to pay their remaining balance.',
        );
      }

      const [firstName, ...lastNameParts] = (member.name || '').split(' ');
      const lastName = lastNameParts.join(' ');

      const memberData = {
        id: member.id || `HKM-${Date.now()}`,
        first_name: toTitleCase(firstName),
        last_name: toTitleCase(lastName),
        title: toTitleCase(member.title),
        email: formatEmail(member.email) || null,
        phone: member.phone || null,
        department: toTitleCase(member.department),
        status: member.status || 'Pending Fee',
        dob: member.dob || null, // empty string -> null (Postgres date rejects "")
        gender: member.gender || 'Male',
        avatar: member.avatar || null,
        avatar_transform: member.avatarTransform ? JSON.stringify(member.avatarTransform) : null,
        address: toTitleCase(member.location),
        occupation: toTitleCase(member.occupation) || null,
        marital_status: toTitleCase(member.maritalStatus) || null,
        joined_at: member.dateAdded || new Date().toISOString().split('T')[0],
        pin: null,
        is_portal_active: false,
        email_tier: member.email_tier || 'member',
        org_email: member.org_email || null,
      };

      await addMemberMutation({
        variables: {
          object: memberData,
        },
      });

      // Real-time subscription will update UI automatically
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    // Check for duplicate member
    const isDuplicate = members.some((m) => {
      if (m.id === id) return false;

      const currentMember = members.find((member) => member.id === id);
      const targetName = updates.name !== undefined ? updates.name : currentMember?.name;
      const targetPhone = updates.phone !== undefined ? updates.phone : currentMember?.phone;
      const targetEmail = updates.email !== undefined ? updates.email : currentMember?.email;

      const nameMatches = m.name?.trim().toLowerCase() === targetName?.trim().toLowerCase();
      const phoneMatches = m.phone && targetPhone && m.phone.trim() === targetPhone.trim();
      const emailMatches = m.email && targetEmail && m.email.trim().toLowerCase() === targetEmail.trim().toLowerCase();

      return (nameMatches && phoneMatches) || (emailMatches && emailMatches === true);
    });

    if (isDuplicate) {
      throw new Error('A member with this name, phone, or email already exists.');
    }

    const SupabaseUpdates: Record<string, unknown> = {};

    if (updates.name) {
      const [firstName, ...lastNameParts] = updates.name.split(' ');
      SupabaseUpdates.first_name = toTitleCase(firstName);
      SupabaseUpdates.last_name = toTitleCase(lastNameParts.join(' '));
    }

    if (updates.title !== undefined) SupabaseUpdates.title = toTitleCase(updates.title);
    if (updates.email !== undefined) SupabaseUpdates.email = formatEmail(updates.email) || null;
    if (updates.phone !== undefined) SupabaseUpdates.phone = updates.phone || null;
    if (updates.department !== undefined) SupabaseUpdates.department = toTitleCase(updates.department);
    if (updates.status !== undefined) {
      SupabaseUpdates.status = updates.status;
      if (updates.status === 'Inactive' || updates.status === 'Transferred') {
        SupabaseUpdates.pin = null;
        SupabaseUpdates.is_portal_active = false;
      }
    }
    if (updates.dob !== undefined) SupabaseUpdates.dob = updates.dob || null; // empty string -> null (Postgres date rejects "")
    if (updates.gender !== undefined) SupabaseUpdates.gender = updates.gender;
    if (updates.avatar !== undefined) SupabaseUpdates.avatar = updates.avatar || null;
    if (updates.avatarTransform !== undefined)
      SupabaseUpdates.avatar_transform = JSON.stringify(updates.avatarTransform);
    if (updates.location !== undefined) SupabaseUpdates.address = toTitleCase(updates.location);
    if (updates.occupation !== undefined) SupabaseUpdates.occupation = toTitleCase(updates.occupation) || null;
    if (updates.maritalStatus !== undefined)
      SupabaseUpdates.marital_status = toTitleCase(updates.maritalStatus) || null;
    if (updates.email_tier !== undefined) SupabaseUpdates.email_tier = updates.email_tier;
    if (updates.org_email !== undefined) SupabaseUpdates.org_email = updates.org_email || null;

    await updateMemberMutation({
      variables: {
        id,
        updates: SupabaseUpdates,
      },
    });

    // Handle ImprovMX alias updates and deletions
    const currentMember = members.find((member) => member.id === id);
    if (currentMember?.org_email && currentMember?.email_tier === 'member') {
      // If email changed, update forwarding destination
      if (updates.email !== undefined && updates.email !== currentMember.email) {
        if (updates.email) {
          updateAlias(currentMember.org_email, updates.email).catch((err) =>
            console.error('Failed to update alias:', err),
          );
        }
      }

      // If status changed to inactive/transferred, delete the alias
      if (updates.status !== undefined && updates.status !== currentMember.status) {
        if (updates.status === 'Inactive' || updates.status === 'Transferred') {
          deleteAlias(currentMember.org_email).catch((err) => console.error('Failed to delete alias:', err));
        }
      }
    }

    // Audit log for status changes
    if (updates.status !== undefined && currentMember && updates.status !== currentMember.status) {
      try {
        await addAuditLogMutation({
          variables: {
            object: {
              action: 'Member Status Changed',
              entity_type: 'member',
              entity_id: id,
              details: {
                from: currentMember.status,
                to: updates.status,
                changes: SupabaseUpdates,
              },
            },
          },
        });
      } catch (auditErr) {
        console.error('Failed to write audit log for status change:', auditErr);
      }
    }

    // Real-time subscription will update UI automatically
  };

  const deleteMember = async (id: string) => {
    const result = await deleteMemberMutation({
      variables: { id },
    });

    if (!result.data?.deleteFrommembersCollection?.records?.length) {
      throw new Error('Failed to delete member - no data returned');
    }
  };

  return {
    data: members,
    setData: (_newMembers: Member[]) => {
      console.warn('setData called on Supabase subscription - data is managed by GraphQL');
    },
    loading,
    error,
    totalCount: exactTotal ?? members.length,
    totalCountLoading,
    refreshTotalCount,
    hasNextPage,
    fetchNextPage,
    addMember,
    updateMember,
    deleteMember,
  };
}
