import React from 'react';
import { Equipment, EquipmentCondition } from './equipmentData';
import {
  PlusIcon,
  WrenchIcon,
  EquipmentIcon as TotalIcon,
  CheckCircleIcon,
  ThumbsUpIcon,
  ExclamationIcon,
} from './Icons';
import ActionButtons from './ActionButtons';
import PageHeader from './PageHeader';

interface EquipmentDashboardProps {
  setActivePage: (page: string) => void;
  equipment: Equipment[];
  onEdit: (item: Equipment) => void;
  onDelete: (id: number) => void;
  setActiveView: (view: 'Dashboard' | 'Inventory' | 'Maintenance' | 'Reports') => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center text-white ${color}`}>
    <div className="p-3 bg-white/20 rounded-full mr-4">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm uppercase font-semibold">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const getConditionChip = (condition: EquipmentCondition) => {
  switch (condition) {
    case 'Excellent':
      return (
        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{condition}</span>
      );
    case 'Good':
      return (
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">{condition}</span>
      );
    case 'Fair':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{condition}</span>
      );
    case 'Needs Attention':
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{condition}</span>;
  }
};

const EquipmentDashboard: React.FC<EquipmentDashboardProps> = ({
  setActivePage,
  equipment,
  onEdit,
  onDelete,
  setActiveView,
}) => {
  const totalEquipment = equipment.length;
  const excellentCount = equipment.filter((e) => e.condition === 'Excellent').length;
  const goodCount = equipment.filter((e) => e.condition === 'Good').length;
  const needsAttentionCount = equipment.filter((e) => e.condition === 'Needs Attention').length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Equipment Management"
        subtitle="Track and manage church equipment and assets."
        icon={<TotalIcon className="h-8 w-8 text-blue-600" />}
        actions={
          <button
            onClick={() => setActivePage('Add Equipment')}
            className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" /> Add Equipment
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Equipment Dashboard</h2>
              <p className="opacity-90">Manage and track all church equipment and assets efficiently.</p>
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => setActiveView('Inventory')}
                  className="bg-white/90 text-green-700 text-sm font-semibold py-1.5 px-3 rounded-lg shadow hover:bg-white"
                >
                  View Inventory
                </button>
                <button
                  onClick={() => setActiveView('Maintenance')}
                  className="bg-white/20 hover:bg-white/30 text-sm font-semibold py-1.5 px-3 rounded-lg"
                >
                  Maintenance
                </button>
                <button
                  onClick={() => setActiveView('Reports')}
                  className="bg-white/20 hover:bg-white/30 text-sm font-semibold py-1.5 px-3 rounded-lg"
                >
                  Reports
                </button>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white/20 p-4 rounded-full mb-2 inline-block">
                <TotalIcon className="h-8 w-8 text-white" />
              </div>
              <p className="text-4xl font-bold">{totalEquipment}</p>
              <p className="text-sm opacity-90">Total Equipment</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Equipment" value={totalEquipment.toString()} icon={TotalIcon} color="bg-blue-500" />
          <StatCard
            title="Excellent Condition"
            value={excellentCount.toString()}
            icon={CheckCircleIcon}
            color="bg-green-500"
          />
          <StatCard title="Good Condition" value={goodCount.toString()} icon={ThumbsUpIcon} color="bg-sky-500" />
          <StatCard
            title="Needs Attention"
            value={needsAttentionCount.toString()}
            icon={ExclamationIcon}
            color="bg-yellow-500"
          />
          <StatCard title="Recent Maintenance" value="0" icon={WrenchIcon} color="bg-purple-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden border">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700">Equipment Inventory</h3>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('Inventory');
                }}
                className="text-sm text-green-600 hover:underline"
              >
                View All &gt;
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Condition</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.slice(0, 5).map((item) => (
                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4">{item.category}</td>
                      <td className="px-6 py-4">{getConditionChip(item.condition)}</td>
                      <td className="px-6 py-4">
                        <ActionButtons
                          onEdit={() => onEdit(item)}
                          onDelete={() => onDelete(item.id)}
                          itemName={item.name}
                          itemType="Equipment"
                          itemDetails={{
                            Category: item.category,
                            Condition: item.condition,
                            Location: item.location,
                            'Purchase Date': new Date(item.purchaseDate || '').toLocaleDateString(),
                            'Purchase Price': `KSH ${(item.purchasePrice ?? 0).toFixed(2)}`,
                          }}
                          size="sm"
                          variant="icon"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Quick Tips</h3>
            <ul className="space-y-4 text-sm">
              <li className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800">Inventory Management</h4>
                <p className="text-gray-600">
                  Use the inventory page to view all equipment details and search by category or location.
                </p>
              </li>
              <li className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800">Regular Maintenance</h4>
                <p className="text-gray-600">
                  Schedule and log maintenance tasks to keep equipment in top condition and prolong its lifespan.
                </p>
              </li>
            </ul>
          </div>
        </div>
        <footer className="text-center text-sm text-gray-500 mt-8 pt-4">
          © {new Date().getFullYear()} All rights reserved. Church Management System
        </footer>
      </div>
    </div>
  );
};

export default EquipmentDashboard;
