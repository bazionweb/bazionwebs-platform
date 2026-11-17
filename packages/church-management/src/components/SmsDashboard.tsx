import React, { useMemo, useState } from 'react';
import { SmsRecord } from './smsData';
import { RefreshIcon, EyeIcon, PaperAirplaneIcon, CheckCircleIcon, ExclamationIcon, ClockIcon } from './Icons';

interface SmsDashboardProps {
  smsRecords: SmsRecord[];
  setActiveView: (view: 'Dashboard' | 'Compose' | 'History') => void;
}

const StatCard: React.FC<{
  title: string;
  value: string;
  subtext?: string;
  subvalue?: string;
  color: string;
  icon: React.ElementType;
}> = ({ title, value, subtext, subvalue, color, icon: Icon }) => (
  <div className={`p-4 rounded-lg shadow-sm border ${color}`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
      <div className="p-3 bg-gray-100 rounded-lg">
        <Icon className="h-6 w-6 text-gray-500" />
      </div>
    </div>
    {subtext && (
      <div className="flex justify-between text-xs text-gray-500">
        <span>{subtext}</span>
        <span className="font-semibold">{subvalue}</span>
      </div>
    )}
  </div>
);

const SmsDashboard: React.FC<SmsDashboardProps> = ({ smsRecords, setActiveView }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const stats = useMemo(() => {
    const total = smsRecords.length;
    const sent = smsRecords.filter((s) => s.status === 'Sent').length;
    const pending = smsRecords.filter((s) => s.status === 'Pending').length;
    const failed = smsRecords.filter((s) => s.status === 'Failed').length;

    const today = new Date().toISOString().split('T')[0];
    const todaysMessages = smsRecords.filter((s) => s.date === today).length;

    return { total, sent, pending, failed, todaysMessages };
  }, [smsRecords]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">SMS Broadcast</h1>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-bold text-lg">0 SMS</p>
              <p className="text-xs text-gray-500">Credit Balance</p>
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Low Balance
              </span>
            </div>
            <div className="border-l h-12"></div>
            <div className="text-center">
              <p className="font-bold text-lg">{stats.sent} SMS</p>
              <p className="text-xs text-gray-500">Credits Used</p>
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                91% Success Rate
              </span>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait"
            >
              <RefreshIcon className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </button>
            <button
              onClick={() => setActiveView('History')}
              className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center hover:bg-gray-50"
            >
              <EyeIcon className="h-5 w-5 mr-2" /> View Messages
            </button>
            <button
              onClick={() => setActiveView('Compose')}
              className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
            >
              <PaperAirplaneIcon className="h-5 w-5 mr-2" /> Compose SMS
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">SMS Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total SMS"
            value={stats.total.toString()}
            icon={PaperAirplaneIcon}
            color="border-blue-200"
            subtext="Today's Messages"
            subvalue={stats.todaysMessages.toString()}
          />
          <StatCard
            title="Sent"
            value={stats.sent.toString()}
            icon={CheckCircleIcon}
            color="border-green-200"
            subtext="Partial"
            subvalue="0"
          />
          <div className="grid grid-rows-2 gap-2">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-yellow-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
              </div>
              <ClockIcon className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-red-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-gray-800">{stats.failed}</p>
              </div>
              <ExclamationIcon className="h-6 w-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>
      <footer className="text-center text-sm text-gray-500 mt-8 pt-4">
        © {new Date().getFullYear()} All rights reserved. Church Management System
      </footer>
    </div>
  );
};

export default SmsDashboard;
