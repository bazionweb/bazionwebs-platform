import React, { useState, useMemo, useCallback } from 'react';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';
import { Transaction } from './financeData';
import { Member } from './memberData';
import ActionButtons from './ActionButtons';
import PaginationControls from './PaginationControls';

interface TransactionsListPageProps {
  setActiveView: (view: string) => void;
  setActivePage: (page: string) => void;
  transactions: Transaction[];
  members: Member[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
}

type SortField = 'date' | 'category' | 'amount' | 'description';
type SortDirection = 'asc' | 'desc';

const TransactionsListPage: React.FC<TransactionsListPageProps> = ({
  setActiveView,
  setActivePage,
  transactions,
  members,
  onEdit,
  onDelete,
}) => {
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Distinct transaction categories for the search dropdown
  const categories = useMemo(() => {
    const unique = new Set(transactions.map((t) => t.category));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const getContributorName = useCallback(
    (transaction: Transaction) => {
      if (transaction.contributorName) {
        return transaction.contributorName;
      }
      if (transaction.isAnonymous) {
        return 'Anonymous';
      }
      if (transaction.memberId) {
        const member = members.find((m) => m.id === transaction.memberId);
        return member ? member.name : 'Unknown Member';
      }
      if (transaction.nonMemberName) {
        return `${transaction.nonMemberName} (Non-Member)`;
      }
      return '-';
    },
    [members],
  );

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

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesType = filterType === 'All' || t.type === filterType;

        const transactionDate = new Date(t.date);
        const matchesStartDate = !startDate || transactionDate >= new Date(startDate);
        const matchesEndDate = !endDate || transactionDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));

        const matchesSearch = selectedCategory === '' || t.category === selectedCategory;

        return matchesType && matchesStartDate && matchesEndDate && matchesSearch;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'date':
            cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case 'category':
            cmp = a.category.localeCompare(b.category);
            break;
          case 'amount':
            cmp = a.amount - b.amount;
            break;
          case 'description':
            cmp = (a.description || '').localeCompare(b.description || '');
            break;
        }
        return sortDirection === 'desc' ? -cmp : cmp;
      });
  }, [
    transactions,
    filterType,
    startDate,
    endDate,
    selectedCategory,
    members,
    sortField,
    sortDirection,
    getContributorName,
  ]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const handleReset = () => {
    setFilterType('All');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setCurrentPage(1);
    setSortField('date');
    setSortDirection('desc');
  };

  const getCategoryChip = (type: string, category: string) => {
    const color = type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{category}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Transaction Records</h1>
            <p className="mt-1 text-gray-600">View and manage all financial transactions.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActivePage('Add Transaction')}
              className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700"
            >
              Add Transaction
            </button>
            <button
              onClick={() => setActiveView('Dashboard')}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Finance Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border" role="search" aria-label="Filter transactions">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500" htmlFor="transaction-search">
              Search by Category
            </label>
            <div className="relative mt-1">
              <SearchIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
              <select
                id="transaction-search"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                aria-describedby="search-help"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <span id="search-help" className="sr-only">
                Filter transactions by category
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500" htmlFor="start-date">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500" htmlFor="end-date">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Type</label>
            <div
              className="flex bg-gray-100 p-1 rounded-lg text-sm mt-1"
              role="radiogroup"
              aria-label="Transaction type filter"
            >
              <button
                onClick={() => {
                  setFilterType('All');
                  setCurrentPage(1);
                }}
                className={`w-full text-center py-1 rounded-md font-semibold ${filterType === 'All' ? 'bg-white shadow' : 'text-gray-600'}`}
                role="radio"
                aria-checked={filterType === 'All'}
              >
                All
              </button>
              <button
                onClick={() => {
                  setFilterType('Income');
                  setCurrentPage(1);
                }}
                className={`w-full text-center py-1 rounded-md font-semibold ${filterType === 'Income' ? 'bg-white shadow' : 'text-gray-600'}`}
                role="radio"
                aria-checked={filterType === 'Income'}
              >
                Inc
              </button>
              <button
                onClick={() => {
                  setFilterType('Expense');
                  setCurrentPage(1);
                }}
                className={`w-full text-center py-1 rounded-md font-semibold ${filterType === 'Expense' ? 'bg-white shadow' : 'text-gray-600'}`}
                role="radio"
                aria-checked={filterType === 'Expense'}
              >
                Exp
              </button>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-md font-semibold text-gray-700">
            Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
          </h3>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-500 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                  aria-sort={sortField === 'date' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('date')}
                >
                  Date <SortIcon field="date" />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                  aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('category')}
                >
                  Category <SortIcon field="category" />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                  aria-sort={sortField === 'amount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('amount')}
                >
                  Amount <SortIcon field="amount" />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 bg-gray-50 cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => handleSort('description')}
                  aria-sort={
                    sortField === 'description' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('description')}
                >
                  Description <SortIcon field="description" />
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Contributor
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">{getCategoryChip(t.type, t.category)}</td>
                  <td className={`px-6 py-4 font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    KSH {t.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">{t.description || '-'}</td>
                  <td className="px-6 py-4 capitalize">{getContributorName(t)}</td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      onEdit={() => onEdit(t)}
                      onDelete={() => onDelete(t.id)}
                      itemName={`${t.category} - KSH ${t.amount.toLocaleString()}`}
                      itemType="Transaction"
                      itemDetails={{
                        Type: t.type,
                        Category: t.category,
                        Amount: `KSH ${t.amount.toLocaleString()}`,
                        Date: new Date(t.date).toLocaleDateString(),
                        Contributor: getContributorName(t),
                      }}
                      size="md"
                      variant="icon"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedTransactions.length === 0 && (
            <p className="text-center p-8 text-gray-500">No transactions found for the selected criteria.</p>
          )}
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTransactions.length}
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

export default TransactionsListPage;
