import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { CurrencyDollarIcon } from './Icons';
import { Transaction } from './financeData';
import { Member } from './memberData';
import { useTheme } from './ThemeContext';
import ActionButtons from './ActionButtons';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => {
  const { modeColors } = useTheme();
  return (
    <div className={`${modeColors.card} p-4 rounded-lg shadow-sm border ${modeColors.border} flex items-center`}>
      <div className={`p-3 rounded-lg ${color} text-white mr-4`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className={`text-sm ${modeColors.textSecondary}`}>{title}</p>
        <p className={`text-2xl font-bold ${modeColors.text}`}>{value}</p>
      </div>
    </div>
  );
};

const getMonthName = (monthIndex: number) => new Date(0, monthIndex).toLocaleString('en-US', { month: 'short' });

interface FinanceDashboardProps {
  setActiveView: (view: string) => void;
  setActivePage: (page: string) => void;
  transactions: Transaction[];
  members: Member[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  setActiveView,
  setActivePage,
  transactions,
  members,
  onEdit,
  onDelete,
}) => {
  const { modeColors } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [transactionFilter, setTransactionFilter] = useState<'All' | 'Income' | 'Expense'>('All');

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map((t) => new Date(t.date).getFullYear()));
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [transactions]);

  const [selectedChartYear, setSelectedChartYear] = useState(availableYears[0] || new Date().getFullYear());

  const [categoryFilterMode, setCategoryFilterMode] = useState<'all' | 'year' | 'month'>('all');
  const [categoryFilterYear, setCategoryFilterYear] = useState(availableYears[0] || new Date().getFullYear());
  const [categoryFilterMonth, setCategoryFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const { income, expenses, balance } = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .filter((t) => transactionFilter === 'All' || t.type === transactionFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions, transactionFilter]);

  const categoryChartTitle = useMemo(() => {
    if (categoryFilterMode === 'year') {
      return `By Year (${categoryFilterYear})`;
    }
    if (categoryFilterMode === 'month' && categoryFilterMonth) {
      const date = new Date(categoryFilterMonth + '-02T00:00:00');
      const monthName = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `By Month (${monthName} ${year})`;
    }
    return 'All Time';
  }, [categoryFilterMode, categoryFilterYear, categoryFilterMonth]);

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let filtered = transactions.filter((t) => t.type === 'Income');

    if (categoryFilterMode === 'year') {
      filtered = filtered.filter((t) => new Date(t.date).getFullYear() === categoryFilterYear);
    } else if (categoryFilterMode === 'month') {
      filtered = filtered.filter((t) => t.date.startsWith(categoryFilterMonth));
    }

    filtered.forEach((t) => {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions, categoryFilterMode, categoryFilterYear, categoryFilterMonth]);

  const incomeVsExpensesChartData = useMemo(() => {
    const monthData: { [key: string]: { income: number; expenses: number } } = {};

    for (let i = 0; i < 12; i++) {
      const monthKey = `${selectedChartYear}-${String(i + 1).padStart(2, '0')}`;
      monthData[monthKey] = { income: 0, expenses: 0 };
    }

    transactions
      .filter((t) => new Date(t.date).getFullYear() === selectedChartYear)
      .forEach((t) => {
        const monthKey = t.date.slice(0, 7);
        if (monthData[monthKey]) {
          if (t.type === 'Income') monthData[monthKey].income += t.amount;
          else monthData[monthKey].expenses += t.amount;
        }
      });

    return Object.entries(monthData).map(([key, value]) => ({
      name: getMonthName(parseInt(key.split('-')[1]) - 1),
      Income: value.income,
      Expenses: value.expenses,
    }));
  }, [transactions, selectedChartYear]);

  const DONUT_COLORS = ['#34d399', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6', '#ec4899', '#14b8a6'];
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent * 100 < 5) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getCategoryChip = (type: string, category: string) => {
    const color = type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{category}</span>;
  };

  const getContributorName = (transaction: Transaction) => {
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
  };

  const recentTransactionsCount = recentTransactions.length;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Financial Dashboard</h1>
            <p className="mt-1 opacity-90">Track and manage church finances.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              onClick={() => setActivePage('Add Transaction')}
              className="bg-white/90 text-green-700 font-semibold py-2 px-4 rounded-lg shadow hover:bg-white"
            >
              Add Transaction
            </button>
            <button
              onClick={() => setActiveView('Transactions')}
              className="bg-white/20 hover:bg-white/30 font-semibold py-2 px-4 rounded-lg"
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveView('Tithes')}
              className="bg-white/20 hover:bg-white/30 font-semibold py-2 px-4 rounded-lg"
            >
              Tithes
            </button>
            <button
              onClick={() => setActiveView('Welfare')}
              className="bg-white/20 hover:bg-white/30 font-semibold py-2 px-4 rounded-lg"
            >
              Welfare
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-4 items-center bg-black/10 p-3 rounded-lg">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border border-white/30 rounded-md px-3 py-1.5"
            aria-label="Select month"
          />
          <span className="font-semibold">
            Financial Health: <span className="text-green-300">Good</span>
          </span>
          <span className="font-semibold">
            Balance: KSH {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center" role="alert">
          <CurrencyDollarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Financial Data Yet</h3>
          <p className="text-gray-500 mb-4">
            Start recording your church's financial transactions to see insights and reports.
          </p>
          <button
            onClick={() => setActivePage('Add Transaction')}
            className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-green-700"
          >
            Add Your First Transaction
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Income"
              value={`KSH ${income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={CurrencyDollarIcon}
              color="bg-green-500"
            />
            <StatCard
              title="Total Expenses"
              value={`KSH ${expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={CurrencyDollarIcon}
              color="bg-red-500"
            />
            <StatCard
              title="Current Balance"
              value={`KSH ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={CurrencyDollarIcon}
              color="bg-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${modeColors.card} p-6 rounded-lg shadow-sm`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${modeColors.text}`}>Income vs Expenses ({selectedChartYear})</h3>
                {availableYears.length > 0 && (
                  <select
                    value={selectedChartYear}
                    onChange={(e) => setSelectedChartYear(parseInt(e.target.value))}
                    className={`border ${modeColors.border} ${modeColors.card} ${modeColors.text} rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500`}
                    aria-label="Select year for chart"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {incomeVsExpensesChartData.some((d) => d.Income > 0 || d.Expenses > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={incomeVsExpensesChartData} aria-label="Income vs Expenses bar chart">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">
                  No data available for the selected year
                </div>
              )}
            </div>
            <div className={`${modeColors.card} p-6 rounded-lg shadow-sm`}>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h3 className={`text-lg font-semibold ${modeColors.text}`}>
                  Income by Category ({categoryChartTitle})
                </h3>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex ${modeColors.bgSecondary} p-1 rounded-lg text-sm`}
                    role="radiogroup"
                    aria-label="Category filter mode"
                  >
                    <button
                      onClick={() => setCategoryFilterMode('all')}
                      className={`px-3 py-1 rounded-md font-semibold ${categoryFilterMode === 'all' ? `${modeColors.card} shadow` : modeColors.text}`}
                      role="radio"
                      aria-checked={categoryFilterMode === 'all'}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCategoryFilterMode('year')}
                      className={`px-3 py-1 rounded-md font-semibold ${categoryFilterMode === 'year' ? `${modeColors.card} shadow` : modeColors.text}`}
                      role="radio"
                      aria-checked={categoryFilterMode === 'year'}
                    >
                      Year
                    </button>
                    <button
                      onClick={() => setCategoryFilterMode('month')}
                      className={`px-3 py-1 rounded-md font-semibold ${categoryFilterMode === 'month' ? `${modeColors.card} shadow` : modeColors.text}`}
                      role="radio"
                      aria-checked={categoryFilterMode === 'month'}
                    >
                      Month
                    </button>
                  </div>
                  {categoryFilterMode === 'year' && (
                    <select
                      value={categoryFilterYear}
                      onChange={(e) => setCategoryFilterYear(parseInt(e.target.value))}
                      className={`border ${modeColors.border} ${modeColors.card} ${modeColors.text} rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500`}
                      aria-label="Select year for category breakdown"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                  {categoryFilterMode === 'month' && (
                    <input
                      type="month"
                      value={categoryFilterMonth}
                      onChange={(e) => setCategoryFilterMonth(e.target.value)}
                      className={`border ${modeColors.border} ${modeColors.card} ${modeColors.text} rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500`}
                      aria-label="Select month for category breakdown"
                    />
                  )}
                </div>
              </div>
              {incomeByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {incomeByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">
                  No income data available for the selected period
                </div>
              )}
            </div>
          </div>

          <div className={`${modeColors.card} rounded-lg shadow-sm overflow-hidden`}>
            <div className={`p-4 border-b ${modeColors.border} flex flex-wrap justify-between items-center gap-2`}>
              <h3 className={`text-lg font-semibold ${modeColors.text}`}>Recent Transactions</h3>
              <div className="flex items-center gap-2">
                <div
                  className={`flex ${modeColors.bgSecondary} p-1 rounded-lg text-sm`}
                  role="radiogroup"
                  aria-label="Transaction type filter"
                >
                  <button
                    onClick={() => setTransactionFilter('All')}
                    className={`px-3 py-1 rounded-md font-semibold ${transactionFilter === 'All' ? `${modeColors.card} shadow` : modeColors.text}`}
                    role="radio"
                    aria-checked={transactionFilter === 'All'}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTransactionFilter('Income')}
                    className={`px-3 py-1 rounded-md font-semibold ${transactionFilter === 'Income' ? `${modeColors.card} shadow` : modeColors.text}`}
                    role="radio"
                    aria-checked={transactionFilter === 'Income'}
                  >
                    Income
                  </button>
                  <button
                    onClick={() => setTransactionFilter('Expense')}
                    className={`px-3 py-1 rounded-md font-semibold ${transactionFilter === 'Expense' ? `${modeColors.card} shadow` : modeColors.text}`}
                    role="radio"
                    aria-checked={transactionFilter === 'Expense'}
                  >
                    Expense
                  </button>
                </div>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('Transactions');
                  }}
                  className="text-sm text-green-600 hover:underline"
                >
                  View All ({recentTransactionsCount > 5 ? `${transactions.length} total` : ''})
                </a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table
                className={`w-full text-sm text-left ${modeColors.textSecondary}`}
                role="table"
                aria-label="Recent transactions"
              >
                <thead className={`text-xs ${modeColors.text} uppercase ${modeColors.bgSecondary}`}>
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Contributor
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => (
                    <tr key={t.id} className={`${modeColors.card} border-b ${modeColors.border} ${modeColors.hover}`}>
                      <td className="px-6 py-4">
                        {new Date(t.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">{getCategoryChip(t.type, t.category)}</td>
                      <td className={`px-6 py-4 font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                        KSH {t.amount.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 capitalize ${modeColors.text}`}>{getContributorName(t)}</td>
                      <td className="px-6 py-4">
                        <ActionButtons
                          onEdit={() => onEdit(t)}
                          onDelete={() => onDelete(t.id)}
                          itemName={`${t.category} - ${new Date(t.date).toLocaleDateString()}`}
                          itemType="Transaction"
                          itemDetails={{
                            Date: new Date(t.date).toLocaleDateString(),
                            Type: t.type,
                            Category: t.category,
                            Amount: `KSH ${t.amount.toFixed(2)}`,
                            Contributor: getContributorName(t),
                            Description: t.description || 'No description',
                          }}
                          size="sm"
                          variant="icon"
                        />
                      </td>
                    </tr>
                  ))}
                  {recentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className={`text-center py-8 ${modeColors.textSecondary}`}>
                        No recent {transactionFilter !== 'All' ? transactionFilter.toLowerCase() : ''} transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceDashboard;
