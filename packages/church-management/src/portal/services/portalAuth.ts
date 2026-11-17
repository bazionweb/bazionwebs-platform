import { portalApolloClient } from './portalApollo';
import { MemberUser } from '../types';

const PORTAL_SESSION_KEY = 'hkm_portal_session';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    console.warn('⚠️ Missing VITE_SUPABASE_URL. Falling back to local Supabase (http://localhost:54321).');
    return 'http://localhost:54321';
  }
  return url;
}

function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

async function callEdgeFunction(endpoint: string, body: Record<string, unknown>): Promise<Response> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  return fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });
}

function saveSession(token: string, member: Record<string, unknown>, needsPasswordSetup?: boolean): MemberUser {
  const session: MemberUser = {
    ...(member as unknown as MemberUser),
    token,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    needsPasswordSetup,
  };

  localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  return session;
}

export const portalAuthService = {
  /**
   * LOGIN WITH PIN — First-time login. Validates Member ID + PIN.
   * If member has no password_hash set, server returns needsPasswordSetup: true.
   */
  async loginWithMembership(membershipNumber: string, pin: string, isReset = false) {
    const response = await callEdgeFunction('portal-login', { membershipNumber, pin, isReset });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          'Invalid Membership Number or PIN. If you have not paid your Registration Fee, please contact the church office.',
      );
    }

    const { token, member, needsPasswordSetup } = await response.json();

    const session = saveSession(token, member, needsPasswordSetup);

    // Reset Apollo cache so subsequent queries use the new JWT token
    await portalApolloClient.resetStore().catch(() => {});

    return session;
  },

  /**
   * LOGIN WITH PASSWORD — For returning members who have already set a password.
   */
  async loginWithPassword(membershipNumber: string, password: string) {
    const response = await callEdgeFunction('portal-login', { membershipNumber, password });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Invalid Membership Number or password. Please try again.');
    }

    const { token, member } = await response.json();

    const session = saveSession(token, member);

    await portalApolloClient.resetStore().catch(() => {});

    return session;
  },

  /**
   * SET PASSWORD — Called after first PIN login. Uses the current JWT
   * (which was issued after PIN verification) to authenticate the request.
   * The edge function extracts the member ID from the JWT, so no PIN needed.
   */
  async setPassword(newPassword: string) {
    const currentUser = this.getCurrentUser();
    if (!currentUser?.token) {
      throw new Error('No valid session. Please login with your PIN first.');
    }

    const supabaseUrl = getSupabaseUrl();
    const response = await fetch(`${supabaseUrl}/functions/v1/portal-set-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to set password. Please try again.');
    }

    const { token, member } = await response.json();

    // Overwrite session: remove needsPasswordSetup flag, use new token
    localStorage.removeItem(PORTAL_SESSION_KEY);
    const session = saveSession(token, member);

    await portalApolloClient.resetStore().catch(() => {});

    return session;
  },

  /**
   * LOGOUT — Clears the portal session from localStorage.
   */
  logout() {
    localStorage.removeItem(PORTAL_SESSION_KEY);
  },

  /**
   * IS AUTHENTICATED — checks whether a portal session exists and is valid.
   * Also implements rolling sessions by extending expiration on activity.
   */
  isAuthenticated(): boolean {
    const sessionStr = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!sessionStr) return false;

    try {
      const session = JSON.parse(sessionStr) as MemberUser;
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logout();
        return false;
      }

      // Extend session (rolling 1 hour)
      session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
      localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
      return true;
    } catch {
      this.logout();
      return false;
    }
  },

  /**
   * GET CURRENT USER — Returns the logged-in member from the local session.
   */
  getCurrentUser(): MemberUser | null {
    if (!this.isAuthenticated()) return null;

    const sessionStr = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!sessionStr) return null;

    try {
      return JSON.parse(sessionStr) as MemberUser;
    } catch {
      return null;
    }
  },

  /**
   * CHECK IF MEMBER NEEDS PASSWORD SETUP — returns true if the server
   * indicated that the member must set a password before accessing the portal.
   */
  needsPasswordSetup(): boolean {
    const user = this.getCurrentUser();
    return user?.needsPasswordSetup === true;
  },

  /**
   * REQUEST PIN — Instructs the member to contact the church office.
   */
  async requestPin(_membershipNumber: string) {
    throw new Error(
      'To request a new PIN, please contact the church office. Your PIN is automatically sent when you pay your Registration Fee.',
    );
  },

  /**
   * CHECK MEMBER STATUS — Returns whether the member has an active portal account and password set.
   */
  async checkMemberStatus(membershipNumber: string) {
    const response = await callEdgeFunction('portal-check-member', { membershipNumber });

    if (!response.ok) {
      return { exists: false, hasPassword: false, isActive: false };
    }

    return await response.json().catch(() => ({ exists: false, hasPassword: false, isActive: false }));
  },
};
