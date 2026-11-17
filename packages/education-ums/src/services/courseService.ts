/**
 * BMI UMS - Course Service
 */

import { authFetch } from './authService';
import { Course } from '../types';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';
import type { PaginatedData } from '../services/contracts-bridge';

export interface CourseResponse {
  success: boolean;
  data?: Course;
  error?: string;
}

export interface CourseListResponse {
  success: boolean;
  data?: PaginatedData<Course>;
  error?: string;
  /** HTTP status of the underlying request (0 = network failure). Surfaced so
   *  UI can distinguish expired sessions (401) from server outages. */
  status?: number;
}

export async function getCourses(filters?: {
  page?: number;
  perPage?: number;
  search?: string;
  campusId?: string;
  status?: string;
  moduleId?: string;
}): Promise<CourseListResponse> {
  try {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.perPage) params.append('perPage', filters.perPage.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.campusId) params.append('study_center_id', filters.campusId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.moduleId) params.append('module_id', filters.moduleId);

    const queryString = params.toString();
    const url = `${API_URL}/courses${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url);
    const status = response.status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = await parseJsonSafe<any>(response);
    if (data?.success) {
      if (!data.data) {
        data.data = { items: [], page: 1, perPage: 20, total: 0 };
      } else if (Array.isArray(data.data)) {
        data.data = { items: data.data, page: 1, perPage: data.data.length, total: data.data.length };
      } else if (!data.data.items) {
        data.data.items = [];
      }

      if (Array.isArray(data.data.items)) {
        data.data.items = data.data.items.map((item: any) => {
          const rawLvl = String(item.level || '');
          const lvlNum = parseInt(rawLvl, 10);
          let displayLevel = item.level || 'Undergraduate';
          if (!isNaN(lvlNum)) {
            if (lvlNum >= 800) displayLevel = 'PhD';
            else if (lvlNum >= 500) displayLevel = 'Masters';
            else if (lvlNum >= 100) displayLevel = 'Undergraduate';
          }
          return {
            ...item,
            title: item.title || item.name || '',
            credit_hours: item.credit_hours ?? item.credits ?? 3,
            credits: item.credits ?? item.credit_hours ?? 3,
            department: item.department || item.department_name || '',
            status: item.status || (item.is_active === 0 ? 'Draft' : 'Published'),
            level: displayLevel,
          };
        });
      }
    }
    if (data && typeof data === 'object' && (data as { status?: number }).status === undefined) {
      (data as { status?: number }).status = status;
    }
    return data ?? { success: false, status, error: 'Failed to parse courses response' };
  } catch { return { success: false, status: 0, error: 'Failed to fetch courses'  };
  }
}

export async function createCourse(data: Partial<Course>): Promise<CourseResponse> {
  try {
    const response = await authFetch(`${API_URL}/courses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<CourseResponse>(response);
    return result ?? { success: false, error: 'Failed to parse create course response' };
  } catch { return { success: false, error: 'Failed to create course'  };
  }
}

export async function updateCourse(id: string, data: Partial<Course>): Promise<CourseResponse> {
  try {
    const response = await authFetch(`${API_URL}/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<CourseResponse>(response);
    return result ?? { success: false, error: 'Failed to parse update course response' };
  } catch { return { success: false, error: 'Failed to update course'  };
  }
}

export async function deleteCourse(id: string): Promise<CourseResponse> {
  try {
    const response = await authFetch(`${API_URL}/courses/${id}`, { method: 'DELETE' });
    const result = await parseJsonSafe<CourseResponse>(response);
    return result ?? { success: false, error: 'Failed to parse delete course response' };
  } catch { return { success: false, error: 'Failed to delete course'  };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCourseStats(): Promise<any> {
  try {
    const response = await authFetch(`${API_URL}/courses/stats/overview`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await parseJsonSafe<any>(response);
    return data ?? { success: false, error: 'Failed to parse course statistics response' };
  } catch { return { success: false, error: 'Failed to fetch course statistics'  };
  }
}









