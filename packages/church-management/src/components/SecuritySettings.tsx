import React, { useState, useEffect } from 'react';
import { User } from './userData';
import { FaceIdIcon, FingerprintIcon, ShieldCheckIcon } from './Icons';
import { Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { storage } from '../services/storage';
import { is2FAEnabled } from '../services/security';
import TwoFactorSetup from './TwoFactorSetup';

interface SecuritySettingsProps {
  currentUser: User | null;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ currentUser }) => {
  const [isFaceIdEnabled, setIsFaceIdEnabled] = useState(false);
  const [isFingerprintEnabled, setIsFingerprintEnabled] = useState(false);
  const [is2FAActive, setIs2FAActive] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (currentUser) {
        const settings = await storage.appSettings.getAll();
        setIsFaceIdEnabled(settings.biometrics[`${currentUser.id}_face`] || false);
        setIsFingerprintEnabled(settings.biometrics[`${currentUser.id}_fingerprint`] || false);
        setIs2FAActive(await is2FAEnabled(currentUser.id));
      }
    };
    loadSettings();
  }, [currentUser]);

  const handleToggle = async (type: 'face' | 'fingerprint') => {
    if (!currentUser) return;

    const settings = await storage.appSettings.getAll();
    const key = `${currentUser.id}_${type}`;
    const currentValue = settings.biometrics[key] || false;
    const newValue = !currentValue;

    const updatedSettings = {
      ...settings,
      biometrics: {
        ...settings.biometrics,
        [key]: newValue,
      },
    };

    await storage.appSettings.save(updatedSettings);

    if (type === 'face') setIsFaceIdEnabled(newValue);
    else setIsFingerprintEnabled(newValue);

    const typeName = type === 'face' ? 'Face ID' : 'Fingerprint';
    alert(`${typeName} has been ${newValue ? 'enabled' : 'disabled'} for your account.`);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h2 className="text-xl font-semibold text-gray-700">Security Settings</h2>

      <div className="border border-gray-200 rounded-lg">
        <div className="p-5 bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2 text-gray-500" />
            Biometric Authentication
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Enable passwordless login using your device's security features. This is a simulation and does not use real
            biometric data.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Face ID Setting */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center">
              <FaceIdIcon className="h-8 w-8 mr-4 text-blue-500" />
              <div>
                <p className="font-semibold text-gray-700">Face ID Login</p>
                <p className={`text-sm ${isFaceIdEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {isFaceIdEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('face')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                isFaceIdEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {isFaceIdEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          {/* Fingerprint Setting */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center">
              <FingerprintIcon className="h-8 w-8 mr-4 text-green-500" />
              <div>
                <p className="font-semibold text-gray-700">Fingerprint Login</p>
                <p className={`text-sm ${isFingerprintEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {isFingerprintEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('fingerprint')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                isFingerprintEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isFingerprintEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication Section */}
      <div className="border border-gray-200 rounded-lg">
        <div className="p-5 bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-gray-500" />
            Two-Factor Authentication (2FA)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Add an extra layer of security by requiring a verification code from your authenticator app.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center">
              {is2FAActive ? (
                <ShieldCheck className="h-8 w-8 mr-4 text-green-500" />
              ) : (
                <ShieldOff className="h-8 w-8 mr-4 text-gray-400" />
              )}
              <div>
                <p className="font-semibold text-gray-700">Authenticator App</p>
                <p className={`text-sm ${is2FAActive ? 'text-green-600' : 'text-gray-500'}`}>
                  {is2FAActive ? 'Enabled - Your account is protected' : 'Not configured'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShow2FASetup(true)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                is2FAActive
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {is2FAActive ? 'Manage' : 'Set Up'}
            </button>
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && currentUser && (
        <TwoFactorSetup
          user={currentUser}
          onClose={async () => {
            setShow2FASetup(false);
            // Refresh 2FA status
            if (currentUser) {
              setIs2FAActive(await is2FAEnabled(currentUser.id));
            }
          }}
        />
      )}
    </div>
  );
};

export default SecuritySettings;
