/**
 * BMI UMS – Communications Center Service
 * Backs the dispatch ledger with real API data instead of localStorage mocks.
 */
import { authFetch } from './authService';
import { API_URL } from './config';

export interface CommunicationRecord {
  id: string;
  type: 'SMS' | 'Email';
  channel: 'sms' | 'email' | 'whatsapp';
  recipient: string;
  subject?: string | null;
  body: string;
  status: 'Delivered' | 'Pending' | 'Failed';
  sent_by?: string | null;
  sent_by_name?: string | null;
  created_at: string;
}

export interface CommunicationsListResponse {
  success: boolean;
  data?: CommunicationRecord[];
  total?: number;
  error?: string;
}

export async function listCommunications(params?: {
  type?: string;
  page?: number;
  perPage?: number;
}): Promise<CommunicationsListResponse> {
  try {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.perPage) qs.set('perPage', String(params.perPage));
    const url = `${API_URL}/communications${qs.toString() ? `?${qs.toString()}` : ''}`;
    const response = await authFetch(url, {}, 8000);
    const data = await response.json().catch(() => null);
    const rawList = data?.data ?? data?.results ?? [];
    const list = Array.isArray(rawList) ? rawList : (Array.isArray(rawList?.results) ? rawList.results : []);
    return { success: response.ok, data: list, total: data?.total ?? list.length, error: data?.error };
  } catch (error) {
    return { success: false, data: [], total: 0, error: error instanceof Error ? error.message : 'Failed to fetch communications' };
  }
}

export async function createCommunication(input: {
  type: 'SMS' | 'Email';
  channel: 'sms' | 'email' | 'whatsapp';
  recipient: string;
  subject?: string;
  body: string;
  status?: 'Delivered' | 'Pending' | 'Failed';
}): Promise<{ success: boolean; data?: CommunicationRecord; error?: string }> {
  try {
    const response = await authFetch(`${API_URL}/communications`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (response.ok && data?.success) return { success: true, data: data.data };
    return { success: false, error: data?.error || 'Failed to record communication' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to record communication' };
  }
}

export async function deleteCommunication(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authFetch(`${API_URL}/communications/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => null);
    return { success: response.ok, error: !response.ok ? (data?.error || 'Failed to delete record') : undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete record' };
  }
}

// ─── Website Contact Submissions ──────────────────────────────────────────────

export interface ContactSubmissionRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_address?: string | null;
  user_agent?: string | null;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at: string;
}

export interface ContactSubmissionsListResponse {
  success: boolean;
  data?: ContactSubmissionRecord[];
  total?: number;
  unreadCount?: number;
  error?: string;
}

export async function listContactSubmissions(params?: {
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<ContactSubmissionsListResponse> {
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.perPage) qs.set('perPage', String(params.perPage));
    const url = `${API_URL}/contact-submissions${qs.toString() ? `?${qs.toString()}` : ''}`;
    const response = await authFetch(url, {}, 8000);
    const data = await response.json().catch(() => null);
    const rawList = data?.data ?? data?.results ?? [];
    const list = Array.isArray(rawList) ? rawList : (Array.isArray(rawList?.results) ? rawList.results : []);
    return { 
      success: response.ok, 
      data: list, 
      total: data?.total ?? list.length, 
      unreadCount: data?.unreadCount ?? 0,
      error: data?.error 
    };
  } catch (error) {
    return { success: false, data: [], total: 0, unreadCount: 0, error: error instanceof Error ? error.message : 'Failed to fetch contact inquiries' };
  }
}

export async function updateContactSubmissionStatus(
  id: string, 
  status: 'new' | 'read' | 'replied' | 'archived'
): Promise<{ success: boolean; data?: ContactSubmissionRecord; error?: string }> {
  try {
    const response = await authFetch(`${API_URL}/contact-submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (response.ok && data?.success) return { success: true, data: data.data };
    return { success: false, error: data?.error || 'Failed to update status' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update status' };
  }
}

export async function deleteContactSubmission(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authFetch(`${API_URL}/contact-submissions/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => null);
    return { success: response.ok, error: !response.ok ? (data?.error || 'Failed to delete inquiry' ) : undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete inquiry' };
  }
}