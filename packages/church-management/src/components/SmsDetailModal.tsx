import React from 'react';
import { SmsRecord } from './smsData';
import { XCircleIcon, CalendarIcon, UsersIcon } from './Icons';

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

interface SmsDetailModalProps {
  sms: SmsRecord;
  onClose: () => void;
}

const SmsDetailModal: React.FC<SmsDetailModalProps> = ({ sms, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Message Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
            <p className="text-gray-700 whitespace-pre-wrap">{sms.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <CalendarIcon className="w-5 h-5 mr-2 text-gray-400" />
              <div>
                <p className="font-semibold">Date Sent</p>
                <p>
                  {new Date(sms.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center text-gray-600">
              <UsersIcon className="w-5 h-5 mr-2 text-gray-400" />
              <div>
                <p className="font-semibold">Recipients</p>
                <p>{sms.recipientCount}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-600">Status</p>
            {getStatusChip(sms.status)}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-b-lg text-right">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmsDetailModal;
