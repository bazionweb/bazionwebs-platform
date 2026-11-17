import React, { useMemo } from 'react';
import { ArrowLeftIcon, MailIcon, PhoneIcon, CollectionIcon } from './Icons';
import { Transaction } from './financeData';
import { Member } from './memberData';
import { User } from './userData';
import ActionButtons from './ActionButtons';

interface TitheHistoryPageProps {
  currentUser: User | null;
  memberId: string;
  transactions: Transaction[];
  members: Member[];
  onBack: () => void;
  onAddTithe: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
}

const TitheHistoryPage: React.FC<TitheHistoryPageProps> = ({
  currentUser,
  memberId,
  transactions,
  members,
  onBack,
  onAddTithe,
  onEdit,
  onDelete,
}) => {
  const member = useMemo(() => members.find((m) => m.id === memberId), [memberId, members]);

  const memberTitheHistory = useMemo(() => {
    return transactions
      .filter((t) => t.memberId === memberId && t.category === 'Tithe')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, memberId]);

  const titheSummary = useMemo(() => {
    const total = memberTitheHistory.reduce((sum, t) => sum + t.amount, 0);
    return { total, count: memberTitheHistory.length };
  }, [memberTitheHistory]);

  if (!member) {
    return (
      <div>
        <p>Member not found.</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  }

  const getInitial = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 capitalize">Tithe History: {member.name}</h1>
            <p className="mt-1 text-gray-600">View all tithe transactions for this member.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Tithe Tracking
            </button>
            <button
              onClick={onAddTithe}
              className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700"
            >
              Add Tithe
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-3xl font-bold text-green-700 flex-shrink-0">
            {getInitial(member.name)}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
            <div>
              <p className="text-sm text-gray-500">Contact Information</p>
              <div className="font-semibold text-gray-800 capitalize">{member.name}</div>
              {member.phone && (
                <div className="text-xs text-gray-600 flex items-center justify-center md:justify-start mt-1">
                  <PhoneIcon className="w-3 h-3 mr-1" />
                  {member.phone}
                </div>
              )}
              {member.email && (
                <div className="text-xs text-gray-600 flex items-center justify-center md:justify-start">
                  <MailIcon className="w-3 h-3 mr-1" />
                  {member.email}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Membership Details</p>
              <div className="font-semibold text-gray-800">{member.department}</div>
              <div className="text-xs text-gray-600 mt-1">
                Member since {new Date(member.dateAdded).toLocaleDateString('en-GB')}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tithe Summary</p>
              <div className="font-semibold text-gray-800">Total: KSH {titheSummary.total.toFixed(2)}</div>
              <div className="text-xs text-gray-600 mt-1">{titheSummary.count} Transactions</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center">
            <CollectionIcon className="w-5 h-5 mr-2" />
            Tithe Transaction History for {member.name}
          </h3>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-500 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Recorded By
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {memberTitheHistory.map((t) => (
                <tr key={t.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 font-bold text-green-600">KSH {t.amount.toFixed(2)}</td>
                  <td className="px-6 py-4">{t.description || 'No description provided'}</td>
                  <td className="px-6 py-4">{currentUser ? currentUser.username : 'System'}</td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      onEdit={() => onEdit(t)}
                      onDelete={() => onDelete(t.id)}
                      itemName={`Tithe - ${new Date(t.date).toLocaleDateString('en-GB')}`}
                      itemType="Tithe Transaction"
                      itemDetails={{
                        Member: member.name,
                        Date: new Date(t.date).toLocaleDateString('en-GB'),
                        Amount: `KSH ${t.amount.toFixed(2)}`,
                        Description: t.description || 'No description provided',
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
    </div>
  );
};

export default TitheHistoryPage;
