import React from 'react';
import {
  ReportsIcon,
  UsersIcon,
  AttendanceIcon,
  TrendingUpIcon,
  ArrowRightIcon,
  PieChartIcon,
  UserPlusIcon,
  GiftIcon,
  UserCheckIcon,
  CalendarIcon,
  SwitchHorizontalIcon,
  CurrencyDollarIcon,
} from './Icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Transaction } from './financeData';
import { AttendanceRecord } from './attendanceData';

interface ReportsPageProps {
  onGenerateClick: () => void;
  onViewReport: (reportId: string) => void;
  transactions: Transaction[];
  attendanceRecords: AttendanceRecord[];
}

const ReportCard: React.FC<{ title: string; icon: React.ElementType; color: string; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  color,
  children,
}) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <div className={`flex items-center p-6 ${color}`}>
      <div className="p-2 bg-white/20 rounded-lg mr-3">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </div>
);

const ReportLink: React.FC<{ text: string; onClick: () => void; icon: React.ElementType; iconClassName: string }> = ({
  text,
  onClick,
  icon: Icon,
  iconClassName,
}) => (
  <button
    onClick={onClick}
    className="w-full flex justify-between items-center text-gray-700 hover:bg-gray-50 px-4 py-3 rounded-lg transition-colors text-left group"
  >
    <div className="flex items-center">
      <Icon className={`h-5 w-5 mr-3 ${iconClassName}`} />
      <span className="font-medium group-hover:text-gray-900">{text}</span>
    </div>
    <ArrowRightIcon className="h-5 w-5 text-gray-400" />
  </button>
);

const ReportsPage: React.FC<ReportsPageProps> = ({
  onGenerateClick,
  onViewReport,
  transactions,
  attendanceRecords,
}) => {
  const attendanceChartData = React.useMemo(() => {
    const today = new Date();
    const monthLabels: { key: string; label: string }[] = [];
    const monthData: { [key: string]: number } = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      monthLabels.push({ key: monthKey, label: monthLabel });
      monthData[monthKey] = 0;
    }

    attendanceRecords.forEach((record) => {
      const recordDate = new Date(record.date);
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      if (recordDate >= sixMonthsAgo && (record.status === 'Present' || record.status === 'Late')) {
        const recordMonthKey = `${recordDate.getFullYear()}-${recordDate.getMonth()}`;
        if (Object.prototype.hasOwnProperty.call(monthData, recordMonthKey)) {
          monthData[recordMonthKey]++;
        }
      }
    });

    return monthLabels.map((m) => ({ name: m.label, attendance: monthData[m.key] }));
  }, [attendanceRecords]);

  const financeChartData = React.useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const categoryData = transactions
      .filter(
        (t) =>
          t.type === 'Income' &&
          new Date(t.date).getMonth() === currentMonth &&
          new Date(t.date).getFullYear() === currentYear,
      )
      .reduce(
        (acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

    return Object.entries(categoryData).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 left-0 w-48 h-48 bg-green-200 rounded-full opacity-20 -translate-x-1/2 -translate-y-1/2 filter blur-2xl"></div>
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-200 rounded-full opacity-20 translate-x-1/2 translate-y-1/2 filter blur-2xl"></div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="mt-1 text-gray-600">Generate and analyze various church data reports.</p>
        </div>
        <button
          onClick={onGenerateClick}
          className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow"
        >
          <ReportsIcon className="h-5 w-5 mr-2" />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportCard title="Member Reports" icon={UsersIcon} color="bg-blue-500">
          <ReportLink
            text="New members this month"
            onClick={() => onViewReport('members_new')}
            icon={UserPlusIcon}
            iconClassName="text-blue-500"
          />
          <ReportLink
            text="Birthdays this month"
            onClick={() => onViewReport('members_birthdays')}
            icon={GiftIcon}
            iconClassName="text-blue-500"
          />
          <ReportLink
            text="Members by department"
            onClick={() => onViewReport('members_by_dept')}
            icon={UsersIcon}
            iconClassName="text-blue-500"
          />
          <ReportLink
            text="Members by status"
            onClick={() => onViewReport('members_by_status')}
            icon={UserCheckIcon}
            iconClassName="text-blue-500"
          />
        </ReportCard>
        <ReportCard title="Attendance Reports" icon={AttendanceIcon} color="bg-green-500">
          <ReportLink
            text="Weekly attendance"
            onClick={() => onViewReport('attendance_weekly')}
            icon={CalendarIcon}
            iconClassName="text-green-500"
          />
          <ReportLink
            text="Monthly attendance"
            onClick={() => onViewReport('attendance_monthly')}
            icon={CalendarIcon}
            iconClassName="text-green-500"
          />
          <ReportLink
            text="Attendance by service"
            onClick={() => onViewReport('attendance_by_service')}
            icon={TrendingUpIcon}
            iconClassName="text-green-500"
          />
          <ReportLink
            text="Attendance comparison"
            onClick={() => onViewReport('attendance_comparison')}
            icon={SwitchHorizontalIcon}
            iconClassName="text-green-500"
          />
        </ReportCard>
        <ReportCard title="Finance Reports" icon={TrendingUpIcon} color="bg-amber-500">
          <ReportLink
            text="Monthly income & expenses"
            onClick={() => onViewReport('finance_monthly')}
            icon={CalendarIcon}
            iconClassName="text-amber-500"
          />
          <ReportLink
            text="Income by category"
            onClick={() => onViewReport('finance_income_category')}
            icon={CurrencyDollarIcon}
            iconClassName="text-amber-500"
          />
          <ReportLink
            text="Yearly financial summary"
            onClick={() => onViewReport('finance_yearly')}
            icon={PieChartIcon}
            iconClassName="text-amber-500"
          />
        </ReportCard>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-purple-500 p-6 flex items-center text-white">
          <div className="p-2 bg-white/20 rounded-lg mr-3">
            <PieChartIcon className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold">Data Visualization</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-4 text-gray-700">Attendance Trends</h4>
            {attendanceChartData.some((d) => d.attendance > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={attendanceChartData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="attendance"
                    name="Total Attended"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
                No attendance data for the last 6 months
              </div>
            )}
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-700">Financial Overview</h4>
            {financeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={financeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                  >
                    {financeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `KSH ${value.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
                No income data for this month
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
