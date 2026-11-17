export type MaintenanceStatus = 'Completed' | 'In Progress' | 'Pending';
export type MaintenanceType = 'Repair' | 'Scheduled Check-up' | 'Inspection' | 'Upgrade' | 'Other';

export interface MaintenanceRecord {
  id: number;
  equipmentId: number;
  date: string; // YYYY-MM-DD
  type: MaintenanceType;
  cost: number;
  description: string;
  status: MaintenanceStatus;
}

export const initialMaintenanceData: MaintenanceRecord[] = [
  {
    id: 1,
    equipmentId: 5, // Projector
    date: '2025-04-15',
    type: 'Repair',
    cost: 1500,
    description: 'Replaced the projector lamp and cleaned the lens.',
    status: 'Completed',
  },
  {
    id: 2,
    equipmentId: 2, // Shure SM58 Microphone
    date: '2025-05-01',
    type: 'Inspection',
    cost: 0,
    description: 'Checked cable and connector for wear and tear. All good.',
    status: 'Completed',
  },
  {
    id: 3,
    equipmentId: 1, // Yamaha Keyboard
    date: '2025-05-10',
    type: 'Scheduled Check-up',
    cost: 5000,
    description: 'Full diagnostics and key cleaning.',
    status: 'In Progress',
  },
  {
    id: 4,
    equipmentId: 4, // Drum Set
    date: '2025-05-20',
    type: 'Repair',
    cost: 750,
    description: 'Needs new snare drum skin.',
    status: 'Pending',
  },
];
