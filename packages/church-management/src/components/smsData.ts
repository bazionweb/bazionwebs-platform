export interface SmsRecord {
  id: number;
  recipientCount: number;
  message: string;
  status: 'Sent' | 'Pending' | 'Failed';
  date: string; // YYYY-MM-DD
}

const today = new Date().toISOString().split('T')[0];

export const initialSmsData: SmsRecord[] = [
  { id: 1, recipientCount: 1, message: "Today's test message", status: 'Sent', date: today },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: i + 2,
    recipientCount: 1,
    message: 'This is a pending message.',
    status: 'Pending' as const,
    date: '2025-05-10',
  })),
  ...Array.from({ length: 40 }, (_, i) => ({
    id: i + 6,
    recipientCount: 1,
    message: 'This is an older sent message.',
    status: 'Sent' as const,
    date: `2025-04-${Math.floor(Math.random() * 30) + 1}`,
  })),
];
