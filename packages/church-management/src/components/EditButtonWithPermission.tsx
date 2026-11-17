import React from 'react';
import { PencilIcon } from './Icons';
import { Edit, Lock } from 'lucide-react';
import { User } from './userData';
import { PermissionRequest, PermissionRequestModal } from './PermissionRequest';
import { usePermissionRequest } from '../hooks/usePermissionRequest';

interface EditButtonWithPermissionProps {
  currentUser: User | null;
  dataType: PermissionRequest['dataType'];
  dataId: string | number;
  dataName: string;
  onEdit: () => void;
  requestType?: 'edit' | 'delete';
  className?: string;
  children?: React.ReactNode;
}

const EditButtonWithPermission: React.FC<EditButtonWithPermissionProps> = ({
  currentUser,
  dataType,
  dataId,
  dataName,
  onEdit,
  requestType = 'edit',
  className = '',
  children,
}) => {
  const {
    showRequestModal,
    pendingRequest,
    canEditDirectly,
    submitPermissionRequest,
    cancelPermissionRequest,
    handleEditAction,
  } = usePermissionRequest(currentUser);

  const handleClick = () => {
    handleEditAction(dataType, dataId, dataName, onEdit, requestType);
  };

  // If user can edit directly, show normal edit button
  if (canEditDirectly) {
    return (
      <>
        <button
          onClick={onEdit}
          className={`flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${className}`}
          title={`${requestType === 'edit' ? 'Edit' : 'Delete'} ${dataType}`}
        >
          {requestType === 'edit' ? <Edit className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
          {children || (requestType === 'edit' ? 'Edit' : 'Delete')}
        </button>
      </>
    );
  }

  // If user needs permission, show request button
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 ${className}`}
        title={`Request permission to ${requestType} ${dataType}`}
      >
        <Lock className="w-4 h-4" />
        {children || `Request ${requestType === 'edit' ? 'Edit' : 'Delete'}`}
      </button>

      {/* Permission Request Modal */}
      {showRequestModal && pendingRequest && currentUser && (
        <PermissionRequestModal
          isOpen={showRequestModal}
          onClose={cancelPermissionRequest}
          onSubmit={submitPermissionRequest}
          dataType={pendingRequest.dataType}
          dataName={pendingRequest.dataName}
          requestType={pendingRequest.requestType}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default EditButtonWithPermission;
