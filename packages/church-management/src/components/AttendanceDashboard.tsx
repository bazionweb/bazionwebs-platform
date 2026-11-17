import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircleIcon, ClockIcon, UsersIcon, XCircleIcon, MaleIcon, FemaleIcon } from './Icons';
import { attendanceData } from './attendanceData';
import { Member } from './memberData';

const StatCard: React.FC<{
  title: string;
  value: string;
  percentage: string;
  icon: React.ElementType;
  color: string;
}> = ({ title, value, percentage, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: percentage }}></div>
      </div>
    </div>
    <div className={`p-2 rounded-lg ${color} text-white`}>
      <Icon className="h-5 w-5" />
    </div>
  </div>
);

interface AttendanceDashboardProps {
  setActivePage: (page: string) => void;
  attendanceRecords: typeof attendanceData;
  members: Member[];
  onViewDetails: (date: string, service: string) => void;
  onEdit: (date: string, service: string) => void;
  editContext: { date: string; service: string } | null;
  setEditContext: (context: { date: string; service: string } | null) => void;
  setActiveTab: (tab: string) => void;
}

const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  setActivePage,
  attendanceRecords,
  members,
  onViewDetails,
  onEdit,
  editContext,
  setEditContext,
  setActiveTab,
}) => {
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

  const [selectedService, setSelectedService] = useState('');

  useEffect(() => {
    if (editContext) {
      setSelectedDate(editContext.date);
    } else if (!selectedDate && uniqueDates.length > 0) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [editContext, uniqueDates]);

  useEffect(() => {
    if (editContext && selectedDate === editContext.date) {
      setSelectedService(editContext.service);
      setEditContext(null);
    } else {
      if (!servicesForDate.includes(selectedService)) {
        setSelectedService(servicesForDate[0] || '');
      }
    }
  }, [selectedDate, servicesForDate, editContext, setEditContext]);

  if (attendanceRecords.length === 0) {
    return (
      <div className="text-center p-12 bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700">No Attendance Records Found</h2>
        <p className="text-gray-500 mt-2">Go ahead and mark attendance for a service to see the dashboard.</p>
        <button
          onClick={() => setActivePage('Mark Attendance')}
          className="mt-4 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow hover:bg-green-700 transition-colors mx-auto"
        >
          <CheckCircleIcon className="h-5 w-5 mr-2" /> Mark Attendance
        </button>
      </div>
    );
  }

  const serviceRecords = attendanceRecords.filter(
    (rec) => rec.date === selectedDate && rec.service === selectedService,
  );

  const totalMarked = serviceRecords.length;
  const present = serviceRecords.filter((r) => r.status === 'Present').length;
  const absent = serviceRecords.filter((r) => r.status === 'Absent').length;
  const late = serviceRecords.filter((r) => r.status === 'Late').length;

  const activeMembers = members.filter((m) => m.status === 'Active').length;
  const totalMarkedPercentage = activeMembers > 0 ? `${Math.round((totalMarked / activeMembers) * 100)}%` : '0%';
  const presentPercentage = totalMarked > 0 ? `${Math.round((present / totalMarked) * 100)}%` : '0%';
  const absentPercentage = totalMarked > 0 ? `${Math.round((absent / totalMarked) * 100)}%` : '0%';
  const latePercentage = totalMarked > 0 ? `${Math.round((late / totalMarked) * 100)}%` : '0%';

  const { males, females } = serviceRecords.reduce(
    (acc, record) => {
      const member = members.find((m) => m.name.toLowerCase() === record.memberName.toLowerCase());
      if (member) {
        const genderStats = member.gender === 'Male' ? acc.males : acc.females;
        if (record.status === 'Present') genderStats.present++;
        else if (record.status === 'Absent') genderStats.absent++;
        else if (record.status === 'Late') genderStats.late++;
      }
      return acc;
    },
    {
      males: { present: 0, absent: 0, late: 0 },
      females: { present: 0, absent: 0, late: 0 },
    },
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
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
          <div className="md:col-span-2 flex justify-end space-x-2">
            <button
              onClick={() => onViewDetails(selectedDate, selectedService)}
              className="bg-blue-100 text-blue-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-blue-200"
              disabled={!selectedService}
            >
              Details
            </button>
            <button
              onClick={() => onEdit(selectedDate, selectedService)}
              className="bg-yellow-100 text-yellow-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-yellow-200"
              disabled={!selectedService}
            >
              Edit
            </button>
            <button
              onClick={() => setActivePage('Mark Attendance')}
              className="bg-purple-100 text-purple-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-purple-200"
            >
              Mark New
            </button>
          </div>
        </div>
      </div>

      {selectedService ? (
        <>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center justify-between">
              <span>
                Attendance Summary for {selectedService} on {new Date(selectedDate).toLocaleDateString()}
              </span>
              <span className="text-sm font-normal text-gray-500">
                {totalMarked} members marked out of {activeMembers} active members
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Marked"
                value={totalMarked.toString()}
                percentage={totalMarkedPercentage}
                icon={UsersIcon}
                color="bg-blue-500"
              />
              <StatCard
                title="Present"
                value={present.toString()}
                percentage={presentPercentage}
                icon={CheckCircleIcon}
                color="bg-green-500"
              />
              <StatCard
                title="Absent"
                value={absent.toString()}
                percentage={absentPercentage}
                icon={XCircleIcon}
                color="bg-red-500"
              />
              <StatCard
                title="Late"
                value={late.toString()}
                percentage={latePercentage}
                icon={ClockIcon}
                color="bg-yellow-500"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center justify-between">
              <span>Gender-based Attendance</span>
              <span className="text-sm font-normal text-gray-500">
                {males.present + males.absent + males.late} males / {females.present + females.absent + females.late}{' '}
                females
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="font-semibold text-gray-700 flex items-center mb-3">
                  <MaleIcon className="w-5 h-5 mr-2 text-blue-500" />
                  Male Attendance
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Present</span>
                    <span className="font-bold text-gray-700">
                      {males.present}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((males.present / (males.present + males.absent + males.late) || 0) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Absent</span>
                    <span className="font-bold text-gray-700">
                      {males.absent}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((males.absent / (males.present + males.absent + males.late) || 0) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Late</span>
                    <span className="font-bold text-gray-700">
                      {males.late}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((males.late / (males.present + males.absent + males.late) || 0) * 100)}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="font-semibold text-gray-700 flex items-center mb-3">
                  <FemaleIcon className="w-5 h-5 mr-2 text-pink-500" />
                  Female Attendance
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Present</span>
                    <span className="font-bold text-gray-700">
                      {females.present}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((females.present / (females.present + females.absent + females.late) || 0) * 100)}
                        %)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Absent</span>
                    <span className="font-bold text-gray-700">
                      {females.absent}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((females.absent / (females.present + females.absent + females.late) || 0) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Late</span>
                    <span className="font-bold text-gray-700">
                      {females.late}{' '}
                      <span className="text-xs text-gray-500 font-normal">
                        ({Math.round((females.late / (females.present + females.absent + females.late) || 0) * 100)}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-700">Department Attendance</h3>
              <button
                onClick={() => setActiveTab('Department View')}
                className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                View Department Breakdown
              </button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">
                Click the button to view detailed attendance statistics for each department from the selected service.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">No service selected or no records found for this date.</p>
        </div>
      )}
    </div>
  );
};

export default AttendanceDashboard;
