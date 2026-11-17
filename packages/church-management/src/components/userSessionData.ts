// User Session Tracking System
export interface UserSession {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  loginTime: string;
  logoutTime?: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  sessionDuration?: number; // in minutes
  lastActivity: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  timestamp: string;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

// REMOVED: Hardcoded SYSTEM_SUPER_ADMIN credentials (security fix)
// Super admin authentication is now handled exclusively through Clerk.
// No credentials exist in client-side code.

// Helper functions
export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createLoginAttemptId(): string {
  return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateSessionDuration(loginTime: string, logoutTime?: string): number {
  const start = new Date(loginTime).getTime();
  const end = logoutTime ? new Date(logoutTime).getTime() : Date.now();
  return Math.floor((end - start) / (1000 * 60)); // minutes
}

export function isSessionExpired(lastActivity: string, timeoutMinutes: number = 30): boolean {
  const lastActivityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  return now - lastActivityTime > timeoutMinutes * 60 * 1000;
}
