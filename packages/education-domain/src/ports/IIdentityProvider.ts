
export interface User {
  id: string;
  email: string;
  isEmailVerified: boolean;
  roles: string[];
  metadata?: Record<string, any>;
}

export interface UserCreateInput {
  email: string;
  password?: string;
  roles?: string[];
  metadata?: Record<string, any>;
}

export interface MfaSetup {
  type: 'totp' | 'webauthn';
  secret?: string;
  qrCodeUrl?: string;
}

export interface IIdentityProvider {
  createUser(input: UserCreateInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  validateCredentials(email: string, password: string): Promise<User | null>;
  setupMfa(userId: string, type: 'totp' | 'webauthn'): Promise<MfaSetup>;
  verifyMfa(userId: string, code: string): Promise<boolean>;
  resetPassword(userId: string, newPassword: string): Promise<void>;
}
