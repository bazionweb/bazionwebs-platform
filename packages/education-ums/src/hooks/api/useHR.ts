/**
 * BMI UMS — HR / Staff Mutation Hooks
 * Implements the admin-dashboard pattern: useQuery reads + useMutation writes
 * that auto-invalidate the cache so all components stay in sync.
 */

import { useQuery, useMutation, useQueryClient } from '../../shims/tanstack-react-query';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: number;
  staffId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PayrollRecord {
  id: number;
  staffId: number;
  amount: number;
  period: string;
  status: 'processed' | 'pending';
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useLeaveRequestsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.staff.leaveRequests(),
    queryFn: () => apiClient.get<LeaveRequest[]>('/api/v1/hr/leave-requests'),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function usePayrollQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.staff.payroll(),
    queryFn: () => apiClient.get<PayrollRecord[]>('/api/v1/hr/payroll'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      apiClient.patch<LeaveRequest>(`/api/v1/hr/leave-requests/${id}`, { status }),
    onSuccess: () => {
      // Invalidate so all components reading leave-requests refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staff.leaveRequests() });
    },
  });
}

export function useAddStaffMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post<unknown>('/api/v1/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staff.all() });
    },
  });
}

export function useUpdateStaffMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch<unknown>(`/api/v1/staff/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staff.all() });
    },
  });
}
