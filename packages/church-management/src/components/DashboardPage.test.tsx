import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { Member } from './memberData';
import { Transaction } from './financeData';
import { User } from './userData';

vi.mock('./ThemeContext', () => ({
  useTheme: () => ({
    modeColors: {
      card: 'bg-white',
      text: 'text-gray-900',
      textSecondary: 'text-gray-600',
      hover: 'hover:bg-gray-50',
      bgSecondary: 'bg-gray-100',
    },
  }),
}));

vi.mock('./PageHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

const members: Member[] = Array.from({ length: 30 }, (_, index) => ({
  id: `HKM-${String(index + 1).padStart(3, '0')}`,
  name: `Member ${index + 1}`,
  title: '',
  avatar: '',
  department: 'Choir',
  role: 'Member',
  status: 'Active',
  dateAdded: '2026-07-01',
  dob: '1990-01-01',
  gender: index % 2 === 0 ? 'Male' : 'Female',
}));

const transactions: Transaction[] = [];
const currentUser = { role: 'Admin' } as User;

describe('DashboardPage', () => {
  it('shows the exact member total when provided separately from the loaded list', () => {
    render(
      <DashboardPage
        setActivePage={vi.fn()}
        members={members}
        totalMembersCount={42}
        transactions={transactions}
        onAddTransaction={vi.fn()}
        currentUser={currentUser}
      />,
    );

    expect(screen.getByText('Total Members')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('falls back to the loaded member list length when no separate total is provided', () => {
    render(
      <DashboardPage
        setActivePage={vi.fn()}
        members={members}
        transactions={transactions}
        onAddTransaction={vi.fn()}
        currentUser={currentUser}
      />,
    );

    const totalMembersCard = screen.getByText('Total Members').closest('div');
    expect(totalMembersCard).not.toBeNull();
    expect(within(totalMembersCard as HTMLElement).getByText('30')).toBeInTheDocument();
  });
});
