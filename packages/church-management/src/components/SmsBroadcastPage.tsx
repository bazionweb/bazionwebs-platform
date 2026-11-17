import React, { useState } from 'react';
import SmsDashboard from './SmsDashboard';
import ComposeSmsPage from './ComposeSmsPage';
import SmsHistoryPage from './SmsHistoryPage';
import { Member } from './memberData';
import { Group } from './GroupsManagementPage';
import { SmsRecord } from './smsData';

interface SmsBroadcastPageProps {
  members: Member[];
  groups: Group[];
  smsRecords: SmsRecord[];
  onLogSms: (record: Omit<SmsRecord, 'id'>) => Promise<void>;
  onDeleteSms: (id: number) => Promise<void>;
  onLoadMoreSms?: () => void;
  smsMonthsBack?: number;
}

const SmsBroadcastPage: React.FC<SmsBroadcastPageProps> = ({
  members,
  groups,
  smsRecords,
  onLogSms,
  onDeleteSms,
  onLoadMoreSms,
  smsMonthsBack,
}) => {
  const [activeView, setActiveView] = useState<'Dashboard' | 'Compose' | 'History'>('Dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard':
        return <SmsDashboard smsRecords={smsRecords} setActiveView={setActiveView} />;
      case 'Compose':
        return (
          <ComposeSmsPage
            members={members}
            groups={groups}
            onBack={() => setActiveView('Dashboard')}
            onLogSms={onLogSms}
          />
        );
      case 'History':
        return (
          <SmsHistoryPage
            smsRecords={smsRecords}
            onBack={() => setActiveView('Dashboard')}
            onDeleteSms={onDeleteSms}
            onLoadMore={onLoadMoreSms}
            monthsBack={smsMonthsBack}
          />
        );
      default:
        return <SmsDashboard smsRecords={smsRecords} setActiveView={setActiveView} />;
    }
  };

  return <div>{renderView()}</div>;
};

export default SmsBroadcastPage;
