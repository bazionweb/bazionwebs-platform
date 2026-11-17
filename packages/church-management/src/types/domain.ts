// Central Domain Type Definitions for HKM-CMS

export type UserRole = 'Super Admin' | 'Admin' | 'Pastor' | 'Branch Leader' | 'HOD' | 'Data Personnel' | 'Member';

export type PermissionLevel = 'view' | 'edit' | 'full';

export type AccessibleSection =
  | 'Dashboard'
  | 'Members'
  | 'Add Member'
  | 'Member Details'
  | 'Birthdays'
  | 'Manage Groups'
  | 'Attendance'
  | 'Mark Attendance'
  | 'Attendance Reports'
  | 'Attendance Patterns'
  | 'Department Attendance'
  | 'All Attendance Records'
  | 'Compare Periods'
  | 'Finance'
  | 'Add Transaction'
  | 'Transactions List'
  | 'Tithe Tracking'
  | 'Tithe History'
  | 'Generate Report'
  | 'Weekly Reports'
  | 'Welfare Tracking'
  | 'Equipment'
  | 'Add Equipment'
  | 'Equipment Inventory'
  | 'Add Maintenance'
  | 'Equipment Reports'
  | 'Visitors'
  | 'Add Visitor'
  | 'Visitor Details'
  | 'Visitor Management'
  | 'SMS Broadcast'
  | 'Compose SMS'
  | 'Send SMS'
  | 'SMS History'
  | 'SMS Settings'
  | 'Send Visitor SMS'
  | 'AI Generate SMS'
  | 'Reports'
  | 'Users'
  | 'Add User'
  | 'Settings'
  | 'AI Features'
  | 'Branches'
  | 'Add Branch'
  | 'Data Personnel Management'
  | 'Recycle Bin'
  | 'Permission Requests'
  | 'User Session Monitor';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissionLevel?: 'Viewer' | 'Editor' | 'Manager' | 'Admin';
  branchId?: string;
  avatar?: string;
  avatarTransform?: {
    scale: number;
    rotate: number;
    crop: { x: number; y: number; width: number; height: number };
  };
  assignedSections?: AccessibleSection[];
  sectionPermissions?: Record<AccessibleSection, PermissionLevel>;
}

export type EmailTier = 'custom' | 'member' | 'unassigned';

export interface Member {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  department?: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Pending Fee';
  dateAdded: string;
  dob?: string;
  gender: 'Male' | 'Female';
  avatar?: string | null;
  avatarTransform?: {
    scale: number;
    rotate: number;
    crop: { x: number; y: number; width: number; height: number };
  };
  occupation?: string;
  maritalStatus?: string;
  location?: string;
  pin?: string | null;
  is_portal_active?: boolean;
  email_tier?: EmailTier;
  org_email?: string;
}

export type IncomeCategory =
  | 'Tithe'
  | 'Offering'
  | 'Project Offering'
  | 'Pledge'
  | 'Seed'
  | "Pastor's Appreciation"
  | 'Welfare'
  | 'Children Service Offering'
  | 'Donation'
  | 'Church Bills Contribution'
  | 'Registration Fee'
  | 'Others';

export type ExpenseCategory =
  'Utilities' | 'Rent' | 'Salaries' | 'Supplies' | 'Events' | 'Maintenance' | 'Outreach' | 'Honorarium' | 'Others';

export type TransactionCategory = IncomeCategory | ExpenseCategory;

export interface Transaction {
  id: number;
  date: string;
  category: TransactionCategory;
  type: 'Income' | 'Expense';
  amount: number;
  description: string;
  contributorName?: string;
  contributorPhone?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Excused' | 'Late';

export interface AttendanceRecord {
  id: number;
  date: string;
  service: string;
  memberName: string;
  status: AttendanceStatus;
}
