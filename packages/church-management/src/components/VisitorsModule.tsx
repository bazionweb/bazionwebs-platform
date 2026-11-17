import React, { useState } from 'react';
import VisitorManagementPage from './VisitorManagementPage';
import VisitorDetailsPage from './VisitorDetailsPage';
import AddVisitorPage from './AddVisitorPage';
import { Visitor, FollowUp } from './visitorData';
import { Member } from './memberData';

interface VisitorsModuleProps {
  visitors: Visitor[];
  onSaveVisitor: (visitorData: Omit<Visitor, 'id' | 'initials' | 'registeredDate' | 'followUps'>) => void;
  onUpdateVisitor: (visitorData: Visitor) => void;
  onDeleteVisitor: (id: number) => void;
  onConvertToMember: (visitorId: number) => void;
  onSaveFollowUp: (visitorId: number, followUpData: Omit<FollowUp, 'id' | 'visitorId'>) => void;
  onDeleteFollowUp: (visitorId: number, followUpId: number) => void;
  members: Member[];
}

const VisitorsModule: React.FC<VisitorsModuleProps> = ({
  visitors,
  onSaveVisitor,
  onUpdateVisitor,
  onDeleteVisitor,
  onConvertToMember,
  onSaveFollowUp,
  onDeleteFollowUp,
  members: _members,
}) => {
  const [view, setView] = useState<'list' | 'details' | 'add'>('list');
  const [selectedVisitorId, setSelectedVisitorId] = useState<number | null>(null);
  const [visitorToEdit, setVisitorToEdit] = useState<Visitor | null>(null);

  const handleViewDetails = (id: number) => {
    setSelectedVisitorId(id);
    setView('details');
  };

  const handleRegisterVisitor = () => {
    setVisitorToEdit(null);
    setView('add');
  };

  const handleEditVisitor = (visitor: Visitor) => {
    setVisitorToEdit(visitor);
    setView('add'); // Re-use the add page for editing
  };

  const handleBack = () => {
    setView('list');
    setSelectedVisitorId(null);
    setVisitorToEdit(null);
  };

  const handleSaveAndBack = (
    visitorData: Omit<Visitor, 'id' | 'initials' | 'registeredDate' | 'followUps'> | Visitor,
  ) => {
    const getInitials = (name: string) =>
      name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    if (visitorToEdit) {
      onUpdateVisitor({ ...visitorToEdit, ...visitorData, initials: getInitials(visitorData.name) });
    } else {
      onSaveVisitor(visitorData);
    }
    handleBack();
  };

  const handleDeleteAndBack = (id: number) => {
    onDeleteVisitor(id);
    handleBack();
  };

  const handleConvertAndBack = (id: number) => {
    onConvertToMember(id);
    handleBack();
  };

  const selectedVisitor = visitors.find((v) => v.id === selectedVisitorId);

  switch (view) {
    case 'add':
      return <AddVisitorPage onBack={handleBack} onSave={handleSaveAndBack} visitorToEdit={visitorToEdit} />;
    case 'details':
      if (selectedVisitor) {
        return (
          <VisitorDetailsPage
            visitor={selectedVisitor}
            onBack={handleBack}
            onEdit={handleEditVisitor}
            onDelete={handleDeleteAndBack}
            onConvertToMember={handleConvertAndBack}
            onSaveFollowUp={onSaveFollowUp}
            onDeleteFollowUp={onDeleteFollowUp}
          />
        );
      }
      return (
        <VisitorManagementPage
          visitors={visitors}
          onViewDetails={handleViewDetails}
          onRegisterVisitor={handleRegisterVisitor}
        />
      );
    case 'list':
    default:
      return (
        <VisitorManagementPage
          visitors={visitors}
          onViewDetails={handleViewDetails}
          onRegisterVisitor={handleRegisterVisitor}
        />
      );
  }
};

export default VisitorsModule;
