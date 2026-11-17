import React, { useState, useMemo } from 'react';
import { SmsRecord } from './smsData';
import { ArrowLeftIcon, ClipboardListIcon } from './Icons';
import SmsDetailModal from './SmsDetailModal';

interface SmsHistoryPageProps {
  smsRecords: SmsRecord[];
  onBack: () => void;
  onDeleteSms: (id: number) => Promise<void>;
  onLoadMore?: () => void;
  monthsBack?: number;
}

const getStatusChip = (status: SmsRecord['status']) => {
  switch (status) {
    case 'Sent':
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    case 'Pending':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
      );
    case 'Failed':
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
  }
};

const SmsHistoryPage: React.FC<SmsHistoryPageProps> = ({ smsRecords, onBack, onDeleteSms, onLoadMore, monthsBack }) => {
  const [filterStatus, setFilterStatus] = useState<'All' | SmsRecord['status']>('All');
  const [selectedSms, setSelectedSms] = useState<SmsRecord | null>(null);

  const filteredRecords = useMemo(() => {
    const sorted = [...smsRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filterStatus === 'All') {
      return sorted;
    }
    return sorted.filter((record) => record.status === filterStatus);
  }, [smsRecords, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">SMS Message History</h1>
          <p className="mt-1 text-gray-600">A log of all broadcasted messages.</p>
        </div>
        <button
          onClick={onBack}
          className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to SMS Dashboard
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-md font-semibold text-gray-700 flex items-center">
            <ClipboardListIcon className="h-5 w-5 mr-2 text-gray-500" />
            Showing {filteredRecords.length} of {smsRecords.length} messages
          </h3>
          <div>
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 mr-2">
              Filter by status:
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'All' | SmsRecord['status'])}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="All">All Statuses</option>
              <option value="Sent">Sent</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-600 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 bg-gray-50">Date</th>
                <th className="px-6 py-3 bg-gray-50">Message</th>
                <th className="px-6 py-3 text-center bg-gray-50">Recipients</th>
                <th className="px-6 py-3 bg-gray-50">Status</th>
                <th className="px-6 py-3 text-right bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="bg-white border-b hover:bg-gray-50 cursor-pointer">
                  <td onClick={() => setSelectedSms(record)} className="px-6 py-4 whitespace-nowrap">
                    {new Date(record.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td
                    onClick={() => setSelectedSms(record)}
                    className="px-6 py-4 max-w-sm truncate"
                    title={record.message}
                  >
                    {record.message}
                  </td>
                  <td onClick={() => setSelectedSms(record)} className="px-6 py-4 text-center">
                    {record.recipientCount}
                  </td>
                  <td onClick={() => setSelectedSms(record)} className="px-6 py-4">
                    {getStatusChip(record.status)}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this record?')) onDeleteSms(record.id);
                      }}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <p className="text-center p-8 text-gray-500">
              {filterStatus === 'All'
                ? 'There are no messages in the history.'
                : `No messages found with status "${filterStatus}".`}
            </p>
          )}
          {onLoadMore && (
            <div className="flex flex-col items-center py-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">Showing the last {monthsBack || 3} months</p>
              <button
                onClick={onLoadMore}
                className="bg-white border border-gray-300 text-gray-600 text-sm font-medium py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Load {(monthsBack || 3) + 3} months of history
              </button>
            </div>
          )}
        </div>
      </div>
      {selectedSms && <SmsDetailModal sms={selectedSms} onClose={() => setSelectedSms(null)} />}
    </div>
  );
};

export default SmsHistoryPage;
