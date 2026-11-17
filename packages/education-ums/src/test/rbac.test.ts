import { describe, it, expect } from 'vitest';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read', 'write', 'delete', 'manage-users'],
  registrar: ['read', 'write'],
  staff: ['read']
};

const hasPermission = (role: string, permission: string): boolean => 
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

describe('RBAC tests', () => {
  it('admin has all permissions', () => {
    expect(hasPermission('admin', 'manage-users')).toBe(true);
    expect(hasPermission('admin', 'delete')).toBe(true);
  });

  it('registrar cannot delete', () => {
    expect(hasPermission('registrar', 'delete')).toBe(false);
  });

  it('registrar cannot manage-users', () => {
    expect(hasPermission('registrar', 'manage-users')).toBe(false);
  });

  it('registrar can read/write', () => {
    expect(hasPermission('registrar', 'read')).toBe(true);
    expect(hasPermission('registrar', 'write')).toBe(true);
  });

  it('staff is read-only', () => {
    expect(hasPermission('staff', 'read')).toBe(true);
    expect(hasPermission('staff', 'write')).toBe(false);
  });

  it('unknown role has no permissions', () => {
    expect(hasPermission('guest', 'read')).toBe(false);
  });
});





