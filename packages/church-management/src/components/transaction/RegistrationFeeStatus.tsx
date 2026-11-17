import React from 'react';

interface RegistrationFeeStatusProps {
  pastRegistrationFees: number;
  registrationThreshold: number;
  currentAmount: number;
  projectedTotal: number;
  missingContactFields: string[];
  hasContact: boolean;
  thresholdMetOnSave: boolean;
  isPendingFee: boolean;
}

/**
 * Presentational component showing the registration fee progress,
 * contact-info status, and activation readiness banner.
 * Pure display — no hooks, no side-effects.
 */
const RegistrationFeeStatus: React.FC<RegistrationFeeStatusProps> = ({
  pastRegistrationFees,
  registrationThreshold,
  currentAmount,
  projectedTotal,
  missingContactFields,
  hasContact,
  thresholdMetOnSave,
  isPendingFee,
}) => {
  const isPaid = pastRegistrationFees >= registrationThreshold;
  const projectedMet = projectedTotal >= registrationThreshold;

  return (
    <div className="mt-3 space-y-2">
      <div
        className={`text-sm p-3 rounded border ${
          isPendingFee
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : isPaid
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}
      >
        <strong>Registration Status:</strong>
        <ul className="mt-2 space-y-2 list-none">
          {/* Paid status */}
          <li className="flex items-center gap-2">
            {isPaid ? (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-100 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
            )}
            <span className={isPaid ? 'text-green-700 font-medium' : ''}>
              Paid: KSH {pastRegistrationFees} / KSH {registrationThreshold}
            </span>
          </li>

          {/* After this entry */}
          {currentAmount > 0 && (
            <li className="flex items-center gap-2">
              {projectedMet ? (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-100 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
              )}
              <span className={projectedMet ? 'text-green-700 font-medium' : ''}>
                After this entry: KSH {projectedTotal} / KSH {registrationThreshold}
              </span>
            </li>
          )}

          {/* Contact status */}
          <li className="flex items-center gap-2">
            {missingContactFields.length === 0 ? (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-100 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
            )}
            <span className={missingContactFields.length === 0 ? 'text-green-700 font-medium' : ''}>
              Contact: {missingContactFields.length === 0 ? 'Complete' : `Missing: ${missingContactFields.join(', ')}`}
            </span>
          </li>
        </ul>
      </div>

      {thresholdMetOnSave && isPendingFee && (
        <div
          className={`text-sm p-3 rounded border ${
            hasContact ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {hasContact ? (
            <span>
              <strong>Ready to Activate:</strong> Threshold met and contact details present. Portal PIN will be
              generated and sent to the member.
            </span>
          ) : (
            <span>
              <strong>Cannot Activate:</strong> Threshold met but {missingContactFields.join(' and ')} is missing.
              Update the member&apos;s profile with {missingContactFields.join(' and ')} before saving.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RegistrationFeeStatus;
