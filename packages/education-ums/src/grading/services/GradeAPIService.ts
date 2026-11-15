/**
 * BMI UMS - Grade API Service
 * Main API service for grade operations
 */

import { authFetch } from '../../services/authService';
import { API_URL } from '../../services/config';
import {
  Grade,
  APIResponse,
  PaginatedResponse,
  GradeFilters,
} from '../types';

/**
 * Create a new grade
 */
export async function createGrade(
  gradeData: Omit<Grade, 'id' | 'createdAt' | 'updatedAt'>
): Promise<APIResponse<Grade>> {
  try {
    const response = await authFetch(`${API_URL}/grades`, {
      method: 'POST',
      body: JSON.stringify(gradeData),
    }, 10000);

    if (!response.ok) {
      // Try to get an error message from the response body
      let serverError = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        serverError = body?.error ?? body?.message ?? serverError;
      } catch {
        // ignore JSON parse error — keep HTTP status message
      }
      return { success: false, error: serverError };
    }

    const data: APIResponse<Grade> = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create grade',
    };
  }
}

/**
 * Update an existing grade
 */
export async function updateGrade(
  id: string,
  gradeData: Partial<Grade>
): Promise<APIResponse<Grade>> {
  try {
    const response = await authFetch(`${API_URL}/grades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(gradeData),
    }, 10000);

    const data: APIResponse<Grade> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update grade',
     };
  }
}

/**
 * Get all grades with filters
 */
export async function getGrades(
  filters?: GradeFilters
): Promise<PaginatedResponse<Grade>> {
  try {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.perPage) params.append('perPage', filters.perPage.toString());
    if (filters?.studentId) params.append('studentId', filters.studentId);
    if (filters?.courseCode) params.append('courseCode', filters.courseCode);
    if (filters?.academicYear) params.append('academicYear', filters.academicYear);
    if (filters?.semester) params.append('semester', filters.semester);

    const queryString = params.toString();
    const url = `${API_URL}/grades${queryString ? `?${queryString}` : ''}`;

    const response = await authFetch(url, {}, 8000);
    const data: PaginatedResponse<Grade> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch grades',
     };
  }
}

/**
 * Get a single grade by ID
 */
export async function getGrade(id: string): Promise<APIResponse<Grade>> {
  try {
    const response = await authFetch(`${API_URL}/grades/${id}`, {}, 5000);
    const data: APIResponse<Grade> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch grade',
     };
  }
}

/**
 * Delete a grade
 */
export async function deleteGrade(id: string): Promise<APIResponse<void>> {
  try {
    const response = await authFetch(`${API_URL}/grades/${id}`, {
      method: 'DELETE',
    }, 5000);

    const data: APIResponse<void> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete grade',
     };
  }
}

/**
 * Get grades for a specific student
 */
export async function getStudentGrades(studentId: string): Promise<PaginatedResponse<Grade>> {
  return getGrades({ studentId, perPage: 100 });
}

/**
 * Get grades for a specific course
 */
export async function getCourseGrades(courseCode: string): Promise<PaginatedResponse<Grade>> {
  return getGrades({ courseCode, perPage: 100 });
}

/**
 * Submit a grade appeal
 */
export async function submitGradeAppeal(appealData: {
  gradeId: string;
  reason: string;
  explanation: string;
}): Promise<APIResponse<unknown>> {
  try {
    const response = await authFetch(`${API_URL}/grade-appeals`, {
      method: 'POST',
      body: JSON.stringify(appealData),
    }, 10000);

    const data: APIResponse<unknown> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit appeal',
     };
  }
}

/**
 * Approve a grade appeal
 */
export async function approveGradeAppeal(
  appealId: string,
  revisedGrade: string,
  notes: string
): Promise<APIResponse<unknown>> {
  try {
    const response = await authFetch(`${API_URL}/grade-appeals/${appealId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ revisedGrade, notes }),
    }, 10000);

    const data: APIResponse<unknown> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve appeal',
     };
  }
}

/**
 * Deny a grade appeal
 */
export async function denyGradeAppeal(
  appealId: string,
  notes: string
): Promise<APIResponse<unknown>> {
  try {
    const response = await authFetch(`${API_URL}/grade-appeals/${appealId}/deny`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }, 10000);

    const data: APIResponse<unknown> = await response.json();
    return data;
  } catch (error) { return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deny appeal',
     };
  }
}


