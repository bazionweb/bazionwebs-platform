/**
 * BMI UMS - Staff Service
 */

import { authFetch } from './authService';
import { StaffMember } from '../types';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';
import type { PaginatedData } from '../services/contracts-bridge';

export interface StaffResponse {
  success: boolean;
  data?: StaffMember;
  error?: string;
}

export interface StaffListResponse {
  success: boolean;
  data?: PaginatedData<StaffMember>;
  error?: string;
}

export async function getStaff(filters?: {
  page?: number;
  perPage?: number;
  department?: string;
  search?: string;
  campusId?: string;
  category?: string;
}): Promise<StaffListResponse> {
  try {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.perPage) params.append('perPage', filters.perPage.toString());
    if (filters?.department) params.append('department', filters.department);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.campusId) params.append('study_center_id', filters.campusId);
    if (filters?.category) params.append('category', filters.category);

    const queryString = params.toString();
    const url = `${API_URL}/staff${queryString ? `?${queryString}` : ''}`;
    const response = await authFetch(url);
    const data = await parseJsonSafe<StaffListResponse>(response);
    return data ?? { success: false, error: 'Failed to parse staff response' };
  } catch { return { success: false, error: 'Failed to fetch staff'  };
  }
}

export async function createStaff(data: Partial<StaffMember>): Promise<StaffResponse> {
  try {
    const response = await authFetch(`${API_URL}/staff`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<StaffResponse>(response);
    return result ?? { success: false, error: 'Failed to parse create staff response' };
  } catch { return { success: false, error: 'Failed to create staff'  };
  }
}

export async function updateStaff(id: string, data: Partial<StaffMember>): Promise<StaffResponse> {
  try {
    const response = await authFetch(`${API_URL}/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const result = await parseJsonSafe<StaffResponse>(response);
    return result ?? { success: false, error: 'Failed to parse update staff response' };
  } catch { return { success: false, error: 'Failed to update staff'  };
  }
}

export async function deleteStaff(id: string): Promise<StaffResponse> {
  try {
    const response = await authFetch(`${API_URL}/staff/${id}`, { method: 'DELETE' });
    const result = await parseJsonSafe<StaffResponse>(response);
    return result ?? { success: false, error: 'Failed to parse delete staff response' };
  } catch { return { success: false, error: 'Failed to delete staff'  };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getStaffStats(): Promise<any> {
  try {
    const response = await authFetch(`${API_URL}/staff/stats/overview`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await parseJsonSafe<any>(response);
    return data ?? { success: false, error: 'Failed to parse staff statistics response' };
  } catch { return { success: false, error: 'Failed to fetch staff statistics'  };
  }
}










