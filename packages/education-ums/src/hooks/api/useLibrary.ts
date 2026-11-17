/**
 * BMI UMS — Library Mutation Hooks
 * Implements the admin-dashboard pattern with real API-backed mutations.
 */

import { useQuery, useMutation, useQueryClient } from '../../shims/tanstack-react-query';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LibraryBook {
  id: number;
  isbn: string;
  title: string;
  author: string;
  copiesTotal: number;
  copiesAvailable: number;
  category?: string;
}

export interface LibraryBorrowing {
  id: number;
  bookId: number;
  studentId: string;
  studentName: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string | null;
  status: 'active' | 'returned' | 'overdue';
}

export interface LibraryFine {
  id: number;
  borrowingId: number;
  studentId: string;
  studentName: string;
  amount: number;
  reason: string;
  paid: boolean;
  createdAt: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useLibraryBooksQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.library.books(),
    queryFn: () => apiClient.get<LibraryBook[]>('/api/v1/library'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useLibraryBorrowingsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.library.borrowings(),
    queryFn: () => apiClient.get<LibraryBorrowing[]>('/api/v1/library/borrowing'),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useLibraryFinesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.library.fines(),
    queryFn: () => apiClient.get<LibraryFine[]>('/api/v1/library/fines'),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useReturnBookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (borrowingId: number) =>
      apiClient.patch<LibraryBorrowing>(`/api/v1/library/borrowing/${borrowingId}/return`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.borrowings() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.books() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.fines() });
    },
  });
}

export function useMarkFinePaidMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fineId: number) =>
      apiClient.patch<LibraryFine>(`/api/v1/library/fines/${fineId}/pay`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.fines() });
    },
  });
}

export function useAddBookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<LibraryBook, 'id'>) =>
      apiClient.post<LibraryBook>('/api/v1/library', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.books() });
    },
  });
}

export function useUpdateBookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: Partial<LibraryBook> }) =>
      apiClient.patch<LibraryBook>(`/api/v1/library/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.books() });
    },
  });
}

export function useDeleteBookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => apiClient.delete(`/api/v1/library/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.books() });
    },
  });
}

export function useCheckoutBookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { bookId: number; studentId: string; studentName: string }) =>
      apiClient.post<LibraryBorrowing>('/api/v1/library/borrowing', data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.borrowings() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.books() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.library.byStudent(vars.studentId) });
    },
  });
}
