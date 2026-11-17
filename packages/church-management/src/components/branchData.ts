import { AvatarTransform } from './memberData';

export interface BranchPastor {
  name: string;
  email: string;
  phone: string;
  gender: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  avatar: string;
  avatarTransform?: AvatarTransform;
  title?: string; // e.g., "Senior Pastor", "Associate Pastor"
}

export interface BranchGivingRecord {
  id: string;
  date: string;
  type: 'Tithe' | 'Offering' | 'Special Seed' | 'Building Fund' | 'Missions' | 'Other';
  amount: number;
  description?: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  address?: string;
  phone?: string;
  email?: string;
  establishedDate?: string;
  pastor: BranchPastor;
  memberCount: {
    male: number;
    female: number;
    total: number;
  };
  givingRecords: BranchGivingRecord[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const initialBranches: Branch[] = [];

// Helper to calculate total giving for a branch
export const calculateBranchGiving = (branch: Branch, period?: { start: string; end: string }) => {
  let records = branch.givingRecords;

  if (period) {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    records = records.filter((r) => {
      const date = new Date(r.date);
      return date >= startDate && date <= endDate;
    });
  }

  const byType = records.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + r.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const total = records.reduce((sum, r) => sum + r.amount, 0);

  return { byType, total };
};
