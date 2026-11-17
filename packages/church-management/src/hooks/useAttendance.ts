import { useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { AttendanceRecord, AttendanceStatus } from '../components/attendanceData';
import {
  GET_ATTENDANCE_QUERY,
  ADD_ATTENDANCE_MUTATION,
  DELETE_ATTENDANCE_MUTATION,
  DELETE_ATTENDANCE_BY_SERVICE_MUTATION,
} from '../services/graphql/attendance';
import { Member } from '../components/memberData';

export function useAttendance(members: Member[] = []) {
  const { data, loading, error, fetchMore } = useQuery(GET_ATTENDANCE_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });

  const pageInfo = data?.attendance_recordsCollection?.pageInfo;
  const hasNextPage = !!pageInfo?.hasNextPage;
  const fetchNextPage = async () => {
    if (!hasNextPage || !pageInfo?.endCursor) return;
    await fetchMore({
      variables: {
        after: pageInfo.endCursor,
      },
    });
  };

  const [addAttendanceMutation] = useMutation(ADD_ATTENDANCE_MUTATION, {
    refetchQueries: [{ query: GET_ATTENDANCE_QUERY }],
  });
  const [deleteAttendanceMutation] = useMutation(DELETE_ATTENDANCE_MUTATION, {
    refetchQueries: [{ query: GET_ATTENDANCE_QUERY }],
  });
  const [deleteByServiceMutation] = useMutation(DELETE_ATTENDANCE_BY_SERVICE_MUTATION, {
    refetchQueries: [{ query: GET_ATTENDANCE_QUERY }],
  });

  const attendanceRecords: AttendanceRecord[] = useMemo(() => {
    const edges = data?.attendance_recordsCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (edge: {
        node: {
          id: number;
          date: string;
          service: string;
          member?: { first_name?: string; last_name?: string } | null;
          members?: { first_name?: string; last_name?: string } | null;
          status: string;
        };
      }) => {
        const record = edge.node;
        const member = record.member || record.members;
        return {
          id: record.id,
          date: record.date,
          service: record.service,
          memberName: `${member?.first_name || ''} ${member?.last_name || ''}`.trim() || 'Unknown Member',
          status: record.status as AttendanceStatus,
        };
      },
    );
  }, [data]);

  const batchSaveAttendance = async (
    newAttendance: Record<string, AttendanceStatus>,
    serviceName: string,
    serviceDate: string,
  ) => {
    try {
      // 1. First, delete existing records for this service and date (idempotency)
      await deleteByServiceMutation({
        variables: {
          date: serviceDate,
          service: serviceName,
        },
      });

      // 2. Prepare new records
      // The key can be member.id, member.email, or a generated key from name
      const objects = Object.entries(newAttendance)
        .map(([memberKey, status]) => {
          // Try to find member by id first, then email, then by matching name-based key
          let member = members.find((m) => m.id === memberKey);
          if (!member) {
            member = members.find((m) => m.email === memberKey);
          }
          if (!member) {
            // Try to match by name-based key (name.toLowerCase().replace(/\s+/g, '_'))
            member = members.find((m) => {
              const nameKey = m.name.toLowerCase().replace(/\s+/g, '_');
              return nameKey === memberKey;
            });
          }
          if (!member) {
            console.warn(`Member with key ${memberKey} not found during attendance save.`);
          }
          return {
            date: serviceDate,
            service: serviceName,
            member_id: member?.id || 'unknown',
            status: status,
          };
        })
        .filter((obj) => obj.member_id !== 'unknown');

      if (objects.length > 0) {
        // 3. Insert new records
        await addAttendanceMutation({
          variables: { objects },
        });
      }

      // Real-time subscription will update UI automatically
    } catch (err) {
      console.error('Error saving attendance:', err);
      throw err;
    }
  };

  const deleteAttendanceRecord = async (id: number) => {
    await deleteAttendanceMutation({
      variables: { id },
    });

    // Real-time subscription will update UI automatically
  };

  return {
    data: attendanceRecords,
    loading,
    error,
    hasNextPage,
    fetchNextPage,
    batchSaveAttendance,
    deleteAttendanceRecord,
  };
}
