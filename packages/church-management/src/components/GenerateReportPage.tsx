import React, { useMemo, useState } from 'react';
import { ArrowLeftIcon, UsersIcon, CheckCircleIcon, CurrencyDollarIcon, UserPlusIcon, ReportsIcon } from './Icons';
import { Member } from './memberData';
import { Transaction } from './financeData';
import { AttendanceRecord } from './attendanceData';

interface GenerateReportPageProps {
  onBack: () => void;
  members: Member[];
  transactions: Transaction[];
  attendanceRecords: AttendanceRecord[];
  onGenerate: (config: { type: string; start?: string; end?: string }) => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center">
    <div className={`p-3 rounded-lg mr-4 ${color}`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const GenerateReportPage: React.FC<GenerateReportPageProps> = ({
  onBack,
  members,
  transactions,
  attendanceRecords,
  onGenerate,
}) => {
  const [reportType, setReportType] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const stats = useMemo(() => {
    const totalMembers = members.length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newMembersCount = members.filter((m) => new Date(m.dateAdded) >= thirtyDaysAgo).length;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyIncome = transactions
      .filter(
        (t) =>
          t.type === 'Income' &&
          new Date(t.date).getMonth() === currentMonth &&
          new Date(t.date).getFullYear() === currentYear,
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const mostRecentServiceDate =
      attendanceRecords.length > 0
        ? [...new Set(attendanceRecords.map((r) => r.date))].sort(
            (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime(),
          )[0]
        : null;

    const lastSundayAttendance = mostRecentServiceDate
      ? attendanceRecords.filter(
          (r) => r.date === mostRecentServiceDate && (r.status === 'Present' || r.status === 'Late'),
        ).length
      : 0;

    return { totalMembers, newMembersCount, monthlyIncome, lastSundayAttendance };
  }, [members, transactions, attendanceRecords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportType) {
      alert('Please select a report type.');
      return;
    }
    onGenerate({ type: reportType, start: startDate, end: endDate });
  };

  return (
    <div className="space-y-6 relative">
      <div className="absolute -top-10 right-0 w-64 h-64 bg-green-200 rounded-full opacity-20 translate-x-1/2 -translate-y-1/2 filter blur-3xl"></div>
      <div className="absolute -bottom-10 left-0 w-64 h-64 bg-yellow-200 rounded-full opacity-20 -translate-x-1/2 translate-y-1/2 filter blur-3xl"></div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Generate Custom Report</h1>
          <p className="mt-1 text-gray-600">Generate and analyze church data reports.</p>
        </div>
        <button
          onClick={onBack}
          className="bg-white border text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center shadow-sm hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Reports
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Members" value={stats.totalMembers.toString()} icon={UsersIcon} color="bg-blue-500" />
        <StatCard
          title="Last Sunday Attendance"
          value={stats.lastSundayAttendance.toString()}
          icon={CheckCircleIcon}
          color="bg-green-500"
        />
        <StatCard
          title="Monthly Income"
          value={`KSH ${stats.monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={CurrencyDollarIcon}
          color="bg-yellow-500"
        />
        <StatCard
          title="New Members (30 days)"
          value={stats.newMembersCount.toString()}
          icon={UserPlusIcon}
          color="bg-purple-500"
        />
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Generate Custom Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type *</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              required
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="" disabled hidden>
                Select Report Type
              </option>
              <option value="Member List">Member List</option>
              <option value="Attendance Summary">Attendance Summary</option>
              <option value="Financial Statement">Financial Statement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full py-2 px-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full py-2 px-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="bg-church-green hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center"
          >
            <ReportsIcon className="h-5 w-5 mr-2" />
            Generate Report
          </button>
        </div>
      </form>

      <div className="flex space-x-2">
        <button
          onClick={() => onGenerate({ type: 'Member List' })}
          className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow"
        >
          <UsersIcon className="h-5 w-5 mr-2" />
          All Members Report
        </button>
        <button
          onClick={() => onGenerate({ type: 'Attendance Summary' })}
          className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow"
        >
          <CheckCircleIcon className="h-5 w-5 mr-2" />
          All Attendance Report
        </button>
        <button
          onClick={() => onGenerate({ type: 'Financial Statement' })}
          className="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow"
        >
          <CurrencyDollarIcon className="h-5 w-5 mr-2" />
          All Finances Report
        </button>
      </div>
    </div>
  );
};

export default GenerateReportPage;
