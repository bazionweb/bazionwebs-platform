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

export type TransactionType = 'Income' | 'Expense';

export interface Transaction {
  id: number;
  date: string;
  category: TransactionCategory;
  type: TransactionType;
  amount: number;
  description: string;
  memberId?: string;
  nonMemberName?: string;
  isAnonymous?: boolean;
  contributorName?: string;
  contributorPhone?: string;
}

export const initialTransactions: Transaction[] = [];
