import React from 'react';
import { RegistrationData } from '../EnterpriseRegistration';

interface RegistrationStepTermsProps {
  formData: RegistrationData;
  onChange: (field: keyof RegistrationData, value: string | boolean) => void;
}

export const RegistrationStepTerms: React.FC<RegistrationStepTermsProps> = ({ formData, onChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Terms & Privacy</h3>

      <div className="space-y-3">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={(e) => onChange('acceptTerms', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            required
          />
          <span className="text-xs text-gray-600">
            I agree to the{' '}
            <a href="#terms" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
              Terms of Service
            </a>{' '}
            and acknowledge the responsibilities of account usage within HKM MINISTRIES.
          </span>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.acceptPrivacy}
            onChange={(e) => onChange('acceptPrivacy', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            required
          />
          <span className="text-xs text-gray-600">
            I agree to the{' '}
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
              Privacy Policy
            </a>{' '}
            and consent to the processing of personal data for church management purposes.
          </span>
        </label>
      </div>
    </div>
  );
};

export default RegistrationStepTerms;
