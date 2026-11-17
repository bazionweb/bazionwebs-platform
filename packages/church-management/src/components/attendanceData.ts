export type AttendanceStatus = 'Present' | 'Absent' | 'Late';

export type AttendanceRecord = {
  id: number;
  date: string;
  service: string;
  memberName: string;
  status: AttendanceStatus;
};

export const attendanceData: AttendanceRecord[] = [
  { id: 1, date: '2025-04-16', service: 'Mid-week Service', memberName: 'Adwoa Appiah', status: 'Present' },
  { id: 2, date: '2025-04-16', service: 'Mid-week Service', memberName: 'Abenaa Tawiah', status: 'Present' },
  { id: 3, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Abenaa Yeboah', status: 'Present' },
  { id: 4, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Abigail Agyekum', status: 'Present' },
  { id: 5, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Abigail Anokye', status: 'Present' },
  { id: 6, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Abigail Poku', status: 'Absent' },
  { id: 7, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Abraham Lincoln', status: 'Present' },
  { id: 8, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Adam Smith', status: 'Absent' },
  { id: 9, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'greater grace', status: 'Present' },
  { id: 10, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Afua Tawiah', status: 'Present' },
  { id: 11, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'John Doe', status: 'Present' },
  { id: 12, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Jane Smith', status: 'Present' },
  { id: 13, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Samuel Adu', status: 'Absent' },
  { id: 14, date: '2025-04-13', service: 'Sunday Morning Service', memberName: 'Adwoa Appiah', status: 'Present' },
  { id: 15, date: '2025-04-13', service: 'Sunday Morning Service', memberName: 'Abenaa Tawiah', status: 'Present' },
  { id: 16, date: '2025-04-13', service: 'Sunday Morning Service', memberName: 'Abigail Poku', status: 'Present' },
  { id: 17, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Grace Mensah', status: 'Present' },
  { id: 18, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Esther Owusu', status: 'Present' },
  { id: 19, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Mary Osei', status: 'Present' },
  { id: 20, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'David Amoah', status: 'Present' },
  { id: 21, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Michael Agyemang', status: 'Present' },
  { id: 22, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Emmanuel Boateng', status: 'Present' },
  { id: 23, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Kwame Adjei', status: 'Present' },
  { id: 24, date: '2025-04-20', service: 'Sunday Second Service', memberName: 'Kofi Asare', status: 'Present' },
  { id: 25, date: '2025-04-20', service: 'Sunday Second Service', memberName: 'Yaw Gyan', status: 'Present' },
  { id: 26, date: '2025-04-20', service: 'Sunday Second Service', memberName: 'Ama Yeboah', status: 'Present' },
  { id: 27, date: '2025-04-20', service: 'Sunday Second Service', memberName: 'Adwoa Mensah', status: 'Present' },
  { id: 28, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Grace Owusu', status: 'Absent' },
  { id: 29, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Mary Osei', status: 'Absent' },
  { id: 30, date: '2025-04-20', service: 'Sunday Morning Service', memberName: 'Esther Amoah', status: 'Present' },
];
