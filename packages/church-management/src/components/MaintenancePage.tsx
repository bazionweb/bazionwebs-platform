import React, { useState, useMemo } from 'react';
import { ArrowLeftIcon, WrenchIcon, PlusIcon, CheckCircleIcon, ClockIcon, ClipboardListIcon } from './Icons';
import { MaintenanceRecord, MaintenanceStatus } from './maintenanceData';
import { Equipment } from './equipmentData';
import ActionButtons from './ActionButtons';

interface MaintenancePageProps {
  onBack: () => void;
  setActivePage: (page: string) => void;
  equipment: Equipment[];
  maintenanceRecords: MaintenanceRecord[];
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: number) => void;
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

const getStatusChip = (status: MaintenanceStatus) => {
  switch (status) {
    case 'Completed':
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    case 'In Progress':
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    case 'Pending':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
      );
  }
};

const MaintenancePage: React.FC<MaintenancePageProps> = ({
  onBack,
  setActivePage,
  equipment,
  maintenanceRecords,
  onEdit,
  onDelete,
}) => {
  const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const equipmentMap = useMemo(() => new Map(equipment.map((item) => [item.id, item.name])), [equipment]);

  const stats = useMemo(() => {
    const totalCost = maintenanceRecords.reduce((sum, rec) => sum + rec.cost, 0);
    const completed = maintenanceRecords.filter((r) => r.status === 'Completed').length;
    const pending = maintenanceRecords.filter((r) => r.status === 'Pending').length;
    const inProgress = maintenanceRecords.filter((r) => r.status === 'In Progress').length;
    return { totalCost, completed, pending, inProgress };
  }, [maintenanceRecords]);

  const filteredRecords = useMemo(() => {
    return maintenanceRecords.filter((rec) => {
      const matchesStatus = filterStatus === 'All' || rec.status === filterStatus;
      const equipmentName = equipmentMap.get(rec.equipmentId) || '';
      const matchesSearch =
        searchTerm === '' ||
        equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.type.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [maintenanceRecords, filterStatus, searchTerm, equipmentMap]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Equipment Maintenance</h1>
          <p className="mt-1 text-gray-600">Track and schedule maintenance for church assets.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActivePage('Add Maintenance')}
            className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" /> Add Record
          </button>
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cost"
          value={`KSH ${stats.totalCost.toFixed(2)}`}
          icon={WrenchIcon}
          color="bg-blue-500"
        />
        <StatCard
          title="Completed Tasks"
          value={stats.completed.toString()}
          icon={CheckCircleIcon}
          color="bg-green-500"
        />
        <StatCard title="In Progress" value={stats.inProgress.toString()} icon={ClockIcon} color="bg-sky-500" />
        <StatCard
          title="Pending Tasks"
          value={stats.pending.toString()}
          icon={ClipboardListIcon}
          color="bg-yellow-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
        <div className="p-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by equipment, type, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:col-span-2 border border-gray-300 rounded-lg px-4 py-2"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MaintenanceStatus | 'All')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-600 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 bg-gray-50">Equipment</th>
                <th className="px-6 py-3 bg-gray-50">Date</th>
                <th className="px-6 py-3 bg-gray-50">Type</th>
                <th className="px-6 py-3 bg-gray-50">Cost (KSH)</th>
                <th className="px-6 py-3 bg-gray-50">Status</th>
                <th className="px-6 py-3 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {equipmentMap.get(rec.equipmentId) || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">{new Date(rec.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{rec.type}</td>
                  <td className="px-6 py-4">{rec.cost.toFixed(2)}</td>
                  <td className="px-6 py-4">{getStatusChip(rec.status)}</td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      onEdit={() => onEdit(rec)}
                      onDelete={() => onDelete(rec.id)}
                      itemName={equipmentMap.get(rec.equipmentId) || 'Unknown Equipment'}
                      itemType="Maintenance Record"
                      itemDetails={{
                        Equipment: equipmentMap.get(rec.equipmentId) || 'Unknown',
                        Type: rec.type,
                        Date: new Date(rec.date).toLocaleDateString(),
                        Cost: `KSH ${rec.cost.toFixed(2)}`,
                        Status: rec.status,
                        Description: rec.description,
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
            <p className="text-center p-8 text-gray-500">No maintenance records found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
