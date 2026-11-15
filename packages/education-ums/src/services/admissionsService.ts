/**
 * BMI UMS - Admissions Service
 * Handles application lifecycle management for admins
 */

import { authFetch } from './authService';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

export interface AppDocument {
  id: string;
  doc_type: string;
  file_name: string;
  uploaded_at: string;
}

export interface Application {
  id: string;
  applicant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  program: string;
  degree_level: string;
  status: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // Personal Info
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  // Academic History
  high_school?: string;
  graduation_year?: number;
  gpa?: number;
  documents?: AppDocument[];
}

export interface StatusLogEntry {
  id: string;
  application_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
  changed_by_name: string;
  notes?: string;
  changed_at: string;
}

export const admissionsService = {
  /**
   * Get all applications with optional filtering
   */
  async listApplications(params?: { status?: string; limit?: number; offset?: number }) {
    const stringParams = Object.entries(params || {}).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>);
    const qs = params && Object.keys(stringParams).length > 0 ? '?' + new URLSearchParams(stringParams).toString() : '';
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/applications${qs}`);
    if (!response.ok) {
      throw new Error('Failed to load applications');
    }
    const result = await response.json() as { success: boolean; data: Application[] };
    return result.data || [];
  },

  /**
   * Get a single application by ID
   */
  async getApplication(id: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/applications/${id}`);
    if (!response.ok) {
      throw new Error('Failed to load application details');
    }
    const result = await response.json() as { success: boolean; data: Application };
    return result.data;
  },

  /**
   * Update application status (New -> Under Review -> Accepted/Rejected)
   */
  async updateStatus(id: string, status: string, notes?: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/applications/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes }),
    });
    
    if (!response.ok) {
      const error = (await parseJsonSafe(response)) as { error?: string };
      throw new Error(error?.error || 'Failed to update application status');
    }
    return response.json();
  },

  /**
   * Get audit log of status changes for an application
   */
  async getStatusLogs(id: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/applications/${id}/logs`);
    if (!response.ok) {
      throw new Error('Failed to load application audit logs');
    }
    const result = await response.json() as { success: boolean; data: StatusLogEntry[] };
    return result.data || [];
  },

  /**
   * Create a new application
   */
  async createApplication(data: Record<string, any>) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Delete an application permanently
   */
  async deleteApplication(id: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/applications/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = (await parseJsonSafe(response)) as { error?: string };
      throw new Error(err?.error || 'Failed to delete application');
    }
    return response.json();
  },

  /**
   * Record a formal admissions committee decision via the enrollment state machine.
   * Uses POST /api/admissions/decide — which records the decision, updates enrollment_status,
   * and writes to the admissions_decisions table with conditions, deposit requirements, and offer expiry.
   */
  async recordFormalDecision(params: {
    application_id: string;
    decision: 'admit' | 'conditional' | 'waitlist' | 'deny';
    conditions?: string[];
    offer_expires_in_days?: number;
    deposit_required?: boolean;
    deposit_amount?: number;
    reviewer_notes?: string;
  }) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admissions/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const err = (await parseJsonSafe(response)) as { error?: string };
      throw new Error(err?.error || 'Failed to record admissions decision');
    }
    const result = await response.json() as { success: boolean; data: any };
    return result.data;
  },

  /**
   * Get the provisioning pipeline status for a given person.
   */
  async getProvisioningStatus(personId: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/provisioning/status?person_id=${encodeURIComponent(personId)}`);
    if (!response.ok) return null;
    const result = await response.json() as { success: boolean; data: any };
    return result.data;
  },

  /**
   * Trigger the census job to convert REGISTERED → OFFICIALLY_ENROLLED.
   */
  async runCensusJob(termId: string) {
    const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/census/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term_id: termId }),
    });
    if (!response.ok) {
      const err = (await parseJsonSafe(response)) as { error?: string };
      throw new Error(err?.error || 'Failed to run census job');
    }
    const result = await response.json() as { success: boolean; data: any };
    return result.data;
  }
};
