// Study Center Service
import { authFetch } from './authService';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

export interface StudyCenter {
  id: string;
  name: string;
  code: string;
  location: string;
  status: 'active' | 'inactive';
  created: string;
  updated: string;
}

export interface StudyCenterStats {
  studyCenter: StudyCenter;
  students: number;
  staff: number;
  courses: number;
}

interface StudyCenterResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    perPage: number;
    total: number;
  };
}

/**
 * Get all active study centers (for dropdowns)
 */
export async function getAllStudyCenters(): Promise<StudyCenter[]> {
  const response = await authFetch(`${API_URL}/study-centers/all`);
  const data = await parseJsonSafe<StudyCenterResponse<StudyCenter[]>>(response);
  return data?.success && data.data ? data.data : [];
}

/**
 * Get paginated list of study centers
 */
export async function getStudyCenters(params?: {
  page?: number;
  perPage?: number;
  status?: 'active' | 'inactive';
  search?: string;
}): Promise<{ data: StudyCenter[]; meta: { page: number; perPage: number; total: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.perPage) query.append('perPage', params.perPage.toString());
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);

  const response = await authFetch(`${API_URL}/study-centers${query.toString() ? `?${query.toString()}` : ''}`);
  const data = await parseJsonSafe<StudyCenterResponse<StudyCenter[]>>(response);
  
  return {
    data: data?.data || [],
    meta: data?.meta || { page: 1, perPage: 10, total: 0 },
  };
}

/**
 * Get a single study center by ID
 */
export async function getStudyCenter(id: string): Promise<StudyCenter | null> {
  const response = await authFetch(`${API_URL}/study-centers/${id}`);
  const data = await parseJsonSafe<StudyCenterResponse<StudyCenter>>(response);
  return data?.success ? data.data : null;
}

/**
 * Get study center statistics
 */
export async function getStudyCenterStats(id: string): Promise<StudyCenterStats | null> {
  const response = await authFetch(`${API_URL}/study-centers/${id}/stats`);
  const data = await parseJsonSafe<StudyCenterResponse<StudyCenterStats>>(response);
  return data?.success ? data.data : null;
}

/**
 * Get students by study center
 */
export async function getStudyCenterStudents(
  id: string,
  params?: { page?: number; perPage?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; meta: { page: number; perPage: number; total: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.perPage) query.append('perPage', params.perPage.toString());

  const response = await authFetch(`${API_URL}/study-centers/${id}/students${query.toString() ? `?${query.toString()}` : ''}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseJsonSafe<StudyCenterResponse<any[]>>(response);
  
  return {
    data: data?.data || [],
    meta: data?.meta || { page: 1, perPage: 10, total: 0 },
  };
}

/**
 * Get staff by study center
 */
export async function getStudyCenterStaff(
  id: string,
  params?: { page?: number; perPage?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; meta: { page: number; perPage: number; total: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.perPage) query.append('perPage', params.perPage.toString());

  const response = await authFetch(`${API_URL}/study-centers/${id}/staff${query.toString() ? `?${query.toString()}` : ''}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseJsonSafe<StudyCenterResponse<any[]>>(response);
  
  return {
    data: data?.data || [],
    meta: data?.meta || { page: 1, perPage: 10, total: 0 },
  };
}

/**
 * Get courses by study center
 */
export async function getStudyCenterCourses(
  id: string,
  params?: { page?: number; perPage?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; meta: { page: number; perPage: number; total: number } }> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.perPage) query.append('perPage', params.perPage.toString());

  const response = await authFetch(`${API_URL}/study-centers/${id}/courses${query.toString() ? `?${query.toString()}` : ''}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await parseJsonSafe<StudyCenterResponse<any[]>>(response);
  
  return {
    data: data?.data || [],
    meta: data?.meta || { page: 1, perPage: 10, total: 0 },
  };
}

/**
 * Create a new study center (admin only)
 */
export async function createStudyCenter(data: {
  name: string;
  code: string;
  location: string;
  status?: 'active' | 'inactive';
}): Promise<StudyCenter | null> {
  const response = await authFetch(`${API_URL}/study-centers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const resData = await parseJsonSafe<StudyCenterResponse<StudyCenter>>(response);
  return resData?.success ? resData.data : null;
}

/**
 * Update a study center (admin only)
 */
export async function updateStudyCenter(
  id: string,
  data: Partial<{
    name: string;
    code: string;
    location: string;
    status: 'active' | 'inactive';
  }>
): Promise<StudyCenter | null> {
  const response = await authFetch(`${API_URL}/study-centers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  const resData = await parseJsonSafe<StudyCenterResponse<StudyCenter>>(response);
  return resData?.success ? resData.data : null;
}

/**
 * Delete a study center (admin only)
 */
export async function deleteStudyCenter(id: string): Promise<boolean> {
  const response = await authFetch(`${API_URL}/study-centers/${id}`, {
    method: 'DELETE',
  });
  return response.ok;
}










