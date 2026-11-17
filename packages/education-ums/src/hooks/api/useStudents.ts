/**
 * BMI UMS — Student & Application Mutation Hooks
 */

import { useMutation, useQueryClient } from '../../shims/tanstack-react-query';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch<unknown>(`/api/v1/students/${id}`, data),
    onSuccess: (_updated, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students.all() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students.detail(vars.id) });
    },
  });
}

export function useToggleStudentHoldMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, holdType, value }: { id: string; holdType: 'financial' | 'academic'; value: boolean }) =>
      apiClient.patch<unknown>(`/api/v1/students/${id}/hold`, { holdType, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students.all() });
    },
  });
}

export function useUpdateApplicationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch<unknown>(`/api/v1/applications/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications.all() });
    },
  });
}

export function useConvertApplicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) =>
      apiClient.post<unknown>(`/api/v1/applications/${applicationId}/convert`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications.all() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students.all() });
    },
  });
}

// ── Finance Mutations ─────────────────────────────────────────────────────────

export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { studentId: string; amount: number; description: string; dueDate: string }) =>
      apiClient.post<unknown>('/api/v1/finance/invoices', data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices.all() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices.byStudent(vars.studentId) });
    },
  });
}

export function useProcessPaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
      apiClient.patch<unknown>(`/api/v1/finance/invoices/${invoiceId}/pay`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices.all() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions.all() });
    },
  });
}
