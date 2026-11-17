/**
 * BMI UMS — Alumni & Campus Services Mutation Hooks
 */

import { useQuery, useMutation, useQueryClient } from '../../shims/tanstack-react-query';
import { apiClient } from './apiClient';
import { QUERY_KEYS } from './queryKeys';

// ── Alumni Types ──────────────────────────────────────────────────────────────

export interface AlumniProfile {
  id: number;
  name: string;
  email: string;
  graduationYear: number;
  program: string;
  currentEmployer?: string;
  currentRole?: string;
}

export interface AlumniEvent {
  id: number;
  title: string;
  date: string;
  location: string;
  description?: string;
  attendees: number;
}

export interface Donation {
  id: number;
  alumniId: number;
  alumniName: string;
  amount: number;
  purpose: string;
  date: string;
  status: 'received' | 'pending';
}

// ── Campus Types ──────────────────────────────────────────────────────────────

export interface TransportRoute {
  id: number;
  name: string;
  origin: string;
  destination: string;
  departureTime: string;
  capacity: number;
  status: 'active' | 'inactive';
}

export interface TransportPass {
  id: number;
  studentId: string;
  studentName: string;
  routeId: number;
  routeName: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired';
}

// ── Alumni Queries ────────────────────────────────────────────────────────────

export function useAlumniProfilesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.alumni.profiles(),
    queryFn: () => apiClient.get<AlumniProfile[]>('/api/v1/alumni/profiles'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useAlumniEventsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.alumni.events(),
    queryFn: () => apiClient.get<AlumniEvent[]>('/api/v1/alumni/events'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useDonationsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.alumni.donations(),
    queryFn: () => apiClient.get<Donation[]>('/api/v1/alumni/donations'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Campus Queries ────────────────────────────────────────────────────────────

export function useTransportRoutesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.campus.transportRoutes(),
    queryFn: () => apiClient.get<TransportRoute[]>('/api/v1/campus/transport'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useTransportPassesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.campus.transportPasses(),
    queryFn: () => apiClient.get<TransportPass[]>('/api/v1/campus/transport/passes'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Alumni Mutations ──────────────────────────────────────────────────────────

export function useAddAlumniEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AlumniEvent, 'id' | 'attendees'>) =>
      apiClient.post<AlumniEvent>('/api/v1/alumni/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.alumni.events() });
    },
  });
}

export function useRecordDonationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Donation, 'id'>) =>
      apiClient.post<Donation>('/api/v1/alumni/donations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.alumni.donations() });
    },
  });
}
