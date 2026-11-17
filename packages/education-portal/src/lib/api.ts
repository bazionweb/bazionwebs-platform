import { API_WORKER_URL } from '../lib/contracts-bridge';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;

// In production builds VITE_API_URL is '' (not set), so always fall back to the
// canonical deployed worker URL — never resolve to an empty-string that browsers
// interpret as the current origin (which is Pages, not the API worker).
const BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';
// Store CSRF token in memory only (not localStorage) for security
let _memoryToken: string | null = null;

function getCsrfToken(): string | null {
  return _memoryToken;
}

function setCsrfToken(token: string) {
  _memoryToken = token;
}

function clearCsrfToken() {
  _memoryToken = null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(res.status, `Server returned status ${res.status}`);
    }

    if (!res.ok || (data && data.success === false)) {
      if (res.status === 401) {
        clearCsrfToken();
      }
      throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
    }
    return data.data ?? data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Please try again.');
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error. Please check your connection.');
  }
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; first_name: string; last_name: string; phone?: string; program?: string; program_id?: string }) =>
      request<{ message: string; user_id: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (email: string, password: string, mfa_token?: string) =>
      request<{ csrf_token?: string; expires_at?: string; user?: User; requires_mfa?: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, mfa_token }) })
        .then(res => { if (res.csrf_token) setCsrfToken(res.csrf_token); return res; }),

    logout: () =>
      request<void>('/auth/logout', { method: 'DELETE' })
        .then(res => { clearCsrfToken(); return res; }),

    refresh: () =>
      request<{ csrf_token: string; expires_at: string }>('/auth/refresh', { method: 'POST' })
        .then(res => { if (res.csrf_token) setCsrfToken(res.csrf_token); return res; }),

    me: () =>
      request<User & { csrf_token?: string }>('/auth/me')
        .then(res => { if (res.csrf_token) setCsrfToken(res.csrf_token); return res as User; }),

    verifyEmail: (token: string) =>
      request<{ message: string }>(`/auth/verify?token=${encodeURIComponent(token)}`),

    resendVerification: (email: string) =>
      request<{ message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),

    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    resetPassword: (token: string, new_password: string) =>
      request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

    mfaSetup: () =>
      request<{ secret: string; otp_auth_url: string }>('/auth/mfa/setup', { method: 'POST' }),

    mfaEnable: (token: string) =>
      request<{ message: string }>('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ token }) }),

    claim: (admissionCode: string, password: string) =>
      request<{ message: string }>('/auth/claim', { method: 'POST', body: JSON.stringify({ admissionCode, password }) }),
  },

  applications: {
    saveDraft: (body: { current_step: number; application_data: any }) =>
      request<{ message: string; throttled: boolean }>('/applications/draft', { method: 'PATCH', body: JSON.stringify(body) }),

    submit: (body: {
      program?: string;
      program_id?: string;
      degree_level: string;
      personal_statement?: string;
      prior_education?: string;
      date_of_birth?: string;
      nationality?: string;
      address?: string;
      gender?: string;
      high_school?: string;
      graduation_year?: number;
      gpa?: number;
    }) =>
      request<{ application_id: string; status: string }>('/applications', { method: 'POST', body: JSON.stringify(body) }),

    payApplicationFee: (applicationId: string) =>
      request<{
        intentId: string;
        reference: string;
        authorizationUrl?: string;
        accessCode?: string;
      }>('/payment/create-intent', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'application_fee', applicationId }),
      }),

    getMyApplication: () =>
      request<Application>('/applications/me'),

    getStatusLogs: (appId: string) =>
      request<StatusLogEntry[]>(`/applications/${appId}/logs`),

    checkDuplicate: (email: string, dob?: string) =>
      request<{ received: boolean; message?: string }>('/applications/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ email, date_of_birth: dob }),
      }).catch(() => ({ received: true })),
  },

  admissions: {
    getDecision: (applicationId?: string) =>
      request<AdmissionsDecision>(applicationId ? `/admissions/decision/${applicationId}` : '/admissions/decision'),
    acceptOffer: (applicationId: string) =>
      request<{ success: boolean; provisioningResult: any }>('/admissions/accept', {
        method: 'POST',
        body: JSON.stringify({ application_id: applicationId }),
      }),
    payDeposit: (applicationId: string, paymentReference: string) =>
      request<{ success: boolean; depositId: string }>('/admissions/deposit', {
        method: 'POST',
        body: JSON.stringify({ application_id: applicationId, payment_reference: paymentReference }),
      }),
    createDepositIntent: (applicationId: string) =>
      request<{
        intentId: string;
        reference: string;
        authorizationUrl?: string;
        accessCode?: string;
      }>('/payment/create-intent', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'deposit', applicationId }),
      }),
    declineOffer: (applicationId: string, reason?: string) =>
      request<{ message: string }>('/admissions/decline', {
        method: 'POST',
        body: JSON.stringify({ application_id: applicationId, reason }),
      }),
  },

  provisioning: {
    getStatus: () =>
      request<{
        status: 'idle' | 'in_progress' | 'completed' | 'failed';
        uid: string | null;
        regNo: string | null;
        studentEmail: string | null;
        catalogYearId: string | null;
        iamProvisioned?: boolean;
        iamPendingReason?: string | null;
        steps: Array<{ step: string; label: string; status: string; completedAt?: string; error?: string }>;
      }>('/provisioning/status'),
  },

  finance: {
    getFinancialAid: (termId?: string) => {
      const qs = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
      return request<{ awards: any[]; total_awarded: number }>(`/finance/financial-aid${qs}`);
    },
    getFeeAgreement: (termId?: string) => {
      const qs = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
      return request<{
        program_name: string;
        catalog_year_id: string;
        gross_tuition: number;
        financial_aid_discount: number;
        net_balance_due: number;
        currency: string;
        payment_plans: Array<{ id: string; name: string; discount?: string }>;
      }>(`/finance/fee-agreement${qs}`);
    },
  },

  enrollment: {
    getStatus: () =>
      request<{ status: string; lastChangedAt: string; reason: string | null }>('/enrollment/status'),
    getAgreement: () =>
      request<{ document_id: string; version: string; version_hash: string; text: string }>('/enrollment/agreement'),
    signAgreement: (documentId: string, signedName: string, documentVersionHash = 'v1.0-sha256') =>
      request<{ success: boolean; signature_id: string; status: string; message: string }>('/enrollment/sign-agreement', {
        method: 'POST',
        body: JSON.stringify({
          document_id: documentId,
          signed_name: signedName,
          document_version_hash: documentVersionHash,
        }),
      }),
  },

  admin: {
    listApplications: (params?: { status?: string; limit?: number; offset?: number }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : '';
      return request<Application[]>(`/admin/applications${qs}`);
    },
    getApplication: (appId: string) =>
      request<Application>(`/admin/applications/${appId}`),
    updateStatus: (appId: string, status: string, notes?: string) =>
      request<{ application_id: string; new_status: string }>(`/admin/applications/${appId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes }),
      }),
    decideApplication: (body: {
      application_id: string;
      decision: 'admit' | 'conditional' | 'waitlist' | 'deny';
      conditions?: string[];
      deposit_required?: boolean;
      deposit_amount?: number;
      reviewer_notes?: string;
    }) =>
      request<{ success: boolean; decisionId: string; status: string }>('/admissions/decide', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    runCensusJob: (termId?: string) =>
      request<any>('/admin/census/run', {
        method: 'POST',
        body: JSON.stringify({ term_id: termId }),
      }),
    listUsers: () =>
      request<{ users: any[] }>('/admin/users'),
    updateUserRole: (userId: string, role: string) =>
      request<{ message: string }>(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    deleteUser: (userId: string) =>
      request<{ message: string }>(`/admin/users/${userId}`, { method: 'DELETE' }),
    resetUserPassword: (userId: string) =>
      request<{ message: string }>(`/admin/users/${userId}/reset-password`, { method: 'POST' }),
    getAuditLogs: (params?: { action?: string; limit?: number; offset?: number }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : '';
      return request<{ logs: AuditLog[]; total: number }>(`/admin/audit-logs${qs}`);
    },
  },

  documents: {
    upload: (applicationId: string, docType: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      return fetch(`${BASE}/documents/upload?application_id=${encodeURIComponent(applicationId)}&doc_type=${encodeURIComponent(docType)}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: fd,
      }).then(r => r.json());
    },
    downloadUrl: (docId: string) => `${BASE}/documents/${docId}/download`,
  },

  recommendations: {
    request: (applicationId: string, referee_name: string, referee_email: string) =>
      request<{ id: string; status: string }>(`/applications/${applicationId}/recommendations`, {
        method: 'POST',
        body: JSON.stringify({ referee_name, referee_email })
      }),
    list: (applicationId: string) =>
      request<RecommendationRequest[]>(`/applications/${applicationId}/recommendations`),
    getInfo: (token: string) =>
      request<RecommendationInfo>(`/recommendations/${token}`),
    upload: (token: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(`${BASE}/recommendations/${token}/upload`, {
        method: 'POST',
        body: fd
      }).then(r => r.json());
    }
  },

  student: {
    getRegistrationEligibility: (termId?: string) => {
      const qs = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
      return request<{
        eligible: boolean;
        status: string;
        reasons: string[];
        activeHolds: Array<{ id: string; hold_type: string; reason: string; blocks: string }>;
        advisingReleased: boolean;
        catalogYearId: string | null;
        term: { id: string; name: string; academic_year: string; status: string } | null;
      }>(`/student/registration-eligibility${qs}`);
    },
    getOnboardingStatus: () => request<{ tasks: any[]; progress: number; isComplete: boolean }>('/student/onboarding'),
    uploadDocument: (docType: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
      return fetch(`${BASE}/student/documents/upload?doc_type=${encodeURIComponent(docType)}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: fd,
      }).then(r => r.json());
    },
    getDashboard: () => request<any>('/student/dashboard'),
    getCourses: (term?: string) => {
      const qs = term ? `?term=${encodeURIComponent(term)}` : '';
      return request<Course[]>(`/student/courses${qs}`);
    },
    enroll: (course_id: string) => request<{ success: boolean; message: string }>('/student/enroll', {
      method: 'POST',
      body: JSON.stringify({ course_id })
    }),
    getFinances: () => request<any>('/student/finances'),
    payInvoice: (invoiceId: string) => request<{
      success: boolean;
      requires_action?: boolean;
      paymentIntentId?: string;
      reference?: string;
      authorization_url?: string;
      authorizationUrl?: string;
      access_code?: string;
      merchant?: string;
      tradingAs?: string;
      message?: string;
    }>(`/student/invoices/${invoiceId}/pay`, { method: 'POST' }),
    dropCourse: (course_id: string) => request<{ success: boolean; message: string }>(`/student/courses/${course_id}/drop`, { method: 'POST' }),
    getTranscript: () => request<{ classes: any[]; gpa: string | null }>('/student/transcript'),
    getDeadlines: () => request<Array<{ title: string; date: string; type: string; tag: string; color: string }>>('/v1/dashboard/deadlines'),
    getSettings: () => request<{ directory_release: number; communications_opt_in: number; photo?: string | null }>('/student/settings'),
    updateSettings: (settings: { directory_release: boolean; communications_opt_in: boolean }) =>
      request<{ success: boolean; message: string }>('/student/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      }),
    updatePhoto: (photo: string) =>
      request<{ success: boolean; message: string }>('/student/photo', {
        method: 'PUT',
        body: JSON.stringify({ photo })
      }),
    getSupportTickets: () => request<any[]>('/student/support'),
    createSupportTicket: (subject: string, description: string) =>
      request<{ success: boolean; message: string; ticket_id: string }>('/student/support', {
        method: 'POST',
        body: JSON.stringify({ subject, description })
      }),
    completeOrientation: (data?: any) =>
      request<{ success?: boolean; message: string }>('/student/orientation/complete', {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),
    getCurriculum: () => request<any>('/student/curriculum'),
    getSections: (courseId: string, termId?: string) => {
      const qs = `?course_id=${encodeURIComponent(courseId)}${termId ? `&term_id=${encodeURIComponent(termId)}` : ''}`;
      return request<{ sections: Array<{ id: string; section_code: string; capacity: number; seats_taken: number; seats_available: number; is_full: boolean; schedule?: string; room?: string; code: string; title: string }>; my_section_ids: string[] }>(`/student/sections${qs}`);
    },
    autoEnrollMandatory: () =>
      request<{ success: boolean; message: string }>('/student/enroll/mandatory', { method: 'POST' }),
    generateInvoice: () =>
      request<{ invoice_id: string; amount: number; status: string }>('/student/invoice/generate', { method: 'POST' }),
    getHolds: () => request<any[]>('/student/holds'),
    getAttendance: () => request<any[]>('/v1/attendance'),
    getRegistrationProgress: () => request<any>('/student/registration-progress'),
  },

  payments: {
    createIntent: (body: { amount?: number; reason?: string; email?: string; currency?: string; invoiceId?: string; purpose?: string; applicationId?: string }) =>
      request<{
        intentId: string;
        reference: string;
        authorizationUrl?: string;
        accessCode?: string;
        clientSecret?: string;
        merchant: string;
        tradingAs: string;
        publishableKey?: string;
      }>('/payment/create-intent', { method: 'POST', body: JSON.stringify(body) }),
    verify: (reference: string) =>
      request<{ verified: boolean; status: string; reference: string }>(
        `/payment/verify/${encodeURIComponent(reference)}`,
      ),
  },

  notifications: {
    list: (unreadOnly?: boolean) => {
      const qs = unreadOnly ? '?unread=true' : '';
      return request<{ data: any[]; meta: { total: number; unread_count: number } }>(`/v1/notifications${qs}`);
    },
    markRead: (ids?: string[]) =>
      request<{ message: string }>('/v1/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },

  registration: {
    getStatus: () => request<any>('/registration/status'),
    getModules: () => request<any[]>('/registration/modules'),
    getPrograms: () =>
      request<{ items: { id: string; name: string; code: string; level: string; degree_type: string }[]; total: number }>('/v1/programs')
        .then(r => r.items ?? []),
    reserveSeat: (sectionId: string, termId?: string) =>
      request<{ status: string; sectionId: string; waitlistPosition?: number; message: string }>('/registration/reserve-seat', {
        method: 'POST',
        body: JSON.stringify({ section_id: sectionId, term_id: termId }),
      }),
    joinWaitlist: (sectionId: string) =>
      request<{ status: string; sectionId: string; waitlistPosition: number; message: string }>('/registration/waitlist', {
        method: 'POST',
        body: JSON.stringify({ section_id: sectionId }),
      }),
    dropCourse: (courseId: string, sectionId?: string) =>
      request<{ success: boolean; promotedStudentId: string | null; message: string }>('/registration/drop', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId, section_id: sectionId }),
      }),
    saveStep: (stepKey: string, data: any) =>
      request<any>(`/registration/${stepKey}`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    complete: () => request<any>('/registration/complete', { method: 'POST' }),
    finalize: () => request<{ success: boolean; status: string; registered_sections: number; message: string }>('/registration/finalize', { method: 'POST' }),
  }
};

export interface AdmissionsDecision {
  id?: string;
  application_id: string;
  decision: 'admit' | 'conditional' | 'waitlist' | 'deny' | null;
  decided_by?: string;
  decided_at?: string;
  conditions?: string | string[] | null;
  offer_expires_at?: string | null;
  deposit_required?: number;
  deposit_amount?: number;
  program?: string;
  degree_level?: string;
  application_status?: string;
  payment?: {
    required: boolean;
    amount_minor: number;
    charge_currency: string;
    formatted: string;
    deferred: boolean;
    paid: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'applicant' | 'student' | 'staff' | 'admin' | 'alumni' | 'verifier';
  is_verified?: number;
}

export interface Application {
  id: string;
  user_id: string;
  program: string;
  degree_level: string;
  status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'waitlisted';
  personal_statement: string | null;
  submitted_at: string | null;
  created_at: string;
  documents?: DocumentMeta[];
  first_name?: string;
  last_name?: string;
  email?: string;
  application_number?: string;
  reviewer_notes?: string | null;
}

export interface DocumentMeta {
  id: string;
  doc_type: string;
  file_name: string;
  uploaded_at: string;
}

export interface RecommendationRequest {
  id: string;
  referee_name: string;
  referee_email: string;
  status: 'requested' | 'submitted';
  requested_at: string;
  completed_at: string | null;
}

export interface RecommendationInfo {
  id: string;
  referee_name: string;
  status: 'requested' | 'submitted';
  first_name: string;
  last_name: string;
  program: string;
}

export interface StatusLogEntry {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  changed_at: string;
  changed_by_name: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  credits: number;
  term: string;
  capacity: number;
  semester?: string;
  name?: string;
  prerequisites_met?: boolean;
  unmet_prerequisites?: string[];
  is_full?: boolean;
  enrolled_count?: number;
  waitlisted_count?: number;
  status?: string;
  is_mandatory?: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
}

export interface SupportTicket {
  id: string;
  student_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}
