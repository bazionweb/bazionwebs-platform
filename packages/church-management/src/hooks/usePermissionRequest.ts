import { useState } from 'react';
import { PermissionRequest } from '../components/PermissionRequest';
import { User, needsPermissionRequest } from '../components/userData';
import { usePermissionRequests } from './usePermissionRequests';
import { useToast } from '../components/ToastContext';

export const usePermissionRequest = (currentUser: User | null) => {
  const { showToast } = useToast();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const { data: requests, addRequest } = usePermissionRequests();

  const [pendingRequest, setPendingRequest] = useState<{
    dataType: PermissionRequest['dataType'];
    dataId: string | number;
    dataName: string;
    requestType: 'edit' | 'delete';
    onApproved: () => void;
  } | null>(null);

  // Check if user can edit without permission request
  const canEditDirectly = (user: User | null): boolean => {
    return !needsPermissionRequest(user);
  };

  // Request permission to edit existing data
  const requestEditPermission = async (
    dataType: PermissionRequest['dataType'],
    dataId: string | number,
    dataName: string,
    requestType: 'edit' | 'delete' = 'edit',
    onApproved: () => void,
  ): Promise<boolean> => {
    if (!currentUser) return false;

    // Check if user already has active permission
    const activePermission = requests.find(
      (r) =>
        r.requesterId === currentUser.id &&
        r.dataType === dataType &&
        r.dataId === dataId.toString() &&
        r.requestType === requestType &&
        r.status === 'approved' &&
        (!r.expiresAt || new Date(r.expiresAt) > new Date()),
    );

    if (activePermission) {
      // User already has permission, proceed directly
      onApproved();
      return true;
    }

    // Show permission request modal
    setPendingRequest({
      dataType,
      dataId,
      dataName,
      requestType,
      onApproved,
    });
    setShowRequestModal(true);
    return false;
  };

  // Submit permission request
  const submitPermissionRequest = async (reason: string): Promise<void> => {
    if (!currentUser || !pendingRequest) return;

    try {
      await addRequest({
        requesterId: currentUser.id,
        requesterName: currentUser.username,
        requesterEmail: currentUser.email,
        requestType: pendingRequest.requestType,
        dataType: pendingRequest.dataType,
        dataId: pendingRequest.dataId.toString(),
        dataName: pendingRequest.dataName,
        reason,
      });

      showToast(`Permission request sent to Super Admin for review. You'll be notified when approved.`, 'info');

      setShowRequestModal(false);
      setPendingRequest(null);
    } catch (error) {
      console.error('Failed to submit permission request:', error);
      showToast('Failed to submit permission request', 'error');
      throw error;
    }
  };

  // Cancel permission request
  const cancelPermissionRequest = () => {
    setShowRequestModal(false);
    setPendingRequest(null);
  };

  // Check and handle edit action
  const handleEditAction = async (
    dataType: PermissionRequest['dataType'],
    dataId: string | number,
    dataName: string,
    editAction: () => void,
    requestType: 'edit' | 'delete' = 'edit',
  ): Promise<void> => {
    if (!currentUser) return;

    // If user can edit directly (Super Admin, Admin), proceed
    if (canEditDirectly(currentUser)) {
      editAction();
      return;
    }

    // Check if user has active permission
    const activePermission = requests.find(
      (r) =>
        r.requesterId === currentUser.id &&
        r.dataType === dataType &&
        r.dataId === dataId.toString() &&
        r.requestType === requestType &&
        r.status === 'approved' &&
        (!r.expiresAt || new Date(r.expiresAt) > new Date()),
    );

    if (activePermission) {
      // User has active permission, proceed
      editAction();
      return;
    }

    // Request permission
    await requestEditPermission(dataType, dataId, dataName, requestType, editAction);
  };

  return {
    showRequestModal,
    pendingRequest,
    canEditDirectly: canEditDirectly(currentUser),
    requestEditPermission,
    submitPermissionRequest,
    cancelPermissionRequest,
    handleEditAction,
  };
};

export default usePermissionRequest;
