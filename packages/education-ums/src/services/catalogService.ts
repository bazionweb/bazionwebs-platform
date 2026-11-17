import { authFetch } from './authService';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

export interface CatalogRow {
  id: string;
  name?: string;
  faculty_code?: string;
  dept_code?: string;
  program_code?: string;
  degree_level?: string;
  [key: string]: unknown;
}

type CatalogResponse = { success: boolean; data?: CatalogRow[]; error?: string };

export async function getFaculties() {
  const res = await authFetch(`${API_URL}/catalog/faculties`);
  const data = await parseJsonSafe<CatalogResponse>(res);
  return data ?? { success: false, error: 'Failed to parse faculties response' };
}

export async function getDepartments(facultyId?: string) {
  const q = facultyId ? `?facultyId=${encodeURIComponent(facultyId)}` : '';
  const res = await authFetch(`${API_URL}/catalog/departments${q}`);
  const data = await parseJsonSafe<CatalogResponse>(res);
  return data ?? { success: false, error: 'Failed to parse departments response' };
}

export async function getPrograms(deptId?: string) {
  const q = deptId ? `?deptId=${encodeURIComponent(deptId)}` : '';
  const res = await authFetch(`${API_URL}/catalog/programs${q}`);
  const data = await parseJsonSafe<CatalogResponse>(res);
  return data ?? { success: false, error: 'Failed to parse programs response' };
}









