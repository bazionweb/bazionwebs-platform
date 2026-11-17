import React, { useState, useMemo } from 'react';
import { TrendingUpIcon, UsersIcon, CheckCircleIcon } from './Icons';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { attendanceData } from './attendanceData';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType }> = ({
  title,
  value,
  icon: Icon,
}) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center">
    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const AttendancePatternsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState(90); // Default to 90 days (3 months)

  const filteredRecords = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - timeRange);
    return attendanceData.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }, [timeRange]);

  const chartData = useMemo(() => {
    const weeks: { [key: string]: number } = {};
    filteredRecords.forEach((record) => {
      if (record.status === 'Present' || record.status === 'Late') {
        const d = new Date(record.date);
        const dayOfWeek = d.getDay();
        const sunday = new Date(d.setDate(d.getDate() - dayOfWeek));
        const weekKey = sunday.toISOString().split('T')[0];
        if (!weeks[weekKey]) {
          weeks[weekKey] = 0;
        }
        weeks[weekKey]++;
      }
    });
    return Object.keys(weeks)
      .map((week) => ({
        name: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Attendance: weeks[week],
      }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [filteredRecords]);

  const totalAttendance = filteredRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const totalServices = new Set(filteredRecords.map((r) => `${r.date}-${r.service}`)).size;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Attendance Patterns</h2>
          <p className="text-sm text-gray-500">Analyze attendance trends over various periods.</p>
        </div>
        <div className="flex space-x-2">
          {[30, 90, 180].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${timeRange === days ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Last {days / 30} Month{days > 30 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Attendance" value={totalAttendance.toString()} icon={UsersIcon} />
            <StatCard title="Services Held" value={totalServices.toString()} icon={CheckCircleIcon} />
            <StatCard
              title="Avg. per Service"
              value={totalServices > 0 ? (totalAttendance / totalServices).toFixed(1) : '0'}
              icon={TrendingUpIcon}
            />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Weekly Attendance Trend</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Line
                    type="monotone"
                    dataKey="Attendance"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-12 text-center rounded-lg shadow-sm">
          <div className="inline-block bg-blue-100 p-4 rounded-full mb-4">
            <TrendingUpIcon className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700">Not Enough Data</h2>
          <p className="text-gray-500 mt-2">There is no attendance data for the selected period.</p>
        </div>
      )}
    </div>
  );
};

export default AttendancePatternsPage;
