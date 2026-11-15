
import { IIdentityProvider, User, UserCreateInput, MfaSetup } from '../../ports';

export class MemoryIdentityAdapter implements IIdentityProvider {
  private users: Map<string, User & { password?: string }> = new Map();
  private mfaSecrets: Map<string, { type: 'totp' | 'webauthn'; secret: string }> = new Map();

  async createUser(input: UserCreateInput): Promise<User> {
    const id = crypto.randomUUID();
    const user: User & { password?: string } = {
      id,
      email: input.email,
      isEmailVerified: false,
      roles: input.roles || [],
      metadata: input.metadata,
      password: input.password,
    };
    this.users.set(id, user);
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (user && (user as any).password === password) {
      return user;
    }
    return null;
  }

  async setupMfa(userId: string, type: 'totp' | 'webauthn'): Promise<MfaSetup> {
    const secret = crypto.randomUUID();
    this.mfaSecrets.set(userId, { type, secret });
    return { type, secret, qrCodeUrl: `https://example.com/qr?secret=${secret}` };
  }

  async verifyMfa(_userId: string, code: string): Promise<boolean> {
    return code === '123456';
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    user.password = newPassword;
  }
}
