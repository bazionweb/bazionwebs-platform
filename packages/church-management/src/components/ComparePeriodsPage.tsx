import React, { useState, useMemo } from 'react';

import { attendanceData } from './attendanceData';

const calculateStats = (records: typeof attendanceData) => {
  if (records.length === 0) {
    return { total: 0, present: 0, absent: 0, late: 0, services: 0, avg: '0.0' };
  }
  const present = records.filter((r) => r.status === 'Present').length;
  const late = records.filter((r) => r.status === 'Late').length;
  const absent = records.filter((r) => r.status === 'Absent').length;
  const services = new Set(records.map((r) => `${r.date}-${r.service}`)).size;
  const total = present + late;
  const avg = services > 0 ? (total / services).toFixed(1) : '0.0';
  return { total, present, absent, late, services, avg };
};

const StatDisplay: React.FC<{ title: string; value: string | number; change?: number }> = ({
  title,
  value,
  change,
}) => (
  <div className="flex justify-between items-center py-2 border-b">
    <p className="text-gray-600">{title}</p>
    <div className="flex items-center">
      <p className="font-bold text-gray-800">{value}</p>
      {change !== undefined && !isNaN(change) && (
        <span
          className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          {change >= 0 ? '+' : ''}
          {change.toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

const ComparePeriodsPage: React.FC = () => {
  const lastMonthEnd = new Date(new Date().setDate(0)).toISOString().split('T')[0];
  const lastMonthStart = new Date(new Date(lastMonthEnd).setDate(1)).toISOString().split('T')[0];

  const [periodA, setPeriodA] = useState({ start: lastMonthStart, end: lastMonthEnd });
  const [periodB, setPeriodB] = useState({ start: '', end: '' });

  const statsA = useMemo(() => {
    if (!periodA.start || !periodA.end) return calculateStats([]);
    const records = attendanceData.filter((r) => r.date >= periodA.start && r.date <= periodA.end);
    return calculateStats(records);
  }, [periodA]);

  const statsB = useMemo(() => {
    if (!periodB.start || !periodB.end) return null;
    const records = attendanceData.filter((r) => r.date >= periodB.start && r.date <= periodB.end);
    return calculateStats(records);
  }, [periodB]);

  const getChange = (valA: number, valB: number) => {
    if (valA === 0) return valB > 0 ? Infinity : 0;
    return ((valB - valA) / valA) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Compare Attendance Periods</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select two date ranges to compare attendance statistics side-by-side.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2 text-gray-600">Period A (Base)</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={periodA.start}
                onChange={(e) => setPeriodA({ ...periodA, start: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="date"
                value={periodA.end}
                onChange={(e) => setPeriodA({ ...periodA, end: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-gray-600">Period B (Comparison)</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={periodB.start}
                onChange={(e) => setPeriodB({ ...periodB, start: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="date"
                value={periodB.end}
                onChange={(e) => setPeriodB({ ...periodB, end: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Period A Results</h3>
          <StatDisplay title="Total Attendance" value={statsA.total} />
          <StatDisplay title="Services Held" value={statsA.services} />
          <StatDisplay title="Average per Service" value={statsA.avg} />
          <StatDisplay title="Present" value={statsA.present} />
          <StatDisplay title="Late" value={statsA.late} />
          <StatDisplay title="Absent" value={statsA.absent} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Period B vs. Period A</h3>
          {statsB ? (
            <>
              <StatDisplay
                title="Total Attendance"
                value={statsB.total}
                change={getChange(statsA.total, statsB.total)}
              />
              <StatDisplay
                title="Services Held"
                value={statsB.services}
                change={getChange(statsA.services, statsB.services)}
              />
              <StatDisplay
                title="Average per Service"
                value={statsB.avg}
                change={getChange(parseFloat(statsA.avg), parseFloat(statsB.avg))}
              />
              <StatDisplay title="Present" value={statsB.present} change={getChange(statsA.present, statsB.present)} />
              <StatDisplay title="Late" value={statsB.late} change={getChange(statsA.late, statsB.late)} />
              <StatDisplay title="Absent" value={statsB.absent} change={getChange(statsA.absent, statsB.absent)} />
            </>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p>Select a date range for Period B to see comparison.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparePeriodsPage;
