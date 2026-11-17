/**
 * BMI UMS - Program & Enrollment Service
 */

import { authFetch } from './authService';
import { Program, Faculty, Department, AcademicTerm, Enrollment, ApiResponse } from '../types';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

// ── Programs ──────────────────────────────────────────────────────────────────

export async function getPrograms(filters?: {
  level?: string;
  department_id?: string;
  is_active?: boolean;
}): Promise<ApiResponse<Program[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.level) params.append('level', filters.level);
    if (filters?.department_id) params.append('department_id', filters.department_id);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());

    const queryString = params.toString();
    const url = `${API_URL}/programs${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url);
    const status = response.status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = await parseJsonSafe<any>(response);
    if (data?.success) {
      if (data.data && !Array.isArray(data.data) && Array.isArray(data.data.items)) {
        data.data = data.data.items;
      } else if (!Array.isArray(data.data)) {
        data.data = [];
      }
    }
    if (data && typeof data === 'object' && (data as { status?: number }).status === undefined) {
      (data as { status?: number }).status = status;
    }
    return data ?? { success: false, data: [], status, error: { code: 'PARSE_ERROR', message: 'Failed to parse programs response' } };
  } catch { return { success: false, data: [], status: 0, error: { code: 'FETCH_ERROR', message: 'Failed to fetch programs'  } };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProgramById(id: string): Promise<ApiResponse<Program & { courses: any[] }>> {
  try {
    const response = await authFetch(`${API_URL}/programs/${id}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await parseJsonSafe<ApiResponse<Program & { courses: any[] }>>(response);
    return data ?? { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'PARSE_ERROR', message: 'Failed to parse program detail response' } };
  } catch { return { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'FETCH_ERROR', message: 'Failed to fetch program details'  } };
  }
}

export async function createProgram(data: Partial<Program>): Promise<ApiResponse<Program>> {
  try {
    const response = await authFetch(`${API_URL}/programs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<ApiResponse<Program>>(response);
    return result ?? { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'PARSE_ERROR', message: 'Failed to parse create program response' } };
  } catch { return { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'FETCH_ERROR', message: 'Failed to create program'  } };
  }
}

export async function updateProgram(id: string, data: Partial<Program>): Promise<ApiResponse<Program>> {
  try {
    const response = await authFetch(`${API_URL}/programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<ApiResponse<Program>>(response);
    return result ?? { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'PARSE_ERROR', message: 'Failed to parse update program response' } };
  } catch { return { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'FETCH_ERROR', message: 'Failed to update program'  } };
  }
}

export async function deleteProgram(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const response = await authFetch(`${API_URL}/programs/${id}`, { method: 'DELETE' });
    const result = await parseJsonSafe<ApiResponse<{ deleted: boolean }>>(response);
    return result ?? { success: false, data: { deleted: false } };
  } catch { return { success: false, data: { deleted: false } }; }
}

// ── Catalog (Faculties & Departments) ─────────────────────────────────────────

export async function getFaculties(): Promise<ApiResponse<Faculty[]>> {
  try {
    const response = await authFetch(`${API_URL}/catalog/faculties`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = await parseJsonSafe<any>(response);
    if (data?.success && !Array.isArray(data.data)) {
      data.data = [];
    }
    return data ?? { success: false, data: [] };
  } catch { return { success: false, data: [] };
  }
}

export async function getDepartments(facultyId?: string): Promise<ApiResponse<Department[]>> {
  try {
    const params = new URLSearchParams();
    if (facultyId) params.append('faculty_id', facultyId);
    
    const queryString = params.toString();
    const url = `${API_URL}/catalog/departments${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = await parseJsonSafe<any>(response);
    if (data?.success && !Array.isArray(data.data)) {
      data.data = [];
    }
    return data ?? { success: false, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}

export async function getAcademicTerms(): Promise<ApiResponse<AcademicTerm[]>> {
  try {
    const response = await authFetch(`${API_URL}/catalog/terms`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = await parseJsonSafe<any>(response);
    if (data?.success && !Array.isArray(data.data)) {
      data.data = [];
    }
    return data ?? { success: false, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}

// ── Enrollments ──────────────────────────────────────────────────────────────

export async function getEnrollments(filters?: {
  student_id?: string;
  course_id?: string;
  term_id?: string;
}): Promise<ApiResponse<Enrollment[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.student_id) params.append('student_id', filters.student_id);
    if (filters?.course_id) params.append('course_id', filters.course_id);
    if (filters?.term_id) params.append('term_id', filters.term_id);

    const queryString = params.toString();
    const url = `${API_URL}/enrollments${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url);
    const data = await parseJsonSafe<ApiResponse<Enrollment[]>>(response);
    return data ?? { success: false, data: [] };
  } catch {
    return { success: false, data: [] };
  }
}

export async function createEnrollment(data: {
  student_id: string;
  course_id: string;
  program_id: string;
  term_id: string;
  academic_year?: string;
  semester_number?: number;
  status?: string;
}): Promise<ApiResponse<Enrollment>> {
  try {
    const response = await authFetch(`${API_URL}/enrollments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<ApiResponse<Enrollment>>(response);
    return result ?? { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'PARSE_ERROR', message: 'Failed to parse enrollment response'  } };
  } catch { return { success: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any, error: { code: 'FETCH_ERROR', message: 'Failed to create enrollment'  } };
  }
}

export async function dropEnrollment(id: string): Promise<ApiResponse<Enrollment>> {
  try {
    const response = await authFetch(`${API_URL}/enrollments/${id}/drop`, {
      method: 'PATCH',
    });
    const result = await parseJsonSafe<ApiResponse<Enrollment>>(response);
    return result ?? { success: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any };
  } catch {
    return { success: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any };
  }
}










