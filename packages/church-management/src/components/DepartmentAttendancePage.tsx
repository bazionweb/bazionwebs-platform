import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowLeftIcon, UsersIcon, CheckCircleIcon } from './Icons';
import { attendanceData } from './attendanceData';
import { Member } from './memberData';

interface DepartmentAttendancePageProps {
  onBack: () => void;
  attendanceRecords: typeof attendanceData;
  members: Member[];
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
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

const DepartmentAttendancePage: React.FC<DepartmentAttendancePageProps> = ({ onBack, attendanceRecords, members }) => {
  const uniqueDates = useMemo(
    () =>
      [...new Set(attendanceRecords.map((r) => r.date))].sort(
        (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime(),
      ),
    [attendanceRecords],
  );
  const [selectedDate, setSelectedDate] = useState(uniqueDates[0] || '');

  const servicesForDate = useMemo(
    () => [...new Set(attendanceRecords.filter((r) => r.date === selectedDate).map((r) => r.service))],
    [attendanceRecords, selectedDate],
  );
  const [selectedService, setSelectedService] = useState(servicesForDate[0] || '');

  useEffect(() => {
    if (!servicesForDate.includes(selectedService)) {
      setSelectedService(servicesForDate[0] || '');
    }
  }, [selectedDate, servicesForDate]);

  if (attendanceRecords.length === 0) {
    return (
      <div className="text-center p-12 bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700">No Attendance Records to Display</h2>
        <button
          onClick={onBack}
          className="mt-4 flex items-center text-sm text-purple-600 hover:underline font-semibold mx-auto"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Attendance Dashboard
        </button>
      </div>
    );
  }

  const serviceRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => rec.service === selectedService && rec.date === selectedDate);
  }, [attendanceRecords, selectedService, selectedDate]);

  const departments = useMemo(() => {
    const allDepartmentNames = [...new Set(members.map((m) => m.department))].filter((d) => d && d !== 'None');
    const departmentColors = [
      'bg-red-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
      'bg-gray-500',
      'bg-lime-500',
    ];

    return allDepartmentNames
      .map((deptName, index) => {
        const departmentMembers = members.filter((m) => m.department === deptName);
        const totalInDept = departmentMembers.length;

        const departmentRecords = serviceRecords.filter((r) =>
          departmentMembers.some((m) => m.name.toLowerCase() === r.memberName.toLowerCase()),
        );

        const present = departmentRecords.filter((r) => r.status === 'Present').length;
        const late = departmentRecords.filter((r) => r.status === 'Late').length;
        const attended = present + late;

        const absent = totalInDept - attended;

        return {
          name: deptName,
          total: totalInDept,
          present,
          absent,
          late,
          attended,
          attendanceRate: totalInDept > 0 ? Math.round((attended / totalInDept) * 100) : 0,
          color: departmentColors[index % departmentColors.length],
        };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [serviceRecords, members]);

  const overallStats = useMemo(() => {
    const totalMarked = serviceRecords.length;
    const totalAttended = serviceRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    const bestDept = departments.length > 0 ? departments[0] : null;
    return {
      totalMarked,
      totalAttended,
      overallRate: totalMarked > 0 ? `${Math.round((totalAttended / totalMarked) * 100)}%` : '0%',
      bestDeptName: bestDept ? bestDept.name : 'N/A',
      bestDeptRate: bestDept ? `${bestDept.attendanceRate}%` : 'N/A',
    };
  }, [serviceRecords, departments]);

  const chartData = departments.map((d) => ({ name: d.name, 'Attendance Rate': d.attendanceRate }));

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Department Attendance Statistics</h1>
            <p className="mt-1 text-gray-600">
              Select a service to view its detailed attendance breakdown by department.
            </p>
          </div>
          <button onClick={onBack} className="flex items-center text-sm text-purple-600 hover:underline font-semibold">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Attendance Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h3 className="text-md font-semibold text-gray-700 mb-2">Service Filter</h3>
        <div className="flex gap-4">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm"
          >
            {uniqueDates.map((date) => (
              <option key={date} value={date}>
                {new Date(date).toDateString()}
              </option>
            ))}
          </select>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm"
            disabled={!selectedDate}
          >
            {servicesForDate.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
            {servicesForDate.length === 0 && <option>No services on this date</option>}
          </select>
        </div>
      </div>

      {serviceRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Overall Attendance"
              value={overallStats.overallRate}
              icon={CheckCircleIcon}
              color="bg-emerald-500"
            />
            <StatCard
              title="Total Attended"
              value={`${overallStats.totalAttended} / ${overallStats.totalMarked}`}
              icon={UsersIcon}
              color="bg-blue-500"
            />
            <StatCard
              title="Best Performing Dept."
              value={overallStats.bestDeptName}
              icon={UsersIcon}
              color="bg-purple-500"
            />
            <StatCard
              title="Best Dept. Rate"
              value={overallStats.bestDeptRate}
              icon={CheckCircleIcon}
              color="bg-pink-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-700">Department Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">
                        Department
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Total Members
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Present / Late
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Absent
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Attendance Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.name} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{dept.name}</td>
                        <td className="px-6 py-4 text-center">{dept.total}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-green-600 font-semibold">{dept.present}</span> /{' '}
                          <span className="text-yellow-600 font-semibold">{dept.late}</span>
                        </td>
                        <td className="px-6 py-4 text-center text-red-600 font-semibold">{dept.absent}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                              <div
                                className="bg-green-500 h-2.5 rounded-full"
                                style={{ width: `${dept.attendanceRate}%` }}
                              ></div>
                            </div>
                            <span className="font-semibold text-gray-700">{dept.attendanceRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Attendance Rate Comparison</h3>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip cursor={{ fill: 'rgba(239, 246, 255, 0.7)' }} />
                    <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                    <Bar dataKey="Attendance Rate" fill="#10b981" barSize={20} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center p-12 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-700">No Data Available</h2>
          <p className="text-gray-500 mt-2">
            There are no attendance records for the selected service. Please choose another date or service.
          </p>
        </div>
      )}
    </div>
  );
};

export default DepartmentAttendancePage;
