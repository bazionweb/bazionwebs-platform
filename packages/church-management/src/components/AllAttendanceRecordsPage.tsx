import React, { useState, useMemo } from 'react';
import { CheckCircleIcon } from './Icons';
import type { AttendanceRecord, AttendanceStatus } from './attendanceData';
import ActionButtons from './ActionButtons';

interface AllAttendanceRecordsPageProps {
  setActivePage: (page: string) => void;
  attendanceRecords: AttendanceRecord[];
  onEdit: (date: string, service: string) => void;
  onDelete: (id: number) => void;
}

const AllAttendanceRecordsPage: React.FC<AllAttendanceRecordsPageProps> = ({
  setActivePage,
  attendanceRecords,
  onEdit,
  onDelete,
}) => {
  const [filterService, setFilterService] = useState('All Services');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'All Statuses'>('All Statuses');

  const uniqueServices = useMemo(
    () => ['All Services', ...new Set(attendanceRecords.map((r) => r.service))],
    [attendanceRecords],
  );
  const allStatuses: (AttendanceStatus | 'All Statuses')[] = ['All Statuses', 'Present', 'Absent', 'Late'];

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const serviceMatch = filterService === 'All Services' || record.service === filterService;
      const dateMatch = !filterDate || record.date === filterDate;
      const statusMatch = filterStatus === 'All Statuses' || record.status === filterStatus;
      return serviceMatch && dateMatch && statusMatch;
    });
  }, [attendanceRecords, filterService, filterDate, filterStatus]);

  const handleReset = () => {
    setFilterService('All Services');
    setFilterDate('');
    setFilterStatus('All Statuses');
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Present':
        return (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
        );
      case 'Absent':
        return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
      case 'Late':
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
        );
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">All Attendance Records</h1>
            <p className="mt-1 text-gray-600">View, filter, and manage all historical attendance records.</p>
          </div>
          <button
            onClick={() => setActivePage('Mark Attendance')}
            className="bg-white text-green-600 font-semibold py-2 px-4 rounded-lg flex items-center shadow border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <CheckCircleIcon className="h-5 w-5 mr-2" /> Mark New Attendance
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">All Services</label>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              >
                {uniqueServices.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">All Statuses</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AttendanceStatus | 'All Statuses')}
                className="w-full mt-1 border-gray-300 rounded-md shadow-sm"
              >
                {allStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleReset}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-semibold"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <p>{filteredRecords.length} records found</p>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-500 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Service
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Member
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(record.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{record.service}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 capitalize">{record.memberName}</td>
                  <td className="px-6 py-4">{getStatusChip(record.status)}</td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      onEdit={() => onEdit(record.date, record.service)}
                      onDelete={() => onDelete(record.id)}
                      itemName={`${record.memberName} - ${record.service}`}
                      itemType="Attendance Record"
                      itemDetails={{
                        Member: record.memberName,
                        Date: new Date(record.date).toLocaleDateString(),
                        Service: record.service,
                        Status: record.status,
                      }}
                      size="sm"
                      variant="icon"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No records match your filter criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllAttendanceRecordsPage;
