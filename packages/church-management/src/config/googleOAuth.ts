// Google OAuth Configuration
// Replace these values with your actual Google OAuth credentials
// Get these from Google Cloud Console: https://console.cloud.google.com/

export const GOOGLE_OAUTH_CONFIG = {
  // Client ID from Google Cloud Console
  clientId: process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID || 'your-google-client-id-here',

  // Client Secret from Google Cloud Console (for server-side validation)
  clientSecret: process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET || 'your-google-client-secret-here',

  // Redirect URI - must match what's configured in Google Cloud Console
  redirectUri:
    process.env.REACT_APP_GOOGLE_OAUTH_REDIRECT_URI ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/oauth/callback`
      : 'http://localhost:3000/oauth/callback'),

  // Scopes for user information access
  scopes: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ],

  // Additional configuration
  accessType: 'offline', // Allows refresh tokens
  prompt: 'consent', // Forces consent screen
  includeGrantedScopes: true,
};

// Environment validation
export function validateGoogleOAuthConfig(): string[] {
  const errors: string[] = [];

  if (!GOOGLE_OAUTH_CONFIG.clientId || GOOGLE_OAUTH_CONFIG.clientId === 'your-google-client-id-here') {
    errors.push(
      'Google OAuth Client ID is not configured. Please set REACT_APP_GOOGLE_OAUTH_CLIENT_ID environment variable.',
    );
  }

  if (!GOOGLE_OAUTH_CONFIG.clientSecret || GOOGLE_OAUTH_CONFIG.clientSecret === 'your-google-client-secret-here') {
    errors.push(
      'Google OAuth Client Secret is not configured. Please set REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET environment variable.',
    );
  }

  // Validate client ID format (basic validation)
  if (GOOGLE_OAUTH_CONFIG.clientId && !GOOGLE_OAUTH_CONFIG.clientId.includes('.apps.googleusercontent.com')) {
    errors.push('Google OAuth Client ID format appears invalid. It should end with .apps.googleusercontent.com');
  }

  return errors;
}

// Check if Google OAuth is properly configured
export function isGoogleOAuthConfigured(): boolean {
  const errors = validateGoogleOAuthConfig();
  return errors.length === 0;
}
