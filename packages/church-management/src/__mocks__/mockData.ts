import { Member, Transaction, AttendanceRecord, User } from '../types/domain';

export const mockMembers: Member[] = [
  {
    id: 'MEM-001',
    name: 'Pastor John Doe',
    title: 'Pastor',
    email: 'john.doe@hkm.org',
    phone: '+254700000001',
    department: 'Pastoral',
    role: 'Pastor',
    status: 'Active',
    dateAdded: '2024-01-15',
    gender: 'Male',
    email_tier: 'custom',
    org_email: 'john.doe@hkm.org',
  },
  {
    id: 'MEM-002',
    name: 'Jane Smith',
    title: 'Deaconess',
    email: 'jane.smith@gmail.com',
    phone: '+254700000002',
    department: 'Choir',
    role: 'Member',
    status: 'Active',
    dateAdded: '2024-02-01',
    gender: 'Female',
    email_tier: 'member',
    org_email: 'jane.smith@hkm.org',
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: 101,
    date: '2026-08-01',
    category: 'Tithe',
    type: 'Income',
    amount: 5000,
    description: 'Monthly tithe',
    contributorName: 'Pastor John Doe',
  },
  {
    id: 102,
    date: '2026-08-02',
    category: 'Utilities',
    type: 'Expense',
    amount: 1200,
    description: 'Electricity bill payment',
  },
];

export const mockAttendanceRecords: AttendanceRecord[] = [
  {
    id: 201,
    date: '2026-08-03',
    service: 'Sunday Main Service',
    memberName: 'Pastor John Doe',
    status: 'Present',
  },
  {
    id: 202,
    date: '2026-08-03',
    service: 'Sunday Main Service',
    memberName: 'Jane Smith',
    status: 'Present',
  },
];

export const mockUsers: User[] = [
  {
    id: 'USR-001',
    username: 'admin',
    email: 'admin@hkm.org',
    role: 'Super Admin',
    permissionLevel: 'Admin',
  },
];
