import React, { useState } from 'react';
import { Visitor, FollowUp } from './visitorData';
import { ArrowLeftIcon, PencilIcon, UsersIcon, CalendarIcon, PaperAirplaneIcon, TrashIcon, PlusIcon } from './Icons';
import AddFollowUpModal from './AddFollowUpModal';
import SendVisitorSmsModal from './SendVisitorSmsModal';
import ActionButtons from './ActionButtons';

interface VisitorDetailsPageProps {
  visitor: Visitor;
  onBack: () => void;
  onEdit: (visitor: Visitor) => void;
  onDelete: (id: number) => void;
  onConvertToMember: (id: number) => void;
  onSaveFollowUp: (visitorId: number, followUpData: Omit<FollowUp, 'id' | 'visitorId'>) => void;
  onDeleteFollowUp: (visitorId: number, followUpId: number) => void;
}

const getStatusChip = (status: Visitor['status']) => {
  switch (status) {
    case 'In follow up':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">{status}</span>
      );
    case 'Converted':
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">{status}</span>;
    case 'New':
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{status}</span>;
  }
};

const QuickActionButton: React.FC<{
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}> = ({ icon: Icon, title, subtitle, onClick, color, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center text-left p-3 rounded-lg transition-colors ${color} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div className="p-2 bg-white/50 rounded-lg mr-3">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs opacity-80">{subtitle}</p>
    </div>
  </button>
);

const VisitorDetailsPage: React.FC<VisitorDetailsPageProps> = ({
  visitor,
  onBack,
  onEdit,
  onDelete,
  onConvertToMember,
  onSaveFollowUp,
  onDeleteFollowUp,
}) => {
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const handleDelete = () => {
    onDelete(visitor.id);
  };

  const handleConvert = () => {
    if (
      window.confirm('Are you sure you want to convert this visitor to a member? They will be marked as converted.')
    ) {
      onConvertToMember(visitor.id);
    }
  };

  const handleSaveFollowUpAndClose = (followUpData: Omit<FollowUp, 'id' | 'visitorId'>) => {
    onSaveFollowUp(visitor.id, followUpData);
    setIsFollowUpModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Visitor Details</h1>
          <p className="mt-1 text-gray-600">
            First visit:{' '}
            {new Date(visitor.firstVisit).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Visitors
          </button>
          <button
            onClick={() => onEdit(visitor)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <PencilIcon className="h-4 w-4 mr-2" /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Visitor Information</h3>
            <div className="flex items-start">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center font-bold text-gray-600 text-3xl mr-6">
                {visitor.initials}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 capitalize">{visitor.name}</h2>
                {getStatusChip(visitor.status)}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-500">Contact Information</p>
                    <p className="text-gray-700">{visitor.phone}</p>
                    <p className="text-gray-700">{visitor.email || 'No email'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-500">Visit Information</p>
                    <p className="text-gray-700">
                      First Visit: {new Date(visitor.firstVisit).toLocaleDateString('en-GB')}
                    </p>
                    <p className="text-gray-700">Heard From: {visitor.heardFrom}</p>
                    <p className="text-gray-700">
                      Registered: {new Date(visitor.registeredDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleConvert}
                    disabled={visitor.status === 'Converted'}
                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-gray-400"
                  >
                    Convert to Member
                  </button>
                  <button
                    onClick={() => setIsFollowUpModalOpen(true)}
                    className="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Add Follow-up
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Follow-up History</h3>
              <button
                onClick={() => setIsFollowUpModalOpen(true)}
                className="text-sm font-semibold text-green-600 hover:underline flex items-center"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Add New
              </button>
            </div>
            {visitor.followUps && visitor.followUps.length > 0 ? (
              <ul className="space-y-4">
                {visitor.followUps
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((f) => (
                    <li key={f.id} className="border-l-4 border-green-500 pl-4 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {f.interactionType} on{' '}
                            {new Date(f.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-gray-600">{f.notes}</p>
                          {f.outcome && <p className="text-xs text-gray-500 mt-1">Outcome: {f.outcome}</p>}
                          {f.nextFollowUpDate && (
                            <p className="text-xs text-yellow-600 mt-1 font-semibold">
                              Next Follow-up: {new Date(f.nextFollowUpDate).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => onDeleteFollowUp(visitor.id, f.id)}
                          className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Delete this follow-up"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 py-6">No follow-up history recorded.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">Quick Actions</h3>
          <QuickActionButton
            icon={PencilIcon}
            title="Edit Visitor"
            subtitle="Update visitor information"
            onClick={() => onEdit(visitor)}
            color="bg-blue-50 text-blue-700 hover:bg-blue-100"
          />
          <QuickActionButton
            icon={CalendarIcon}
            title="Add Follow-up"
            subtitle="Record a follow-up interaction"
            onClick={() => setIsFollowUpModalOpen(true)}
            color="bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          />
          <QuickActionButton
            icon={UsersIcon}
            title="Convert to Member"
            subtitle="Register as a church member"
            onClick={handleConvert}
            color="bg-green-50 text-green-700 hover:bg-green-100"
            disabled={visitor.status === 'Converted'}
          />
          <QuickActionButton
            icon={PaperAirplaneIcon}
            title="Send SMS"
            subtitle="Send a text message to this visitor"
            onClick={() => setIsSmsModalOpen(true)}
            color="bg-purple-50 text-purple-700 hover:bg-purple-100"
          />

          <div className="pt-2 border-t">
            <ActionButtons
              onDelete={handleDelete}
              itemName={visitor.name}
              itemType="Visitor"
              itemDetails={{
                Phone: visitor.phone,
                Email: visitor.email || 'No email',
                'First Visit': new Date(visitor.firstVisit).toLocaleDateString('en-GB'),
                Status: visitor.status,
                'Heard From': visitor.heardFrom,
              }}
              size="md"
              variant="both"
              deleteLabel="Delete Visitor"
            />
          </div>
        </div>
      </div>

      {isFollowUpModalOpen && (
        <AddFollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onSave={handleSaveFollowUpAndClose}
        />
      )}

      {isSmsModalOpen && (
        <SendVisitorSmsModal visitor={visitor} isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} />
      )}
    </div>
  );
};
export default VisitorDetailsPage;
