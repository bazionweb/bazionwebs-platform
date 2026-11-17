import React from 'react';
import { User, Camera, Mail, CheckCircle, XCircle } from 'lucide-react';
import { RegistrationData } from '../EnterpriseRegistration';

interface RegistrationStepPersonalProps {
  formData: RegistrationData;
  emailValid: boolean;
  emailTouched: boolean;
  emailExists: boolean;
  onChange: (field: keyof RegistrationData, value: string | boolean) => void;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setEmailTouched: (touched: boolean) => void;
}

export const RegistrationStepPersonal: React.FC<RegistrationStepPersonalProps> = ({
  formData,
  emailValid,
  emailTouched,
  emailExists,
  onChange,
  onAvatarChange,
  setEmailTouched,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>

      {/* Avatar Upload */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          {formData.avatar ? (
            <img
              src={formData.avatar}
              alt="Avatar Preview"
              className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
              <User className="h-8 w-8 text-gray-400" />
            </div>
          )}
          <label
            htmlFor="avatar-upload"
            className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full cursor-pointer shadow-md transition-colors"
          >
            <Camera className="w-3 h-3" />
          </label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
        </div>
        <span className="text-xs text-gray-500 mt-2">Optional Profile Picture</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="John"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Doe"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <div className="relative">
          <input
            type="email"
            value={formData.email}
            onChange={(e) => onChange('email', e.target.value)}
            onBlur={() => setEmailTouched(true)}
            className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm ${
              emailTouched && (!emailValid || emailExists) ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="john.doe@example.com"
            required
          />
          <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          {emailTouched && formData.email && (
            <div className="absolute right-3 top-2.5">
              {emailValid && !emailExists ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          )}
        </div>
        {emailTouched && !emailValid && formData.email && (
          <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
        )}
        {emailExists && <p className="text-xs text-red-600 mt-1">This email address is already registered</p>}
      </div>
    </div>
  );
};

export default RegistrationStepPersonal;
