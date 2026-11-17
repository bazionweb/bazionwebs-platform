import React, { useState } from 'react';
import AttendanceDashboard from './AttendanceDashboard';
import AllAttendanceRecordsPage from './AllAttendanceRecordsPage';
import ServiceDetailsPage from './ServiceDetailsPage';
import WeeklyReportsPage from './WeeklyReportsPage';
import AttendancePatternsPage from './AttendancePatternsPage';
import ComparePeriodsPage from './ComparePeriodsPage';
import GoalsPage from './GoalsPage';
import RemindersPage from './RemindersPage';
import DepartmentAttendancePage from './DepartmentAttendancePage';
import { attendanceData } from './attendanceData';
import { Member } from './memberData';
import { CheckCircleIcon } from './Icons';
import { useTheme } from './ThemeContext';

interface AttendanceModuleProps {
  setActivePage: (page: string) => void;
  members: Member[];
  editContext: { date: string; service: string } | null;
  setEditContext: (context: { date: string; service: string } | null) => void;
  attendanceRecords: typeof attendanceData;
  onEditAttendanceRecord: (date: string, service: string) => void;
  onDeleteAttendanceRecord: (id: number) => void;
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  setActivePage,
  members,
  editContext,
  setEditContext,
  attendanceRecords,
  onEditAttendanceRecord,
  onDeleteAttendanceRecord,
}) => {
  const { modeColors } = useTheme();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [view, setView] = useState<'tabs' | 'details'>('tabs');
  const [detailParams, setDetailParams] = useState<{ date: string; service: string } | null>(null);

  const tabs = [
    'Dashboard',
    'All Records',
    'Weekly Reports',
    'Attendance Patterns',
    'Compare Periods',
    'Goals',
    'Reminders',
  ];

  const handleViewDetails = (date: string, service: string) => {
    setDetailParams({ date, service });
    setView('details');
  };

  const handleBackToDashboard = () => {
    setView('tabs');
    setActiveTab('Dashboard');
    setDetailParams(null);
  };

  const handleEdit = (date: string, service: string) => {
    setEditContext({ date, service });
    setActivePage('Mark Attendance');
  };

  const renderContent = () => {
    if (view === 'details' && detailParams) {
      const serviceRecords = attendanceRecords.filter(
        (rec) => rec.date === detailParams.date && rec.service === detailParams.service,
      );
      return (
        <ServiceDetailsPage
          serviceName={detailParams.service}
          serviceDate={detailParams.date}
          serviceRecords={serviceRecords}
          members={members}
          onBack={handleBackToDashboard}
        />
      );
    }

    switch (activeTab) {
      case 'Dashboard':
        return (
          <AttendanceDashboard
            setActivePage={setActivePage}
            members={members}
            attendanceRecords={attendanceRecords}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            editContext={editContext}
            setEditContext={setEditContext}
            setActiveTab={setActiveTab}
          />
        );
      case 'All Records':
        return (
          <AllAttendanceRecordsPage
            setActivePage={setActivePage}
            attendanceRecords={attendanceRecords}
            onEdit={onEditAttendanceRecord}
            onDelete={onDeleteAttendanceRecord}
          />
        );
      case 'Department View':
        return (
          <DepartmentAttendancePage
            onBack={() => setActiveTab('Dashboard')}
            attendanceRecords={attendanceRecords}
            members={members}
          />
        );
      case 'Weekly Reports':
        return <WeeklyReportsPage />;
      case 'Attendance Patterns':
        return <AttendancePatternsPage />;
      case 'Compare Periods':
        return <ComparePeriodsPage />;
      case 'Goals':
        return <GoalsPage />;
      case 'Reminders':
        return <RemindersPage />;
      default:
        return (
          <AttendanceDashboard
            setActivePage={setActivePage}
            members={members}
            attendanceRecords={attendanceRecords}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            editContext={editContext}
            setEditContext={setEditContext}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Attendance Dashboard</h1>
            <p className="mt-1 opacity-90">An overview of attendance records and statistics.</p>
          </div>
          <button
            onClick={() => {
              setEditContext(null);
              setActivePage('Mark Attendance');
            }}
            className="bg-white text-green-600 font-semibold py-2 px-4 rounded-lg flex items-center shadow hover:bg-gray-100 transition-colors"
          >
            <CheckCircleIcon className="h-5 w-5 mr-2" /> Mark Attendance
          </button>
        </div>
      </div>

      {view === 'tabs' && (
        <div
          className={`${modeColors.card} p-3 rounded-lg shadow-sm flex items-center justify-between text-sm overflow-x-auto`}
        >
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-medium py-1.5 px-3 rounded-md transition-colors whitespace-nowrap ${activeTab === tab ? 'font-semibold text-green-700 bg-green-100' : `${modeColors.text} ${modeColors.hover}`}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default AttendanceModule;
