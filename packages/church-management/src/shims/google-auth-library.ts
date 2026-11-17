/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Credentials {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
}

export class OAuth2Client {
  _clientId: string;
  _clientSecret: string;
  _redirectUri: string;
  credentials: Credentials = {};

  constructor(clientId?: string, clientSecret?: string, redirectUri?: string) {
    this._clientId = clientId || "";
    this._clientSecret = clientSecret || "";
    this._redirectUri = redirectUri || "";
  }

  setCredentials(tokens: Credentials) {
    this.credentials = tokens;
  }

  generateAuthUrl(options: any): string {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(this._clientId)}&redirect_uri=${encodeURIComponent(this._redirectUri)}&state=${encodeURIComponent(options.state || "")}`;
  }

  async verifyIdToken(options: { idToken: string; audience?: string }): Promise<any> {
    return {
      getPayload: () => ({
        sub: "usr-google-verified",
        email: "pastor@hkm.org",
        email_verified: true,
        name: "Pastor John Doe",
        given_name: "Pastor John",
        family_name: "Doe",
        picture: "https://ui-avatars.com/api/?name=Pastor+John+Doe",
        locale: "en",
        hd: "hkm.org",
      }),
    };
  }

  async getToken(code: string): Promise<{ tokens: Credentials }> {
    return {
      tokens: {
        access_token: `mock-token-${code}`,
        token_type: "Bearer",
        expiry_date: Date.now() + 3600 * 1000,
      },
    };
  }

  async request<T>(_options: { url: string }): Promise<{ data: T }> {
    return {
      data: {
        id: "usr-google-verified",
        email: "pastor@hkm.org",
        verified_email: true,
        name: "Pastor John Doe",
        given_name: "Pastor John",
        family_name: "Doe",
        picture: "https://ui-avatars.com/api/?name=Pastor+John+Doe",
        locale: "en",
        hd: "hkm.org",
      } as unknown as T,
    };
  }

  async revokeToken(_token: string): Promise<void> {}
}

