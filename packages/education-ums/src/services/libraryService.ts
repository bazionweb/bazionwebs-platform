import { authFetch } from './authService';
import { LibraryItem } from '../types';

import { API_URL } from './config';

export interface LibraryListResponse {
  success: boolean;
  data?: LibraryItem[];
  meta?: { page: number; perPage: number; total: number };
  error?: string;
}

export async function getLibraryItems(filters?: { page?: number; perPage?: number; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.perPage) params.append('perPage', String(filters.perPage));
  if (filters?.search) params.append('search', filters.search);
  const q = params.toString();
  const res = await authFetch(`${API_URL}/library${q ? `?${q}` : ''}`);
  return (await res.json()) as LibraryListResponse;
}

export async function createLibraryItem(data: Partial<LibraryItem>) {
  const res = await authFetch(`${API_URL}/library`, { method: 'POST', body: JSON.stringify(data) });
  return (await res.json()) as { success: boolean; data?: LibraryItem; error?: string };
}

export async function updateLibraryItem(id: string, data: Partial<LibraryItem>) {
  const res = await authFetch(`${API_URL}/library/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return (await res.json()) as { success: boolean; data?: LibraryItem; error?: string };
}

export async function deleteLibraryItem(id: string) {
  const res = await authFetch(`${API_URL}/library/${id}`, { method: 'DELETE' });
  return (await res.json()) as { success: boolean; error?: string };
}









