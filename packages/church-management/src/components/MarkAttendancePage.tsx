import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from './Icons';
import { Member } from './memberData';
import type { AttendanceStatus, AttendanceRecord } from './attendanceData';

interface MarkAttendancePageProps {
  onBack: () => void;
  onSave: (attendance: Record<string, AttendanceStatus>, serviceName: string, serviceDate: string) => void;
  editContext: { date: string; service: string } | null;
  allAttendanceRecords: AttendanceRecord[];
  members: Member[];
}

const departments = [
  'Choir',
  'Media',
  'Ushering',
  'Protocol',
  'Welfare',
  'Intercessors',
  'Junior Youth',
  'Youth',
  'Traffic',
  'Administration',
  'Instrumentalist',
  'Deacon',
  'Sunday School',
  'Pastoral Care',
  'Evangelism',
  'Technical',
];
const statuses = ['Active', 'Inactive', 'Transferred'];
const ageGroups = ['Children/Sunday School', 'Junior Youth', 'Youth', 'Adult'];
const serviceTypes = ['Sunday Morning Service', 'Sunday Second Service', 'Mid-week Service', 'Other'];

const MarkAttendancePage: React.FC<MarkAttendancePageProps> = ({
  onBack,
  onSave,
  editContext,
  allAttendanceRecords,
  members,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [status, setStatus] = useState('All Statuses');
  const [ageGroup, setAgeGroup] = useState('All Age Groups');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceName, setServiceName] = useState('Sunday Morning Service');
  const [customServiceName, setCustomServiceName] = useState('');

  useEffect(() => {
    if (editContext) {
      setServiceDate(editContext.date);

      if (serviceTypes.includes(editContext.service)) {
        setServiceName(editContext.service);
      } else {
        setServiceName('Other');
        setCustomServiceName(editContext.service);
      }

      const recordsForService = allAttendanceRecords.filter(
        (r) => r.date === editContext.date && r.service === editContext.service,
      );

      const initialAttendance = recordsForService.reduce(
        (acc, record) => {
          const member = members.find((m) => m.name.toLowerCase() === record.memberName.toLowerCase());
          if (member) {
            const key = member.id || member.email || member.name.toLowerCase().replace(/\s+/g, '_');
            acc[key] = record.status;
          }
          return acc;
        },
        {} as Record<string, AttendanceStatus>,
      );
      setAttendance(initialAttendance);
    } else {
      const defaultAttendance = members.reduce(
        (acc, member) => {
          const key = getMemberKey(member);
          acc[key] = 'Absent';
          return acc;
        },
        {} as Record<string, AttendanceStatus>,
      );
      setAttendance(defaultAttendance);
    }
  }, [editContext, allAttendanceRecords, members]);

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = department === 'All Departments' || member.department === department;
    const matchesStatus = status === 'All Statuses' || member.status === status;
    const matchesAgeGroup = ageGroup === 'All Age Groups' || (member.ageGroup || 'Adult') === ageGroup;
    return matchesSearch && matchesDept && matchesStatus && matchesAgeGroup;
  });

  const getInitial = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const getMemberKey = (member: Member): string => {
    return member.id || member.email || member.name.toLowerCase().replace(/\s+/g, '_');
  };

  const handleSetStatus = (memberKey: string, newStatus: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [memberKey]: newStatus }));
  };

  const handleSelect = (memberKey: string) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberKey)) newSet.delete(memberKey);
      else newSet.add(memberKey);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === filteredMembers.length) {
      setSelected(new Set()); // Deselect all
    } else {
      setSelected(new Set(filteredMembers.map((m) => getMemberKey(m)))); // Select all
    }
  };

  const handleSave = () => {
    const finalServiceName = serviceName === 'Other' ? customServiceName : serviceName;
    if (finalServiceName && serviceDate) {
      onSave(attendance, finalServiceName, serviceDate);
    } else {
      alert('Please select a service and date before saving.');
    }
  };

  const markedCount = Object.keys(attendance).length;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-100 text-gray-800 shadow">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{editContext ? 'Edit' : 'Member'} Attendance</h1>
          <button onClick={onBack} className="flex items-center text-sm text-purple-600 hover:underline font-semibold">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Attendance Dashboard
          </button>
        </div>
        <p className="mt-1 text-gray-600">
          {editContext
            ? `Editing attendance for ${editContext.service} on ${new Date(editContext.date).toDateString()}`
            : 'Select a service and date, then search, filter, and mark member attendance.'}
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Service Date</label>
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Service Type</label>
            <select
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
            >
              {serviceTypes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {serviceName === 'Other' && (
            <div>
              <label className="text-sm font-medium text-gray-700">Custom Service Name</label>
              <input
                type="text"
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="e.g., Revival Night"
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Filter Panel */}
        <div className="w-full lg:w-1/4">
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
            <h3 className="font-semibold border-b pb-2">Filter Members</h3>
            <div>
              <label className="text-sm font-medium text-gray-700">Search by Name</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter member name..."
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm capitalize"
              >
                <option>All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d} className="capitalize">
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Member Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              >
                <option>All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Age Group</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              >
                <option>All Age Groups</option>
                {ageGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
              <p className="font-bold mb-1">Quick Tips</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>First, select the service date and type above.</li>
                <li>Use filters to find members quickly.</li>
                <li>Click a row to select/deselect members.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Member List */}
        <div className="w-full lg:w-3/4">
          {/* ── Attendance Summary Indicator ── */}
          {(() => {
            const presentCount = Object.values(attendance).filter((s) => s === 'Present').length;
            const lateCount = Object.values(attendance).filter((s) => s === 'Late').length;
            const absentCount = Object.values(attendance).filter((s) => s === 'Absent').length;
            const totalCount = Object.keys(attendance).length;
            return (
              <div className="grid grid-cols-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm mb-4">
                {/* Present */}
                <div className="bg-green-50 px-4 py-3 border-r border-gray-200">
                  <p className="text-xs font-semibold tracking-widest text-green-700 uppercase">Present</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{presentCount}</p>
                </div>
                {/* Late */}
                <div className="bg-amber-50 px-4 py-3 border-r border-gray-200">
                  <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">Late</p>
                  <p className="text-3xl font-bold text-amber-500 mt-1">{lateCount}</p>
                </div>
                {/* Absent */}
                <div className="bg-red-50 px-4 py-3 border-r border-gray-200">
                  <p className="text-xs font-semibold tracking-widest text-red-600 uppercase">Absent</p>
                  <p className="text-3xl font-bold text-red-500 mt-1">{absentCount}</p>
                </div>
                {/* Total Class */}
                <div className="bg-indigo-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">Total Class</p>
                  <p className="text-3xl font-bold text-indigo-500 mt-1">{totalCount}</p>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b space-y-3">
              <div className="flex justify-between items-center">
                <div className="font-semibold">
                  {filteredMembers.length} Church Members
                  <span className="ml-2 font-normal text-gray-600 bg-gray-100 py-1 px-2 rounded-md text-xs">
                    {markedCount} marked
                  </span>
                </div>
                <div>
                  <span className="bg-green-100 text-green-800 font-bold py-1 px-2 rounded-md text-sm">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="ml-2 bg-blue-500 text-white py-1 px-3 rounded-md text-sm hover:bg-blue-600"
                  >
                    {selected.size === filteredMembers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div>Present
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-1.5"></div>Absent
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 mr-1.5"></div>Late
                </span>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm relative">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="py-2 px-4 w-12 bg-gray-50"></th>
                    <th className="py-2 px-4 text-left bg-gray-50">Member</th>
                    <th className="py-2 px-4 text-left bg-gray-50">Department</th>
                    <th className="py-2 px-4 text-left bg-gray-50">Mark Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const memberKey = getMemberKey(member);
                    return (
                      <tr
                        key={memberKey}
                        className={`border-b hover:bg-gray-50 cursor-pointer ${selected.has(memberKey) ? 'bg-blue-50' : ''}`}
                        onClick={() => handleSelect(memberKey)}
                      >
                        <td className="py-2 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(memberKey)}
                            onChange={() => {}}
                            className="rounded"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs mr-3">
                              {getInitial(member.name)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 capitalize">{member.name}</p>
                              {member.phone && <p className="text-xs text-gray-500">{member.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <span className="bg-gray-200 py-0.5 px-2 rounded-full text-xs font-medium">
                            {member.department}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleSetStatus(memberKey, 'Present')}
                              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center ${attendance[memberKey] === 'Present' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}
                            >
                              <CheckCircleIcon className="w-4 h-4 mr-1" />
                              Present
                            </button>
                            <button
                              onClick={() => handleSetStatus(memberKey, 'Absent')}
                              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center ${attendance[memberKey] === 'Absent' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}
                            >
                              <XCircleIcon className="w-4 h-4 mr-1" />
                              Absent
                            </button>
                            <button
                              onClick={() => handleSetStatus(memberKey, 'Late')}
                              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center ${attendance[memberKey] === 'Late' ? 'bg-yellow-400 text-white' : 'bg-yellow-100 text-yellow-700'}`}
                            >
                              <ClockIcon className="w-4 h-4 mr-1" />
                              Late
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={handleSave}
                className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkAttendancePage;
