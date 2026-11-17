import React from 'react';
import { User, UserRole, AccessibleSection, PermissionLevel, canEdit } from './userData';

// Define which sections each role can access
export const rolePermissions: Record<
  UserRole,
  {
    canAccessAll: boolean;
    canManageUsers: boolean;
    canManageDataPersonnel: boolean;
    canEditData: boolean;
    defaultSections: AccessibleSection[];
    defaultPermissionLevel: PermissionLevel;
  }
> = {
  'Super Admin': {
    canAccessAll: true,
    canManageUsers: true,
    canManageDataPersonnel: true,
    canEditData: true,
    defaultPermissionLevel: 'Editor',
    defaultSections: [
      'Members',
      'Attendance',
      'Finance',
      'Equipment',
      'Visitors',
      'Branches',
      'SMS Broadcast',
      'Recycle Bin',
    ],
  },
  Admin: {
    canAccessAll: true,
    canManageUsers: false,
    canManageDataPersonnel: false,
    canEditData: true,
    defaultPermissionLevel: 'Editor',
    defaultSections: [
      'Members',
      'Attendance',
      'Finance',
      'Equipment',
      'Visitors',
      'Branches',
      'SMS Broadcast',
      'Recycle Bin',
    ],
  },
  Member: {
    canAccessAll: false,
    canManageUsers: false,
    canManageDataPersonnel: false,
    canEditData: true,
    defaultPermissionLevel: 'Editor',
    defaultSections: ['Members', 'Attendance', 'Finance', 'Equipment', 'Visitors', 'Branches', 'SMS Broadcast'],
  },
  'Data Personnel': {
    canAccessAll: false,
    canManageUsers: false,
    canManageDataPersonnel: false,
    canEditData: true, // Can edit data in their assigned sections
    defaultPermissionLevel: 'Editor',
    defaultSections: [], // Must be assigned by Super Admin
  },
  Guest: {
    canAccessAll: false,
    canManageUsers: false,
    canManageDataPersonnel: false,
    canEditData: false, // Guests cannot edit data
    defaultPermissionLevel: 'Viewer',
    defaultSections: [], // No default sections for guests
  },
};

// Check if user can access a specific section
export const canAccessSection = (user: User | null, section: AccessibleSection): boolean => {
  if (!user) return false;

  const permissions = rolePermissions[user.role];

  // Super Admin and Admin can access everything
  if (permissions.canAccessAll) return true;

  // Data Personnel can only access their assigned sections
  if (user.role === 'Data Personnel') {
    return user.assignedSections?.includes(section) || false;
  }

  // Guests have very limited access
  if (user.role === 'Guest') {
    return false; // Guests cannot access any sections by default
  }

  // Members can access based on their permission level and general access
  return true;
};

// Check if user can manage other users
export const canManageUsers = (user: User | null): boolean => {
  if (!user) return false;
  return rolePermissions[user.role].canManageUsers;
};

// Check if user can manage data personnel (assign sections)
export const canManageDataPersonnel = (user: User | null): boolean => {
  if (!user) return false;
  return rolePermissions[user.role].canManageDataPersonnel;
};

// Check if user can edit data
export const canEditData = (user: User | null, section?: AccessibleSection): boolean => {
  if (!user) return false;

  // Use the canEdit function from userData.ts for consistency
  return canEdit(user, section);
};

// Get accessible menu items for a user
export const getAccessibleMenuItems = (user: User | null): string[] => {
  if (!user) return [];

  const permissions = rolePermissions[user.role];

  // Base items everyone can see
  const baseItems = ['Dashboard'];

  if (permissions.canAccessAll) {
    // Admins see everything
    return [
      'Dashboard',
      'Members',
      'Birthdays',
      'Attendance',
      'Finance',
      'Equipment',
      'SMS Broadcast',
      'Visitors',
      'Branches',
      'Reports',
      'Users',
      'Settings',
      'AI Features',
      'Recycle Bin',
    ];
  }

  // Data Personnel only see their assigned sections
  const dataPersonnelItems = [...baseItems];

  if (user.assignedSections) {
    user.assignedSections.forEach((section) => {
      if (!dataPersonnelItems.includes(section)) {
        dataPersonnelItems.push(section);
      }
    });
  }

  // Data Personnel can always access Settings (for their own profile)
  if (!dataPersonnelItems.includes('Settings')) {
    dataPersonnelItems.push('Settings');
  }

  return dataPersonnelItems;
};

// Component to conditionally render based on access
interface AccessGateProps {
  user: User | null;
  section?: AccessibleSection;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AccessGate: React.FC<AccessGateProps> = ({
  user,
  section,
  requireAdmin,
  requireSuperAdmin,
  children,
  fallback = null,
}) => {
  if (!user) return <>{fallback}</>;

  if (requireSuperAdmin && user.role !== 'Super Admin') {
    return <>{fallback}</>;
  }

  if (requireAdmin && user.role === 'Data Personnel') {
    return <>{fallback}</>;
  }

  if (section && !canAccessSection(user, section)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// No Access Page component
export const NoAccessPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="bg-red-50 p-8 rounded-lg border border-red-200">
      <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h2 className="text-xl font-bold text-red-700 mb-2">Access Denied</h2>
      <p className="text-red-600">You don't have permission to access this section.</p>
      <p className="text-gray-500 mt-2 text-sm">Please contact your administrator if you need access.</p>
    </div>
  </div>
);

export default AccessGate;
