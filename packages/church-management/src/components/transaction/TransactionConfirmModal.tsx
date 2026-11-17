import React from 'react';
import { Member } from '../memberData';
import { Transaction, IncomeCategory } from '../financeData';
import { CheckCircle, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';

export interface PendingTransaction extends Omit<Transaction, 'id'> {
  id?: number;
}

interface TransactionConfirmModalProps {
  pendingTransactionData: PendingTransaction;
  isEditMode: boolean;
  isSubmitting: boolean;
  validMembers: Member[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Presentational modal to confirm or cancel a pending transaction save.
 * All state lives in the parent (AddTransactionPage).
 */
const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  pendingTransactionData,
  isEditMode,
  isSubmitting,
  validMembers,
  onConfirm,
  onCancel,
}) => {
  const isIncome = pendingTransactionData.type === 'Income';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div
          className={`p-4 border-b text-white rounded-t-xl ${
            isIncome ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-red-600 to-red-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-lg font-bold">
              {isEditMode ? 'Confirm Transaction Update' : 'Confirm Transaction Addition'}
            </h2>
          </div>
          <p className={`text-sm mt-1 ${isIncome ? 'text-green-100' : 'text-red-100'}`}>
            Please review the transaction details before saving
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div
            className={`border rounded-lg p-4 ${
              isIncome ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <DollarSign className={`w-5 h-5 mt-0.5 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium mb-2 ${isIncome ? 'text-green-800' : 'text-red-800'}`}>
                  Transaction Details:
                </p>
                <div className={`space-y-1 text-sm ${isIncome ? 'text-green-700' : 'text-red-700'}`}>
                  <p>
                    <strong>Type:</strong> {pendingTransactionData.type}
                  </p>
                  <p>
                    <strong>Category:</strong> {pendingTransactionData.category}
                  </p>
                  <p>
                    <strong>Amount:</strong> KSH {pendingTransactionData.amount.toLocaleString()}
                  </p>
                  <p>
                    <strong>Date:</strong> {new Date(pendingTransactionData.date).toLocaleDateString()}
                  </p>
                  {pendingTransactionData.memberId && (
                    <p>
                      <strong>Member:</strong>{' '}
                      {validMembers.find((m) => m.id === pendingTransactionData.memberId)?.name}
                    </p>
                  )}
                  {pendingTransactionData.nonMemberName && (
                    <p>
                      <strong>Non-Member:</strong> {pendingTransactionData.nonMemberName}
                    </p>
                  )}
                  {pendingTransactionData.isAnonymous && (
                    <p>
                      <strong>Contributor:</strong> Anonymous
                    </p>
                  )}
                  {pendingTransactionData.description && (
                    <p>
                      <strong>Description:</strong> {pendingTransactionData.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Registration Fee special notice */}
          {(pendingTransactionData.category as IncomeCategory) === 'Registration Fee' &&
            pendingTransactionData.memberId && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Portal Activation Will Trigger:</p>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
                      <li>
                        Member status set to <strong>Active</strong>
                      </li>
                      <li>A unique 6-digit PIN will be auto-generated</li>
                      <li>Member portal access will be enabled</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-700">
                {isEditMode
                  ? 'This will update the existing transaction record.'
                  : `This will record a new ${pendingTransactionData.type.toLowerCase()} transaction.`}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className={`px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            } ${isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Transaction' : 'Add Transaction'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionConfirmModal;
