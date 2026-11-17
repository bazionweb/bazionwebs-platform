import React, { useMemo } from 'react';
import {
  UsersIcon,
  UserPlusIcon,
  CurrencyDollarIcon,
  GiftIcon,
  CheckCircleIcon,
  DocumentAddIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  DashboardIcon,
} from './Icons';
import { Member } from './memberData';
import { Transaction } from './financeData';
import { User } from './userData';
import { useTheme } from './ThemeContext';
import PageHeader from './PageHeader';

const StatCard: React.FC<{
  title: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  color: string;
  onViewClick?: () => void;
}> = ({ title, value, subtext, icon: Icon, color, onViewClick }) => {
  return (
    <div className={`p-6 rounded-xl text-white shadow-md ${color}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm uppercase font-semibold opacity-80">{title}</p>
          <p className="text-4xl font-bold">{value}</p>
          {subtext && <p className="text-xs opacity-70 mt-1">{subtext}</p>}
        </div>
        <div className="bg-white/20 p-3 rounded-lg">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="text-right mt-4 text-sm opacity-90">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onViewClick?.();
          }}
          className="hover:underline"
        >
          View →
        </a>
      </div>
    </div>
  );
};

interface DashboardPageProps {
  setActivePage: (page: string) => void;
  members: Member[];
  totalMembersCount?: number;
  transactions: Transaction[];
  onAddTransaction: () => void;
  currentUser: User | null;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  setActivePage,
  members,
  totalMembersCount,
  transactions,
  onAddTransaction,
  currentUser,
}) => {
  const { modeColors } = useTheme();
  const totalMembers = totalMembersCount ?? members.length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newMembersCount = members.filter((m) => {
    if (!m.dateAdded) return false;
    return new Date(m.dateAdded) >= thirtyDaysAgo;
  }).length;

  const currentMonth = new Date().getMonth();
  const birthdaysThisMonth = members
    .filter((member) => {
      if (!member.dob) return false;
      const birthDate = new Date(member.dob);
      return birthDate.getMonth() === currentMonth;
    })
    .sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

  const financialBalance = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return income - expenses;
  }, [transactions]);

  const genderData = useMemo(() => {
    const males = members.filter((m) => m.gender === 'Male').length;
    const females = members.filter((m) => m.gender === 'Female').length;
    const total = males + females;
    return [
      { name: 'Male', value: total > 0 ? (males / total) * 100 : 0, color: '#3b82f6' },
      { name: 'Female', value: total > 0 ? (females / total) * 100 : 0, color: '#ec4899' },
    ];
  }, [members]);

  const ageData = useMemo(() => {
    const ranges = { 'Under 18': 0, '18-35': 0, '36-60': 0, 'Over 60': 0 };
    const today = new Date();
    members.forEach((m) => {
      const birthDate = new Date(m.dob);
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18) ranges['Under 18']++;
      else if (age <= 35) ranges['18-35']++;
      else if (age <= 60) ranges['36-60']++;
      else ranges['Over 60']++;
    });
    const total = members.length;
    return Object.entries(ranges).map(([name, value]) => ({
      name,
      value: total > 0 ? (value / total) * 100 : 0,
    }));
  }, [members]);

  const getInitial = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };
  const initialColors = ['bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-green-500'];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Dashboard"
        subtitle="Welcome to HKM Church Management System. Overview of key metrics and quick actions."
        icon={<DashboardIcon className="h-8 w-8 text-blue-600" />}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentUser?.role === 'Guest' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Pending Approval:</strong> Your account is currently under review or waiting for role
                  assignment. Most features, data, and settings are restricted until an Administrator approves your
                  account.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentUser?.role !== 'Guest' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setActivePage('Add Member')}
              className={`${modeColors.card} p-3 rounded-lg shadow flex items-center justify-center ${modeColors.text} ${modeColors.hover} transition-all transform hover:scale-105`}
            >
              <UserPlusIcon className="h-5 w-5 mr-2 text-green-600" /> Add Member
            </button>
            <button
              onClick={() => setActivePage('Mark Attendance')}
              className={`${modeColors.card} p-3 rounded-lg shadow flex items-center justify-center ${modeColors.text} ${modeColors.hover} transition-all transform hover:scale-105`}
            >
              <CheckCircleIcon className="h-5 w-5 mr-2 text-green-600" /> Mark Attendance
            </button>
            <button
              onClick={onAddTransaction}
              className={`${modeColors.card} p-3 rounded-lg shadow flex items-center justify-center ${modeColors.text} ${modeColors.hover} transition-all transform hover:scale-105`}
            >
              <DocumentAddIcon className="h-5 w-5 mr-2 text-green-600" /> Add Transaction
            </button>
            <button
              onClick={() => setActivePage('SMS Broadcast')}
              className={`${modeColors.card} p-3 rounded-lg shadow flex items-center justify-center ${modeColors.text} ${modeColors.hover} transition-all transform hover:scale-105`}
            >
              <PaperAirplaneIcon className="h-5 w-5 mr-2 text-green-600" /> Send SMS
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Members"
            value={totalMembers.toString()}
            icon={UsersIcon}
            color="from-blue-500 to-blue-600 bg-gradient-to-br"
            onViewClick={() => setActivePage('Members')}
          />
          <StatCard
            title="New Members"
            value={newMembersCount.toString()}
            subtext="Last 30 days"
            icon={UserPlusIcon}
            color="from-yellow-500 to-orange-500 bg-gradient-to-br"
            onViewClick={() => setActivePage('Members')}
          />
          {currentUser?.role !== 'Guest' ? (
            <StatCard
              title="Financial Balance"
              value={`KSH ${financialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={CurrencyDollarIcon}
              color="from-green-500 to-emerald-600 bg-gradient-to-br"
              onViewClick={() => setActivePage('Finance')}
            />
          ) : (
            <StatCard
              title="Restricted"
              value="Hidden"
              subtext="Requires Admin Access"
              icon={CurrencyDollarIcon}
              color="from-gray-500 to-gray-600 bg-gradient-to-br"
            />
          )}
          <StatCard
            title="Birthdays"
            value={birthdaysThisMonth.length.toString()}
            subtext="This month"
            icon={GiftIcon}
            color="from-purple-500 to-indigo-600 bg-gradient-to-br"
            onViewClick={() => setActivePage('Birthdays')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={`lg:col-span-2 ${modeColors.card} p-6 rounded-xl shadow-md`}>
            <h3 className={`text-xl font-semibold ${modeColors.text} mb-4`}>Member Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className={`font-semibold ${modeColors.textSecondary} mb-3`}>Gender Distribution</h4>
                {genderData.map((item) => (
                  <div key={item.name} className="mb-2">
                    <div className={`flex justify-between items-center text-sm mb-1`}>
                      <span className={modeColors.textSecondary}>{item.name}</span>
                      <span className="font-bold" style={{ color: item.color }}>
                        {item.value.toFixed(1)}%
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2.5 ${modeColors.bgSecondary}`}>
                      <div
                        className="h-2.5 rounded-full"
                        style={{ width: `${item.value}%`, backgroundColor: item.color }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className={`font-semibold ${modeColors.textSecondary} mb-3`}>Age Distribution</h4>
                {ageData.map((item) => (
                  <div key={item.name} className="flex items-center mb-2">
                    <div className={`w-20 text-sm ${modeColors.textSecondary}`}>{item.name}</div>
                    <div className={`flex-1 rounded-full h-4 mr-2 ${modeColors.bgSecondary}`}>
                      <div className="bg-green-500 h-4 rounded-full" style={{ width: `${item.value}%` }}></div>
                    </div>
                    <div className={`w-8 text-sm font-bold ${modeColors.text}`}>{item.value.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={`${modeColors.card} p-6 rounded-xl shadow-md`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${modeColors.text}`}>Birthdays This Month</h3>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage('Birthdays');
                }}
                className="text-sm text-green-600 hover:underline"
              >
                View All →
              </a>
            </div>
            <div className="space-y-4">
              {birthdaysThisMonth.slice(0, 3).map((bday, index) => (
                <div key={bday.email} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full ${initialColors[index % initialColors.length]} text-white flex-shrink-0 flex items-center justify-center font-bold text-sm`}
                  >
                    {getInitial(bday.name)}
                  </div>
                  <div className="ml-4 flex-grow">
                    <p className={`font-semibold ${modeColors.text} capitalize`}>{bday.name}</p>
                    <p className={`text-sm ${modeColors.textSecondary} flex items-center`}>
                      <GiftIcon className="w-4 h-4 mr-1.5" />
                      {new Date(bday.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <a
                    href={`tel:${bday.phone}`}
                    className={`cursor-pointer ${modeColors.textSecondary} hover:text-green-600`}
                  >
                    <PhoneIcon className="w-5 h-5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
