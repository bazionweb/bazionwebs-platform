import { authFetch } from './authService';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

export interface Term {
  id: string;
  name: string;
  code: string;
  academic_year: string;
  semester_number: number;
  start_date: string;
  end_date: string;
  status: string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  census_date?: string | null;
}

export async function getTerms() {
  const res = await authFetch(`${API_URL}/terms`);
  return parseJsonSafe<{ success: boolean; data: Term[] }>(res);
}

export async function createTerm(data: Partial<Term>) {
  const res = await authFetch(`${API_URL}/terms`, { method: 'POST', body: JSON.stringify(data) });
  return parseJsonSafe<{ success: boolean; data: Term }>(res);
}

export async function updateTerm(id: string, data: Partial<Term>) {
  const res = await authFetch(`${API_URL}/terms/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return parseJsonSafe<{ success: boolean; data: Term }>(res);
}

export async function closeTerm(id: string) {
  const res = await authFetch(`${API_URL}/admin/terms/${id}/close`, { method: 'POST', body: JSON.stringify({}) });
  return parseJsonSafe<{ success: boolean; data: unknown }>(res);
}
