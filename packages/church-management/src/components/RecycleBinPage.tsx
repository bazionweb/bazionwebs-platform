import React, { useState, useEffect } from 'react';
import { RecycleBinItem, User } from './userData';
import { SearchIcon, TrashIcon, CalendarIcon, UserIcon, UsersIcon, CurrencyDollarIcon } from './Icons';
import { Trash2, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from './ToastContext';

interface RecycleBinPageProps {
  currentUser: User;
  recycleBinItems: RecycleBinItem[];
  onRestore: (item: RecycleBinItem) => Promise<void>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  onEmptyBin: () => Promise<void>;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case 'Member':
      return <UserIcon className="w-5 h-5" />;
    case 'Transaction':
      return <CurrencyDollarIcon className="w-5 h-5" />;
    case 'Equipment':
      return <UsersIcon className="w-5 h-5" />;
    case 'Visitor':
      return <UsersIcon className="w-5 h-5" />;
    case 'Group':
      return <UsersIcon className="w-5 h-5" />;
    case 'Branch':
      return <UsersIcon className="w-5 h-5" />;
    case 'User':
      return <UserIcon className="w-5 h-5" />;
    case 'AttendanceRecord':
      return <CalendarIcon className="w-5 h-5" />;
    case 'MaintenanceRecord':
      return <UsersIcon className="w-5 h-5" />;
    default:
      return <TrashIcon className="w-5 h-5" />;
  }
};

const getItemColor = (type: string) => {
  switch (type) {
    case 'Member':
      return 'bg-blue-100 text-blue-800';
    case 'Transaction':
      return 'bg-green-100 text-green-800';
    case 'Equipment':
      return 'bg-purple-100 text-purple-800';
    case 'Visitor':
      return 'bg-orange-100 text-orange-800';
    case 'Group':
      return 'bg-cyan-100 text-cyan-800';
    case 'Branch':
      return 'bg-indigo-100 text-indigo-800';
    case 'User':
      return 'bg-red-100 text-red-800';
    case 'AttendanceRecord':
      return 'bg-yellow-100 text-yellow-800';
    case 'MaintenanceRecord':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const RecycleBinPage: React.FC<RecycleBinPageProps> = ({
  currentUser: _currentUser,
  recycleBinItems: initialRecycleBinItems,
  onRestore,
  onPermanentlyDelete,
  onEmptyBin,
}) => {
  const { showToast } = useToast();
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>(initialRecycleBinItems);
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<RecycleBinItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setRecycleBinItems(initialRecycleBinItems);
  }, [initialRecycleBinItems]);

  // Filter items
  const filteredItems = recycleBinItems.filter((item) => {
    const d = item.data as Record<string, unknown>;
    const itemSearchText = String(d.name || d.memberName || d.username || item.type).toLowerCase();

    const matchesSearch = itemSearchText.includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || item.type === filterType;

    return matchesSearch && matchesType;
  });

  // Get unique types for filter
  const itemTypes = ['All', ...Array.from(new Set(recycleBinItems.map((item) => item.type)))];

  const handleRestore = async (item: RecycleBinItem) => {
    if (window.confirm(`Are you sure you want to restore this ${item.type.toLowerCase()}?`)) {
      try {
        await onRestore(item);
        showToast(`${item.type} restored successfully!`, 'success');
      } catch (error) {
        console.error('Error restoring item:', error);
        showToast('Failed to restore item', 'error');
      }
    }
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    if (
      window.confirm(
        `Are you sure you want to PERMANENTLY delete this ${item.type.toLowerCase()}? This action cannot be undone!`,
      )
    ) {
      try {
        await onPermanentlyDelete(item.id);
        showToast(`${item.type} permanently deleted`, 'info');
      } catch (error) {
        console.error('Error permanently deleting item:', error);
        showToast('Failed to delete item', 'error');
      }
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (
      window.confirm(
        'Are you sure you want to empty the entire recycle bin? This will PERMANENTLY delete all items and cannot be undone!',
      )
    ) {
      try {
        await onEmptyBin();
        showToast('Recycle bin emptied successfully', 'info');
      } catch (error) {
        console.error('Error emptying recycle bin:', error);
        showToast('Failed to empty recycle bin', 'error');
      }
    }
  };

  const formatItemPreview = (item: RecycleBinItem) => {
    switch (item.type) {
      case 'Member': {
        const d = item.data as { name: string; email: string; phone: string; department: string };
        return `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone}\nDepartment: ${d.department}`;
      }
      case 'Transaction': {
        const d = item.data as { amount: number; type: string; category: string; date: string };
        return `Amount: ${d.amount}\nType: ${d.type}\nCategory: ${d.category}\nDate: ${d.date}`;
      }
      case 'Equipment': {
        const d = item.data as { name: string; category: string; status: string; location: string };
        return `Name: ${d.name}\nCategory: ${d.category}\nStatus: ${d.status}\nLocation: ${d.location}`;
      }
      case 'Visitor': {
        const d = item.data as { name: string; phone: string; email?: string; firstVisit: string };
        return `Name: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email || 'N/A'}\nFirst Visit: ${d.firstVisit}`;
      }
      case 'User': {
        const d = item.data as { username: string; email: string; role: string; lastLogin: string };
        return `Username: ${d.username}\nEmail: ${d.email}\nRole: ${d.role}\nLast Login: ${d.lastLogin}`;
      }
      default:
        return JSON.stringify(item.data, null, 2);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-600" />
            Recycle Bin
          </h1>
          <p className="text-gray-500">Manage deleted items - restore or permanently delete</p>
        </div>
        {recycleBinItems.length > 0 && (
          <button
            onClick={handleEmptyRecycleBin}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Empty Recycle Bin
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{recycleBinItems.length}</p>
              <p className="text-sm text-red-600">Total Items</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UserIcon className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {recycleBinItems.filter((i) => i.type === 'Member').length}
              </p>
              <p className="text-sm text-blue-600">Members</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">
                {recycleBinItems.filter((i) => i.type === 'Transaction').length}
              </p>
              <p className="text-sm text-green-600">Transactions</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-700">
                {recycleBinItems.filter((i) => ['Equipment', 'Branch'].includes(i.type)).length}
              </p>
              <p className="text-sm text-purple-600">Assets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search deleted items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
          >
            {itemTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {recycleBinItems.length === 0 ? 'Recycle bin is empty' : 'No items match your search'}
          </h3>
          <p className="text-gray-500 mb-4">
            {recycleBinItems.length === 0
              ? 'When you delete items from the system, they will be moved here instead of being permanently deleted.'
              : 'Try adjusting your search terms or filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getItemColor(item.type)}`}>{getItemIcon(item.type)}</div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {((item.data as Record<string, unknown>).name as string) ||
                            ((item.data as Record<string, unknown>).memberName as string) ||
                            ((item.data as Record<string, unknown>).username as string) ||
                            `${item.type} #${item.originalId}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {((item.data as Record<string, unknown>).email as string) ||
                            ((item.data as Record<string, unknown>).category as string) ||
                            ((item.data as Record<string, unknown>).type as string) ||
                            'No description'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getItemColor(item.type)}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">User #{item.deletedBy}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(item.deletedAt).toLocaleDateString()} {new Date(item.deletedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setShowPreview(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestore(item)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {getItemIcon(selectedItem.type)}
                {selectedItem.type} Preview
              </h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Deleted Item</span>
                  </div>
                  <p className="text-sm text-red-600">
                    This {selectedItem.type.toLowerCase()} was deleted on{' '}
                    {new Date(selectedItem.deletedAt).toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Item Details:</h4>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                    {formatItemPreview(selectedItem)}
                  </pre>
                </div>

                {selectedItem.reason && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">Deletion Reason:</h4>
                    <p className="text-sm text-yellow-700">{selectedItem.reason}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleRestore(selectedItem);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBinPage;
