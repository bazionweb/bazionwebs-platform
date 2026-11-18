import { MemberUser } from '../types';

const PORTAL_SESSION_KEY = 'hkm_portal_session';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
const PORTAL_API = '/api/church/hkm/portal';

interface HkmMemberResponse {
  id: string;
  membershipNumber?: string;
  membership_number?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email: string;
  phone?: string;
  branchName?: string;
  role?: string;
  status?: string;
}

function memberSession(member: HkmMemberResponse): MemberUser {
  const fullName = `${member.firstName ?? member.first_name ?? ''} ${member.lastName ?? member.last_name ?? ''}`.trim();
  return {
    id: member.id,
    email: member.email,
    membership_number: member.membershipNumber ?? member.membership_number ?? '',
    full_name: fullName,
    phone_number: member.phone ?? '',
    department: member.branchName ?? '',
    status: member.status ?? 'Active',
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };
}

function saveSession(member: HkmMemberResponse): MemberUser {
  const session = memberSession(member);
  localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  return session;
}

async function portalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PORTAL_API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message
      : typeof data.error === 'string' ? data.error
        : 'The member portal request failed.';
    throw new Error(message);
  }
  return data as T;
}

export const portalAuthService = {
  async loginWithPassword(membershipNumber: string, password: string) {
    const result = await portalRequest<{ success: boolean; member: HkmMemberResponse }>('/login-password', {
      method: 'POST', body: JSON.stringify({ membershipNumber, password }),
    });
    return saveSession(result.member);
  },

  async loginWithMembership(_membershipNumber: string, _pin: string) {
    throw new Error('PIN sign-in is unavailable until a verified code delivery provider is configured. Use your account password.');
  },

  async setPassword(_newPassword: string) {
    throw new Error('Password setup requires a verified account link. Contact the church office to link your member record.');
  },

  logout() {
    localStorage.removeItem(PORTAL_SESSION_KEY);
    void portalRequest('/logout', { method: 'POST' }).catch(() => undefined);
  },

  isAuthenticated(): boolean {
    const sessionStr = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!sessionStr) return false;
    try {
      const session = JSON.parse(sessionStr) as MemberUser;
      if (session.expiresAt && Date.now() > session.expiresAt) {
        localStorage.removeItem(PORTAL_SESSION_KEY);
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem(PORTAL_SESSION_KEY);
      return false;
    }
  },

  async verifySession(): Promise<MemberUser | null> {
    try {
      const result = await portalRequest<{ success: boolean; member: HkmMemberResponse }>('/me');
      return saveSession(result.member);
    } catch {
      localStorage.removeItem(PORTAL_SESSION_KEY);
      return null;
    }
  },

  getCurrentUser(): MemberUser | null {
    if (!this.isAuthenticated()) return null;
    try {
      const session = JSON.parse(localStorage.getItem(PORTAL_SESSION_KEY) ?? 'null') as MemberUser | null;
      return session;
    } catch {
      return null;
    }
  },

  needsPasswordSetup(): boolean {
    return false;
  },

  async requestPin(_membershipNumber: string) {
    throw new Error('PIN delivery is unavailable. Contact the church office to request access.');
  },

  async getDashboard() {
    return portalRequest<{
      member: Record<string, unknown>;
      transactions: Array<Record<string, unknown>>;
      attendance: Array<Record<string, unknown>>;
    }>('/dashboard');
  },

  async getChurchConfig() {
    const response = await fetch('/api/church/hkm/config', { credentials: 'include' });
    if (!response.ok) throw new Error('Could not load church information.');
    return await response.json() as { config: { churchName: string; contact?: { address?: string; phone?: string; email?: string } } };
  },
};
