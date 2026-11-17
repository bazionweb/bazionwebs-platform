import React from 'react';
import { AlertTriangle, Trash2, Edit } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName: string;
  itemDetails?: { [key: string]: unknown };
  type: 'edit' | 'delete';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemDetails,
  type,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const isDelete = type === 'delete';
  const headerColor = isDelete
    ? 'bg-gradient-to-r from-red-600 to-red-700'
    : 'bg-gradient-to-r from-blue-600 to-blue-700';
  const buttonColor = isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
  const Icon = isDelete ? Trash2 : Edit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className={`p-4 border-b text-white rounded-t-xl ${headerColor}`}>
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6" />
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <p className={`text-sm mt-1 ${isDelete ? 'text-red-100' : 'text-blue-100'}`}>{message}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Item Name */}
          <div
            className={`border rounded-lg p-4 ${isDelete ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 ${isDelete ? 'text-red-600' : 'text-blue-600'}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium mb-2 ${isDelete ? 'text-red-800' : 'text-blue-800'}`}>
                  {isDelete ? 'Item to Delete:' : 'Item to Edit:'}
                </p>
                <p className={`font-semibold ${isDelete ? 'text-red-700' : 'text-blue-700'}`}>{itemName}</p>

                {/* Item Details */}
                {itemDetails && (
                  <div className={`mt-2 space-y-1 text-sm ${isDelete ? 'text-red-600' : 'text-blue-600'}`}>
                    {Object.entries(itemDetails).map(([key, value]) => (
                      <p key={key}>
                        <strong>{key}:</strong> {String(value)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div
            className={`border rounded-lg p-3 ${
              isDelete ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${isDelete ? 'text-yellow-600' : 'text-green-600'}`} />
              <p className={`text-sm ${isDelete ? 'text-yellow-700' : 'text-green-700'}`}>
                {isDelete
                  ? 'This action will move the item to the recycle bin. You can restore it later if needed.'
                  : 'This will open the edit form where you can modify the item details.'}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${buttonColor}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Icon className="w-4 h-4" />
                {isDelete ? 'Delete Item' : 'Edit Item'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
