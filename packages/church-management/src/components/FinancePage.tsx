import React, { useState } from 'react';
import FinanceDashboard from './FinanceDashboard';
import TransactionsListPage from './TransactionsListPage';
import TitheTrackingPage from './TitheTrackingPage';
import WelfareTrackingPage from './WelfareTrackingPage';
import TitheHistoryPage from './TitheHistoryPage';
import { Transaction } from './financeData';
import { Member } from './memberData';
import { User } from './userData';

interface FinancePageProps {
  currentUser: User | null;
  transactions: Transaction[];
  members: Member[];
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  setActivePage: (page: string) => void;
}

const FinancePage: React.FC<FinancePageProps> = ({
  currentUser,
  transactions,
  members,
  onEditTransaction,
  onDeleteTransaction,
  setActivePage,
}) => {
  const [activeView, setActiveView] = useState('Dashboard');
  const [memberIdForHistory, setMemberIdForHistory] = useState<string | null>(null);

  const handleViewTitheHistory = (memberId: string) => {
    setMemberIdForHistory(memberId);
    setActiveView('TitheHistory');
  };

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard':
        return (
          <FinanceDashboard
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
            onEdit={onEditTransaction}
            onDelete={onDeleteTransaction}
          />
        );
      case 'Transactions':
        return (
          <TransactionsListPage
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
            onEdit={onEditTransaction}
            onDelete={onDeleteTransaction}
          />
        );
      case 'Tithes':
        return (
          <TitheTrackingPage
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
            onViewHistory={handleViewTitheHistory}
          />
        );
      case 'Welfare':
        return (
          <WelfareTrackingPage
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
          />
        );
      case 'TitheHistory':
        if (memberIdForHistory) {
          return (
            <TitheHistoryPage
              currentUser={currentUser}
              memberId={memberIdForHistory}
              transactions={transactions}
              members={members}
              onBack={() => setActiveView('Tithes')}
              onAddTithe={() => setActivePage('Add Transaction')}
              onEdit={onEditTransaction}
              onDelete={onDeleteTransaction}
            />
          );
        }
        // Fallback to Tithes page if no member is selected
        return (
          <TitheTrackingPage
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
            onViewHistory={handleViewTitheHistory}
          />
        );
      default:
        return (
          <FinanceDashboard
            setActiveView={setActiveView}
            setActivePage={setActivePage}
            transactions={transactions}
            members={members}
            onEdit={onEditTransaction}
            onDelete={onDeleteTransaction}
          />
        );
    }
  };

  return <div>{renderView()}</div>;
};

export default FinancePage;
