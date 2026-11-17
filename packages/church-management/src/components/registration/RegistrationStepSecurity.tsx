import React from 'react';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { RegistrationData } from '../EnterpriseRegistration';
import { PasswordCriteria, getPasswordStrength, getPasswordStrengthInfo } from '../../utils/registrationValidation';

interface RegistrationStepSecurityProps {
  formData: RegistrationData;
  showPassword: boolean;
  showConfirmPassword: boolean;
  passwordCriteria: PasswordCriteria;
  passwordsMatch: boolean;
  onChange: (field: keyof RegistrationData, value: string | boolean) => void;
  setShowPassword: (show: boolean) => void;
  setShowConfirmPassword: (show: boolean) => void;
}

export const RegistrationStepSecurity: React.FC<RegistrationStepSecurityProps> = ({
  formData,
  showPassword,
  showConfirmPassword,
  passwordCriteria,
  passwordsMatch,
  onChange,
  setShowPassword,
  setShowConfirmPassword,
}) => {
  const passwordScore = getPasswordStrength(passwordCriteria);
  const strengthInfo = getPasswordStrengthInfo(passwordScore);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Security Settings</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => onChange('password', e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="••••••••"
            required
          />
          <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {formData.password && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Password Strength:</span>
            <span className={`font-semibold ${strengthInfo.color}`}>{strengthInfo.label}</span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full ${strengthInfo.barColor} transition-all duration-300`}
              style={{ width: `${passwordScore}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              {passwordCriteria.minLength ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.minLength ? 'text-gray-700' : 'text-gray-400'}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {passwordCriteria.hasUppercase ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.hasUppercase ? 'text-gray-700' : 'text-gray-400'}>
                Uppercase letter
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {passwordCriteria.hasLowercase ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.hasLowercase ? 'text-gray-700' : 'text-gray-400'}>
                Lowercase letter
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {passwordCriteria.hasNumber ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.hasNumber ? 'text-gray-700' : 'text-gray-400'}>Number</span>
            </div>
            <div className="flex items-center space-x-1">
              {passwordCriteria.hasSpecialChar ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.hasSpecialChar ? 'text-gray-700' : 'text-gray-400'}>
                Special character
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {passwordCriteria.noCommonPatterns ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className={passwordCriteria.noCommonPatterns ? 'text-gray-700' : 'text-gray-400'}>
                No common patterns
              </span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm ${
              formData.confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="••••••••"
            required
          />
          <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {formData.confirmPassword && !passwordsMatch && (
          <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
        )}
      </div>
    </div>
  );
};

export default RegistrationStepSecurity;
