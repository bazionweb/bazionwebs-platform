import React from 'react';
import { User } from '../userData';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface UserConfirmModalProps {
  pendingUserData: Partial<User>;
  isEditMode: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Presentational confirmation modal for user addition/update.
 */
const UserConfirmModal: React.FC<UserConfirmModalProps> = ({ pendingUserData, isEditMode, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center gap-3">
          <CheckCircle className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold">{isEditMode ? 'Confirm User Update' : 'Confirm New User'}</h2>
            <p className="text-xs text-emerald-100">Review user configuration before saving</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2 text-sm">
            <p>
              <strong>Username:</strong> {pendingUserData.username}
            </p>
            <p>
              <strong>Email:</strong> {pendingUserData.email}
            </p>
            <p>
              <strong>Role:</strong>{' '}
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                {pendingUserData.role}
              </span>
            </p>
            {pendingUserData.role !== 'Super Admin' && (
              <p>
                <strong>Permission Level:</strong> {pendingUserData.permissionLevel}
              </p>
            )}
            {pendingUserData.assignedSections && pendingUserData.assignedSections.length > 0 && (
              <div>
                <strong>Assigned Sections ({pendingUserData.assignedSections.length}):</strong>
                <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                  {pendingUserData.assignedSections.map((sec) => (
                    <span key={sec} className="px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {isEditMode
                ? 'Updating user profile and permission assignments.'
                : 'A new user account will be created with the assigned permissions.'}
            </p>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            {isEditMode ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserConfirmModal;
