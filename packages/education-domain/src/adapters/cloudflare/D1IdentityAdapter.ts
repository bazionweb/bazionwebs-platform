import type { IIdentityProvider, User, UserCreateInput, MfaSetup, IDatabase } from '../../ports';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export class D1IdentityAdapter implements IIdentityProvider {
  constructor(private readonly db: IDatabase) {}

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash) return false;
    
    // Fallback for old bcrypt hashes if needed (would require a bcrypt port, but for now we reject)
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
      throw new Error('Bcrypt hashes are no longer supported. Please reset your password.');
    }

    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, key] = parts;
    const hashBuffer = pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    const keyBuffer = Buffer.from(key, 'hex');
    
    if (hashBuffer.length !== keyBuffer.length) return false;
    return timingSafeEqual(hashBuffer, keyBuffer);
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      isEmailVerified: row.is_verified === 1,
      roles: [row.role], // users table only has a single role column
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  async createUser(input: UserCreateInput): Promise<User> {
    const id = crypto.randomUUID();
    const role = (input.roles && input.roles.length > 0) ? input.roles[0] : 'applicant';
    const passwordHash = input.password ? this.hashPassword(input.password) : '';
    
    await this.db.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.email, passwordHash, input.metadata?.firstName || '', input.metadata?.lastName || '', role]
    );

    return this.getUser(id) as Promise<User>;
  }

  async getUser(id: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    return row ? this.mapRowToUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE email = ?', [email]);
    return row ? this.mapRowToUser(row) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    // Basic implementation - in reality we'd build a dynamic update query
    if (updates.roles && updates.roles.length > 0) {
      await this.db.query('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?', [updates.roles[0], id]);
    }
    const user = await this.getUser(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = ?', [id]);
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!row) return null;
    
    try {
      const isValid = this.verifyPassword(password, row.password_hash);
      return isValid ? this.mapRowToUser(row) : null;
    } catch (e) {
      console.error('Password validation error:', e);
      return null;
    }
  }

  async setupMfa(userId: string, type: 'totp' | 'webauthn'): Promise<MfaSetup> {
    // STUB — not the production path (see apps/api routes/auth.ts + lib/mfa-crypto.ts).
    // If promoted, secrets MUST be encrypted via encryptMfaSecret() before storage.
    const secret = randomBytes(20).toString('hex');
    await this.db.query('UPDATE users SET mfa_secret = ?, updated_at = datetime("now") WHERE id = ?', [secret, userId]);
    return { type, secret, qrCodeUrl: `https://example.com/qr?secret=${secret}` };
  }

  async verifyMfa(_userId: string, code: string): Promise<boolean> {
    // Stub implementation for now
    return code === '123456';
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = this.hashPassword(newPassword);
    await this.db.query('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, userId]);
  }
}
