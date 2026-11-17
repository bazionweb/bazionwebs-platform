import React, { useState, useMemo } from 'react';
import { ReportsIcon, CalendarIcon, UsersIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from './Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { attendanceData } from './attendanceData';

// Helper to get week start (Sunday) and end (Saturday)
const getWeekRange = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize time
  const day = d.getDay();
  const diffToSunday = d.getDate() - day;

  const weekStart = new Date(new Date(d).setDate(diffToSunday));
  const weekEnd = new Date(new Date(weekStart).setDate(weekStart.getDate() + 6));
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
};

const StatCard: React.FC<{ title: string; value: string; color: string; icon: React.ElementType }> = ({
  title,
  value,
  color,
  icon: Icon,
}) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center">
    <div className={`p-3 rounded-lg ${color} text-white mr-4`}>
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const WeeklyReportsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { weekStart, weekEnd } = useMemo(() => getWeekRange(new Date(selectedDate)), [selectedDate]);

  const weeklyRecords = useMemo(() => {
    return attendanceData.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= weekStart && recordDate <= weekEnd;
    });
  }, [weekStart, weekEnd]);

  const stats = useMemo(() => {
    if (weeklyRecords.length === 0) {
      return { total: 0, present: 0, absent: 0, late: 0, services: 0, avg: '0' };
    }
    const present = weeklyRecords.filter((r) => r.status === 'Present').length;
    const late = weeklyRecords.filter((r) => r.status === 'Late').length;
    const absent = weeklyRecords.filter((r) => r.status === 'Absent').length;
    const uniqueServices = new Set(weeklyRecords.map((r) => `${r.date}-${r.service}`)).size;

    return {
      total: present + late,
      present,
      absent,
      late,
      services: uniqueServices,
      avg: uniqueServices > 0 ? ((present + late) / uniqueServices).toFixed(1) : '0',
    };
  }, [weeklyRecords]);

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map((day) => ({ name: day, Attended: 0 }));
    weeklyRecords.forEach((record) => {
      if (record.status === 'Present' || record.status === 'Late') {
        const dayIndex = new Date(record.date).getDay();
        data[dayIndex].Attended++;
      }
    });
    return data;
  }, [weeklyRecords]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Weekly Attendance Report</h2>
          <p className="text-sm text-gray-500">
            {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
          </p>
        </div>
        <div className="relative">
          <CalendarIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {weeklyRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Total Attended" value={stats.total.toString()} icon={UsersIcon} color="bg-blue-500" />
            <StatCard title="Present" value={stats.present.toString()} icon={CheckCircleIcon} color="bg-green-500" />
            <StatCard title="Late" value={stats.late.toString()} icon={ClockIcon} color="bg-yellow-500" />
            <StatCard title="Absent" value={stats.absent.toString()} icon={XCircleIcon} color="bg-red-500" />
            <StatCard title="Avg. Per Service" value={stats.avg} icon={ReportsIcon} color="bg-purple-500" />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Daily Attendance Breakdown</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'rgba(239, 246, 255, 0.5)' }} />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Bar dataKey="Attended" fill="#10b981" barSize={40} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-12 text-center rounded-lg shadow-sm">
          <div className="inline-block bg-green-100 p-4 rounded-full mb-4">
            <ReportsIcon className="w-10 h-10 text-church-green" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700">No Records Found</h2>
          <p className="text-gray-500 mt-2">
            There is no attendance data for the selected week. Please pick another date.
          </p>
        </div>
      )}
    </div>
  );
};

export default WeeklyReportsPage;
