import { OAuth2Client, Credentials } from 'google-auth-library';
import { logAuditEvent, sanitizeInput } from './security';

// Define OAuth-specific audit actions since they don't exist in the base AuditActions
const OAuthAuditActions = {
  OAUTH_VERIFICATION: 'OAUTH_VERIFICATION',
  OAUTH_SUCCESS: 'OAUTH_SUCCESS',
  OAUTH_FAILURE: 'OAUTH_FAILURE',
  OAUTH_REVOKE: 'OAUTH_REVOKE',
} as const;

// Google OAuth configuration
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// User information from Google
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  hd?: string; // Google Workspace domain
}

// CSRF token management - we'll use a different approach since SecureStorage is single-value
const CSRF_TOKEN_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Simple in-memory CSRF token storage (for development)
// In production, this should be replaced with a proper server-side session store
const csrfTokens = new Map<string, { token: string; state: string; timestamp: number; used: boolean }>();

// Initialize Google OAuth client
let oauthClient: OAuth2Client | null = null;

export function initializeGoogleOAuth(config: GoogleOAuthConfig): void {
  oauthClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

export function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    throw new Error('Google OAuth client not initialized. Call initializeGoogleOAuth first.');
  }
  return oauthClient;
}

// Generate CSRF token for OAuth flow
export async function generateCSRFToken(): Promise<{ token: string; state: string }> {
  const token = crypto.randomUUID();
  const state = crypto.randomUUID();

  const csrfData = {
    token,
    state,
    timestamp: Date.now(),
    used: false,
  };

  csrfTokens.set(token, csrfData);

  // Clean up expired tokens
  cleanupExpiredCSRFTokens();

  return { token, state };
}

// Validate CSRF token
export async function validateCSRFToken(token: string, state: string): Promise<boolean> {
  try {
    const csrfData = csrfTokens.get(token);
    if (!csrfData) return false;

    // Check if token is expired
    if (Date.now() - csrfData.timestamp > CSRF_TOKEN_EXPIRY) {
      csrfTokens.delete(token);
      return false;
    }

    // Check if token has been used
    if (csrfData.used) {
      csrfTokens.delete(token);
      return false;
    }

    // Check if state matches
    if (csrfData.state !== state) {
      csrfTokens.delete(token);
      return false;
    }

    // Mark token as used
    csrfData.used = true;
    csrfTokens.set(token, csrfData);

    return true;
  } catch (error) {
    console.error('CSRF token validation failed:', error);
    return false;
  }
}

// Clean up expired CSRF tokens
function cleanupExpiredCSRFTokens(): void {
  try {
    for (const [token, csrfData] of csrfTokens.entries()) {
      if (Date.now() - csrfData.timestamp > CSRF_TOKEN_EXPIRY) {
        csrfTokens.delete(token);
      }
    }
  } catch (error) {
    console.error('CSRF token cleanup failed:', error);
  }
}

// Verify Google ID token
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const client = getOAuthClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: client._clientId,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid ID token: No payload');
    }

    if (!payload.email_verified) {
      throw new Error('Email not verified by Google');
    }

    const userInfo: GoogleUserInfo = {
      id: payload.sub,
      email: payload.email!,
      verified_email: payload.email_verified || false,
      name: payload.name!,
      given_name: payload.given_name!,
      family_name: payload.family_name!,
      picture: payload.picture!,
      locale: payload.locale!,
      hd: payload.hd,
    };

    await logAuditEvent(
      OAuthAuditActions.OAUTH_VERIFICATION,
      'auth',
      undefined,
      `Google OAuth verification successful for: ${sanitizeInput(userInfo.email)}`,
    );

    return userInfo;
  } catch (error) {
    await logAuditEvent(
      OAuthAuditActions.OAUTH_FAILURE,
      'auth',
      undefined,
      `Google OAuth verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    if (error instanceof Error) {
      throw new Error(`Google ID token verification failed: ${error.message}`, { cause: error });
    }
    throw new Error('Google ID token verification failed: Unknown error', { cause: error });
  }
}

// Generate Google OAuth URL
export function generateGoogleAuthUrl(state: string): string {
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    state,
    prompt: 'consent',
    include_granted_scopes: true,
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: Credentials;
  userInfo: GoogleUserInfo;
}> {
  const client = getOAuthClient();

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info
    const response = await client.request<GoogleUserInfo>({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });

    const userInfo = response.data;

    if (!userInfo.verified_email) {
      throw new Error('Google email not verified');
    }

    await logAuditEvent(
      OAuthAuditActions.OAUTH_SUCCESS,
      'auth',
      undefined,
      `Google OAuth token exchange successful for: ${sanitizeInput(userInfo.email)}`,
    );

    return { tokens, userInfo };
  } catch (error) {
    await logAuditEvent(
      OAuthAuditActions.OAUTH_FAILURE,
      'auth',
      undefined,
      `Google OAuth token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    if (error instanceof Error) {
      throw new Error(`Token exchange failed: ${error.message}`, { cause: error });
    }
    throw new Error('Token exchange failed: Unknown error', { cause: error });
  }
}

// Revoke Google tokens
export async function revokeGoogleTokens(accessToken: string): Promise<void> {
  const client = getOAuthClient();

  try {
    await client.revokeToken(accessToken);

    await logAuditEvent(OAuthAuditActions.OAUTH_REVOKE, 'auth', undefined, 'Google OAuth tokens revoked successfully');
  } catch (error) {
    await logAuditEvent(
      OAuthAuditActions.OAUTH_FAILURE,
      'auth',
      undefined,
      `Google OAuth token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    console.error('Token revocation failed:', error);
    // Don't throw error for revocation failure as it's not critical
  }
}
