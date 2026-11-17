import React, { useState, useMemo } from 'react';
import { UsersIcon, CurrencyDollarIcon, PlusIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import { Transaction } from './financeData';
import { Member } from './memberData';
import PaginationControls from './PaginationControls';
import { useDebounce } from '../hooks/useDebounce';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType }> = ({
  title,
  value,
  icon: Icon,
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border flex items-center">
    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

interface TitheTrackingPageProps {
  setActiveView: (view: string) => void;
  setActivePage: (page: string) => void;
  transactions: Transaction[];
  members: Member[];
  onViewHistory: (memberId: string) => void;
}

type SortField = 'name' | 'total' | 'lastDate';

const TitheTrackingPage: React.FC<TitheTrackingPageProps> = ({
  setActiveView,
  setActivePage,
  transactions,
  members,
  onViewHistory,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const debouncedSearch = useDebounce(searchTerm, 300);

  const titheRecords = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth) && t.category === 'Tithe');
  }, [transactions, selectedMonth]);

  const stats = useMemo(() => {
    const totalTithes = titheRecords.reduce((sum, t) => sum + t.amount, 0);
    const membersPaying = new Set(titheRecords.map((t) => t.memberId)).size;
    const totalActiveMembers = members.filter((m) => m.status === 'Active').length;
    const participation = totalActiveMembers > 0 ? (membersPaying / totalActiveMembers) * 100 : 0;
    const averageTithe = membersPaying > 0 ? totalTithes / membersPaying : 0;
    return { totalTithes, membersPaying, participation, averageTithe };
  }, [titheRecords, members]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDownIcon className="w-3 h-3 inline ml-1" />
    );
  };

  const memberTitheData = useMemo(() => {
    const memberData = new Map<string, { total: number; lastDate: string }>();
    titheRecords.forEach((t) => {
      if (t.memberId) {
        const existing = memberData.get(t.memberId) || { total: 0, lastDate: '1970-01-01' };
        existing.total += t.amount;
        if (t.date > existing.lastDate) {
          existing.lastDate = t.date;
        }
        memberData.set(t.memberId, existing);
      }
    });

    return Array.from(memberData.entries())
      .map(([memberId, data]) => {
        const member = members.find((m) => m.id === memberId);
        return { memberId, name: member?.name, phone: member?.phone, ...data };
      })
      .filter((m) => m.name?.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'name':
            cmp = (a.name || '').localeCompare(b.name || '');
            break;
          case 'total':
            cmp = a.total - b.total;
            break;
          case 'lastDate':
            cmp = a.lastDate.localeCompare(b.lastDate);
            break;
        }
        return sortDirection === 'desc' ? -cmp : cmp;
      });
  }, [titheRecords, debouncedSearch, members, sortField, sortDirection]);

  const totalPages = Math.ceil(memberTitheData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return memberTitheData.slice(start, start + pageSize);
  }, [memberTitheData, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tithe Tracking</h1>
            <p className="mt-1 text-gray-600">Track and manage member tithes.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActivePage('Add Transaction')}
              className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700"
            >
              Add Tithe
            </button>
            <button
              onClick={() => setActiveView('Dashboard')}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Back to Finance
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-gray-300 rounded-md px-3 py-1.5"
          />
          <span className="text-sm">Total Tithes: KSH {stats.totalTithes.toFixed(2)}</span>
          <span className="text-sm">Member Participation: {stats.participation.toFixed(1)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Tithes Collected"
          value={`KSH ${stats.totalTithes.toFixed(2)}`}
          icon={CurrencyDollarIcon}
        />
        <StatCard title="Members Paying Tithes" value={stats.membersPaying.toString()} icon={UsersIcon} />
        <StatCard
          title="Average Tithe Amount"
          value={`KSH ${stats.averageTithe.toFixed(2)}`}
          icon={CurrencyDollarIcon}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700">Members Tithe Records</h3>
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="border rounded-md px-3 py-1.5 w-1/3"
            aria-label="Search members"
          />
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-500 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                  aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('name')}
                >
                  Member <SortIcon field="name" />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('total')}
                  aria-sort={sortField === 'total' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('total')}
                >
                  Total Tithes <SortIcon field="total" />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('lastDate')}
                  aria-sort={sortField === 'lastDate' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('lastDate')}
                >
                  Last Tithe Date <SortIcon field="lastDate" />
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
              {paginatedData.map((m) => (
                <tr key={m.memberId} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold capitalize">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.phone}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-700">KSH {m.total.toFixed(2)}</td>
                  <td className="px-6 py-4">{new Date(m.lastDate).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onViewHistory(m.memberId!)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setActivePage('Add Transaction')}
                        className="text-green-600 hover:text-green-800 p-1"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedData.length === 0 && (
            <p className="text-center p-8 text-gray-500">No tithe records found for the selected month.</p>
          )}
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={memberTitheData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
};

export default TitheTrackingPage;
