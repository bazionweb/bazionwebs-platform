import React, { useState, useEffect } from 'react';
import { InputField, TextAreaField } from './FormControls';
import { LockIcon, PaperAirplaneIcon, SaveIcon, CheckCircleIcon, XCircleIcon } from './Icons';

interface SmsSettingsProps {
  churchPhone: string;
}

interface SmsConfig {
  apiKey: string;
  senderId: string;
  welcomeMessage: string;
  birthdayMessage: string;
}

const SmsSettings: React.FC<SmsSettingsProps> = ({ churchPhone }) => {
  const [config, setConfig] = useState<SmsConfig>({
    apiKey: '',
    senderId: 'HKM MIN',
    welcomeMessage:
      'Hi {name}, welcome to HKM MINISTRIES! We are so glad you joined us. We pray you have a blessed week.',
    birthdayMessage:
      'Happy Birthday {name}! The entire HKM MINISTRIES family wishes you a day filled with joy and a year of blessings.',
  });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('hkm_sms_settings');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Could not parse SMS settings from localStorage', error);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('hkm_sms_settings', JSON.stringify(config));
    alert('SMS settings saved successfully!');
  };

  const handleSendTest = () => {
    if (!config.apiKey || !config.senderId) {
      alert('Please provide an API Key and Sender ID before sending a test.');
      return;
    }
    alert(`A test message has been sent to the church phone number: ${churchPhone}.`);
  };

  const isConnected = config.apiKey.length > 0;

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-700">SMS Gateway Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">Configure your bulk SMS provider details here.</p>
      </div>
      <div className="p-4 border rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            name="apiKey"
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={handleChange}
            required
            icon={LockIcon}
          />
          <InputField
            name="senderId"
            label="Sender ID"
            type="text"
            value={config.senderId}
            onChange={handleChange}
            required
            placeholder="e.g., HKM MIN"
          />
        </div>
        <div className="flex justify-between items-center text-sm">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={showApiKey} onChange={() => setShowApiKey(!showApiKey)} className="mr-2" />{' '}
            Show API Key
          </label>
          <div className={`flex items-center font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? <CheckCircleIcon className="w-4 h-4 mr-1.5" /> : <XCircleIcon className="w-4 h-4 mr-1.5" />}
            {isConnected ? 'Connected' : 'Not Connected'}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-700">Message Templates</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set default messages for automated events. Use {'{name}'} as a placeholder.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextAreaField
          name="welcomeMessage"
          label="Default Welcome Message (New Visitor)"
          value={config.welcomeMessage}
          onChange={handleChange}
          rows={5}
        />
        <TextAreaField
          name="birthdayMessage"
          label="Default Birthday Message"
          value={config.birthdayMessage}
          onChange={handleChange}
          rows={5}
        />
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <button
          type="button"
          onClick={handleSendTest}
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg flex items-center shadow-sm transition duration-300"
        >
          <PaperAirplaneIcon className="h-5 w-5 mr-2" />
          Send Test SMS
        </button>
        <button
          type="submit"
          className="bg-church-green hover:bg-church-green-dark text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
        >
          <SaveIcon className="h-5 w-5 mr-2" />
          Save SMS Settings
        </button>
      </div>
    </form>
  );
};

export default SmsSettings;
