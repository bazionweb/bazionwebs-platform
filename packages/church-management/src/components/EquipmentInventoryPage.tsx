import React, { useState, useMemo } from 'react';
import { Equipment, EquipmentCondition, equipmentCategories } from './equipmentData';
import { SearchIcon, ArrowLeftIcon, PlusIcon } from './Icons';
import ActionButtons from './ActionButtons';

interface EquipmentInventoryPageProps {
  equipment: Equipment[];
  onEdit: (item: Equipment) => void;
  onDelete: (id: number) => void;
  setActivePage: (page: string) => void;
  onBack: () => void;
}

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

const EquipmentInventoryPage: React.FC<EquipmentInventoryPageProps> = ({
  equipment,
  onEdit,
  onDelete,
  setActivePage,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterCondition, setFilterCondition] = useState('All');

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesCondition = filterCondition === 'All' || item.condition === filterCondition;
      return matchesSearch && matchesCategory && matchesCondition;
    });
  }, [equipment, searchTerm, filterCategory, filterCondition]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Equipment Inventory</h1>
          <p className="mt-1 text-gray-600">A complete list of all church assets.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActivePage('Add Equipment')}
            className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" /> Add Equipment
          </button>
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <SearchIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="All">All Categories</option>
            {equipmentCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="All">All Conditions</option>
            {['Excellent', 'Good', 'Fair', 'Needs Attention'].map((con) => (
              <option key={con} value={con}>
                {con}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
        <div className="p-4 border-b">
          <h3 className="text-md font-semibold text-gray-700">
            Showing {filteredEquipment.length} of {equipment.length} items
          </h3>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-600 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 bg-gray-50">Name</th>
                <th className="px-6 py-3 bg-gray-50">Category</th>
                <th className="px-6 py-3 bg-gray-50">Condition</th>
                <th className="px-6 py-3 bg-gray-50">Purchase Date</th>
                <th className="px-6 py-3 bg-gray-50">Price (KSH)</th>
                <th className="px-6 py-3 bg-gray-50">Location</th>
                <th className="px-6 py-3 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map((item) => (
                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4">{item.category}</td>
                  <td className="px-6 py-4">{getConditionChip(item.condition)}</td>
                  <td className="px-6 py-4">
                    {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4">{item.purchasePrice?.toFixed(2) ?? 'N/A'}</td>
                  <td className="px-6 py-4">{item.location || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      onEdit={() => onEdit(item)}
                      onDelete={() => onDelete(item.id)}
                      itemName={item.name}
                      itemType="Equipment"
                      itemDetails={{
                        Category: item.category,
                        Condition: item.condition,
                        Location: item.location || 'N/A',
                        'Purchase Price': item.purchasePrice ? `KSH ${item.purchasePrice.toLocaleString()}` : 'N/A',
                      }}
                      size="md"
                      variant="icon"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEquipment.length === 0 && (
            <p className="text-center p-8 text-gray-500">No equipment found matching your criteria.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentInventoryPage;
