import { AvatarTransform } from './memberData';

export type UserRole = 'Super Admin' | 'Admin' | 'Data Personnel' | 'Member' | 'Guest';

// Permission levels for users
export type PermissionLevel = 'Viewer' | 'Editor';

// Sections that data personnel can be assigned to
export type AccessibleSection =
  // Members Module
  | 'Members'
  | 'Add Member'
  | 'Member Details'
  | 'Birthdays'
  | 'Manage Groups'

  // Attendance Module
  | 'Attendance'
  | 'Mark Attendance'
  | 'Attendance Reports'
  | 'Attendance Patterns'
  | 'Department Attendance'
  | 'All Attendance Records'
  | 'Compare Periods'

  // Finance Module
  | 'Finance'
  | 'Add Transaction'
  | 'Transactions List'
  | 'Tithe Tracking'
  | 'Tithe History'
  | 'Generate Report'
  | 'Weekly Reports'
  | 'Welfare Tracking'

  // Equipment Module
  | 'Equipment'
  | 'Add Equipment'
  | 'Equipment Inventory'
  | 'Add Maintenance'
  | 'Equipment Reports'

  // Visitors Module
  | 'Visitors'
  | 'Add Visitor'
  | 'Visitor Details'
  | 'Visitor Management'

  // Branches Module
  | 'Branches'
  | 'Add Branch'

  // SMS Module
  | 'SMS Broadcast'
  | 'Compose SMS'
  | 'Send SMS'
  | 'SMS History'
  | 'SMS Settings'
  | 'Send Visitor SMS'
  | 'AI Generate SMS'

  // System Module
  | 'Recycle Bin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissionLevel?: PermissionLevel; // New: Viewer or Editor
  avatar: string;
  avatarTransform?: AvatarTransform;
  lastLogin: string;
  lastPasswordChange?: number; // Timestamp of last password change
  passwordHash?: string; // Hashed password, never store plain text
  assignedSections?: AccessibleSection[]; // For Data Personnel - which sections they can access
  createdBy?: string; // User ID who created this user
  isActive?: boolean;
}

// Super admin authentication is handled through Clerk.
// No super admin credentials are stored in the client bundle.
// See supabase_schema.sql for the users table with role-based access.

// Recycle Bin Item
export interface RecycleBinItem {
  id: string;
  originalId: string | number;
  type:
    | 'Member'
    | 'Transaction'
    | 'Equipment'
    | 'Visitor'
    | 'Group'
    | 'Branch'
    | 'User'
    | 'AttendanceRecord'
    | 'MaintenanceRecord';
  data: unknown; // Original data
  deletedBy: string; // User ID who deleted it
  deletedAt: string; // ISO timestamp
  reason?: string; // Optional deletion reason
}

// No hardcoded users - admin is created during first-run setup
export const initialUsers: User[] = [];

// REMOVED: SUPER_ADMIN_CONFIG with client-side secrets.
// All admin authentication is handled through Clerk.
// Role-based access (Super Admin / Admin) is enforced server-side via RLS policies.

// Check if this is first run (no users exist) — DEPRECATED: local auth removed
export function isFirstRun(): boolean {
  const users = localStorage.getItem('hkm_users');
  if (!users) return true;
  try {
    const parsed = JSON.parse(users);
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

// Check if user has edit permissions (with permission request support)
export function canEdit(user: User | null, section?: AccessibleSection): boolean {
  if (!user) return false;

  // Guests can never edit
  if (user.role === 'Guest') return false;

  // Super Admin always has edit permissions
  if (user.role === 'Super Admin') return true;

  // Check permission level
  if (user.permissionLevel === 'Viewer') return false;

  // If assignedSections is explicitly set for this user (by Super Admin), strictly enforce it
  if (user.assignedSections && Array.isArray(user.assignedSections)) {
    if (!section) return false; // If a section is required but not provided, fail safe
    return user.assignedSections.includes(section);
  }

  // Fallbacks for users who haven't had explicit sections assigned yet:
  if (user.role === 'Admin') return true;
  if (user.role === 'Data Personnel') return false; // Data personnel MUST have assigned sections

  // Members with Editor permission can edit (but may need approval for existing data)
  return user.permissionLevel === 'Editor';
}

// Check if user needs permission request for editing existing data
export function needsPermissionRequest(user: User | null): boolean {
  if (!user) return true;

  // Guests shouldn't even reach here, but if they do, they need requests
  if (user.role === 'Guest') return true;

  // Super Admin and Admin never need permission requests
  if (user.role === 'Super Admin' || user.role === 'Admin') return false;

  // Data Personnel and Members with Editor permission need approval for existing data
  return user.role === 'Data Personnel' || user.role === 'Member';
}

// Check if user can view (always true if they have access to the section)
export function canView(user: User | null, section?: AccessibleSection): boolean {
  if (!user) return false;

  // Guests cannot view protected sections
  if (user.role === 'Guest') return false;

  // Super Admin can view everything
  if (user.role === 'Super Admin') return true;

  // If assignedSections is explicitly set for this user, strictly enforce it
  if (user.assignedSections && Array.isArray(user.assignedSections)) {
    if (!section) return false; // Fail safe
    return user.assignedSections.includes(section);
  }

  // Fallbacks for users who haven't had explicit sections assigned yet:
  if (user.role === 'Admin') return true;
  if (user.role === 'Data Personnel') return false; // Data personnel MUST have assigned sections

  // Members can view based on their general access
  return true;
}
