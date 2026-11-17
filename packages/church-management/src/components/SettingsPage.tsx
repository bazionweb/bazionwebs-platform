import React, { useState, useEffect } from 'react';
import { InputField, TextAreaField } from './FormControls';
import {
  ChurchIcon,
  SmsIcon,
  DatabaseIcon,
  LocationMarkerIcon,
  PhoneIcon,
  MailIcon,
  SaveIcon,
  ShieldCheckIcon,
  AiIcon,
  LockIcon,
} from './Icons';
import SecuritySettings from './SecuritySettings';
import DatabaseManagement from './DatabaseManagement';
import { User } from './userData';
import { storage, AppSettings } from '../services/storage';
import { useTheme, ThemeName } from './ThemeContext';
import { Palette, AtSign } from 'lucide-react';
import { useApolloClient, gql } from '@apollo/client';

const GET_CHURCH_SETTINGS = gql`
  query GetAdminChurchSettings {
    church_settingsCollection(first: 1) {
      edges {
        node {
          id
          name
          address
          phone
          email
        }
      }
    }
  }
`;

const UPDATE_CHURCH_SETTINGS = gql`
  mutation UpdateAdminChurchSettings($name: String!, $address: String, $phone: String, $email: String) {
    updatechurch_settingsCollection(
      set: { name: $name, address: $address, phone: $phone, email: $email }
      filter: { id: { eq: 1 } }
    ) {
      records {
        id
        name
      }
    }
  }
`;

interface SettingsPageProps {
  currentUser: User | null;
}

// Theme Settings Component
const ThemeSettings: React.FC = () => {
  const { theme, setTheme, availableThemes } = useTheme();

  const themeInfo: Record<ThemeName, { name: string; colors: string[] }> = {
    green: { name: 'Forest Green', colors: ['#16a34a', '#15803d', '#166534'] },
    blue: { name: 'Ocean Blue', colors: ['#2563eb', '#1d4ed8', '#1e40af'] },
    purple: { name: 'Royal Purple', colors: ['#9333ea', '#7e22ce', '#6b21a8'] },
    orange: { name: 'Sunset Orange', colors: ['#ea580c', '#c2410c', '#9a3412'] },
    dark: { name: 'Dark Mode', colors: ['#374151', '#1f2937', '#111827'] },
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold text-gray-700 flex items-center">
          <Palette className="h-6 w-6 mr-2 text-purple-600" />
          Appearance Settings
        </h2>
        <p className="text-sm text-gray-500 mt-1">Customize the look and feel of your application</p>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-700 mb-4">Color Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {availableThemes.map((themeName) => (
            <button
              key={themeName}
              onClick={() => setTheme(themeName)}
              className={`p-4 rounded-lg border-2 transition-all ${
                theme === themeName ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex gap-1 mb-2 justify-center">
                {themeInfo[themeName].colors.map((color, i) => (
                  <div key={i} className="w-6 h-6 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </div>
              <p
                className={`text-sm font-medium text-center ${
                  theme === themeName ? 'text-green-700' : 'text-gray-600'
                }`}
              >
                {themeInfo[themeName].name}
              </p>
              {theme === themeName && <p className="text-xs text-green-600 text-center mt-1">Active</p>}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Theme changes are applied immediately and saved automatically. The sidebar and accent
          colors will update to match your selected theme.
        </p>
      </div>
    </div>
  );
};

const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('General');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const apolloClient = useApolloClient();

  useEffect(() => {
    const loadSettings = async () => {
      const data = await storage.appSettings.getAll();
      // Also try to fetch live church info from Supabase and merge it
      try {
        const res = await apolloClient.query({
          query: GET_CHURCH_SETTINGS,
          fetchPolicy: 'network-only',
        });
        const node = res.data?.church_settingsCollection?.edges?.[0]?.node;
        if (node) {
          data.churchInfo = {
            name: node.name || data.churchInfo.name,
            address: node.address || data.churchInfo.address,
            phone: node.phone || data.churchInfo.phone,
            email: node.email || data.churchInfo.email,
          };
        }
      } catch {
        // DB not reachable - fall back to localStorage
      }
      setSettings(data);
      setLoading(false);
    };
    loadSettings();
  }, [apolloClient]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings) {
      // 1. Always save everything to localStorage for SMS/email services
      await storage.appSettings.save(settings);
      // 2. Persist church info to Supabase so the member portal can read it
      try {
        const { errors } = await apolloClient.mutate({
          mutation: UPDATE_CHURCH_SETTINGS,
          variables: {
            name: settings.churchInfo.name,
            address: settings.churchInfo.address,
            phone: settings.churchInfo.phone,
            email: settings.churchInfo.email,
          },
        });
        if (errors) {
          console.error('[Settings] GraphQL errors:', errors);
          throw new Error('GraphQL returned errors');
        }
      } catch (err) {
        console.warn('[Settings] Could not sync church info to Supabase:', err);
      }
      alert('Settings saved successfully!');
    }
  };

  const updateChurchInfo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      churchInfo: { ...settings.churchInfo, [e.target.name]: e.target.value },
    });
  };

  const updateSmsConfig = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      smsConfig: { ...settings.smsConfig, [e.target.name]: e.target.value },
    });
  };

  const updateEmailConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      emailConfig: { ...settings.emailConfig, [e.target.name]: e.target.value },
    });
  };

  const updateImprovmxConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      improvmxConfig: { ...settings.improvmxConfig, [e.target.name]: e.target.value },
    });
  };

  const updateAiConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      aiApiKey: e.target.value,
    });
  };

  if (loading || !settings) return <div>Loading settings...</div>;

  const TabButton: React.FC<{ name: string; label: string; icon: React.ElementType }> = ({
    name,
    label,
    icon: Icon,
  }) => {
    const isActive = activeTab === name;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(name)}
        className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          isActive
            ? 'border-church-green text-church-green-dark'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <Icon className="h-5 w-5 mr-2" />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-emerald-50 to-green-100 shadow">
        <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
        <p className="mt-1 text-gray-600">Configure your church management system</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-2 px-4">
            <TabButton name="General" label="Church Info" icon={ChurchIcon} />
            <TabButton name="Appearance" label="Appearance" icon={Palette} />
            <TabButton name="Security" label="Security" icon={ShieldCheckIcon} />
            <TabButton name="SMS" label="SMS Config" icon={SmsIcon} />
            <TabButton name="Email" label="Email Config" icon={MailIcon} />
            <TabButton name="ImprovMX" label="Email Aliases" icon={AtSign} />
            <TabButton name="AI" label="AI Configuration" icon={AiIcon} />
            <TabButton name="Database" label="Database" icon={DatabaseIcon} />
          </nav>
        </div>

        <div className="p-8 relative min-h-[400px]">
          {/* Background decorations */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-green-100 rounded-full opacity-50 z-0 pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-12 w-48 h-48 bg-yellow-100 rounded-full opacity-30 z-0 pointer-events-none"></div>

          <div className="relative z-10">
            <form onSubmit={handleSave}>
              {activeTab === 'General' && (
                <div className="space-y-8 animate-fade-in-up">
                  <h2 className="text-xl font-semibold text-gray-700">Church Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField
                      name="name"
                      label="Church Name"
                      type="text"
                      value={settings.churchInfo.name}
                      onChange={updateChurchInfo}
                      required
                      icon={ChurchIcon}
                    />
                    <InputField
                      name="address"
                      label="Church Address"
                      type="text"
                      value={settings.churchInfo.address}
                      onChange={updateChurchInfo}
                      icon={LocationMarkerIcon}
                    />
                    <InputField
                      name="phone"
                      label="Church Phone"
                      type="tel"
                      value={settings.churchInfo.phone}
                      onChange={updateChurchInfo}
                      icon={PhoneIcon}
                    />
                    <InputField
                      name="email"
                      label="Church Email"
                      type="email"
                      value={settings.churchInfo.email}
                      onChange={updateChurchInfo}
                      icon={MailIcon}
                    />
                  </div>
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="bg-church-green hover:bg-church-green-dark text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save Changes
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'Appearance' && <ThemeSettings />}

              {activeTab === 'SMS' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-700">SMS Gateway Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure your bulk SMS provider details here.</p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                    <div>
                      <h3 className="text-base font-semibold text-gray-700">
                        Africa's Talking (Premium — Custom Sender Name)
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Kenya's leading SMS gateway. Supports Safaricom &amp; Airtel. Allows custom sender names like
                        "HKM MIN". Sign up free at{' '}
                        <a
                          href="https://africastalking.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          africastalking.com
                        </a>
                        . Leave API key blank to use Textbee instead.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        name="apiKey"
                        label="Africa's Talking API Key"
                        type="password"
                        value={settings.smsConfig.apiKey}
                        onChange={updateSmsConfig}
                        icon={LockIcon}
                      />
                      <InputField
                        name="atUsername"
                        label="Africa's Talking Username"
                        type="text"
                        value={settings.smsConfig.atUsername || ''}
                        onChange={updateSmsConfig}
                        placeholder="e.g., hkmministries (or 'sandbox' for testing)"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        name="senderId"
                        label="Sender ID (Custom Name)"
                        type="text"
                        value={settings.smsConfig.senderId}
                        onChange={updateSmsConfig}
                        placeholder="e.g., HKM MIN (must be registered with AT)"
                      />
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <h3 className="text-base font-semibold text-gray-700 mb-2">
                        Textbee (Free — Android Phone Gateway)
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Routes SMS through your Android phone's SIM card for free. No custom sender name supported. Sign
                        up at{' '}
                        <a
                          href="https://textbee.dev"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          textbee.dev
                        </a>
                        . If both are configured, Textbee takes priority.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                          name="textbeeApiKey"
                          label="Textbee API Key"
                          type="password"
                          value={settings.smsConfig.textbeeApiKey || ''}
                          onChange={updateSmsConfig}
                          icon={LockIcon}
                        />
                        <InputField
                          name="textbeeDeviceId"
                          label="Textbee Device ID"
                          type="text"
                          value={settings.smsConfig.textbeeDeviceId || ''}
                          onChange={updateSmsConfig}
                          placeholder="e.g., 60d5ec9a..."
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-700">Message Templates</h2>
                    <p className="text-sm text-gray-500 mt-1">Defaults for automated messages.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextAreaField
                      name="welcomeMessage"
                      label="Welcome Message"
                      value={settings.smsConfig.welcomeMessage}
                      onChange={updateSmsConfig}
                      rows={4}
                    />
                    <TextAreaField
                      name="birthdayMessage"
                      label="Birthday Message"
                      value={settings.smsConfig.birthdayMessage}
                      onChange={updateSmsConfig}
                      rows={4}
                    />
                  </div>
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="bg-church-green hover:bg-church-green-dark text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save SMS Settings
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'Email' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-700">Email Gateway Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure Resend for automated transactional emails.</p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-6">
                      <InputField
                        name="resendApiKey"
                        label="Resend API Key"
                        type="password"
                        value={settings.emailConfig.resendApiKey}
                        onChange={updateEmailConfig}
                        required
                        icon={LockIcon}
                      />
                      <InputField
                        name="resendFromEmail"
                        label="Sender Email Address"
                        type="email"
                        value={settings.emailConfig.resendFromEmail}
                        onChange={updateEmailConfig}
                        required
                        placeholder="e.g., noreply@hkmministries.org"
                        icon={MailIcon}
                      />
                      <InputField
                        name="portalUrl"
                        label="Member Portal URL"
                        type="text"
                        value={settings.emailConfig.portalUrl}
                        onChange={updateEmailConfig}
                        required
                        placeholder="e.g., https://hkmministries.org/login"
                      />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="bg-church-green hover:bg-church-green-dark text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save Email Settings
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'ImprovMX' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                      <AtSign className="h-6 w-6 mr-2 text-indigo-600" />
                      Email Aliases (ImprovMX)
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Configure ImprovMX to auto-generate @hkmministries.org forwarding aliases for members.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        name="apiKey"
                        label="ImprovMX API Key"
                        type="password"
                        value={settings.improvmxConfig.apiKey}
                        onChange={updateImprovmxConfig}
                        icon={LockIcon}
                      />
                      <InputField
                        name="domain"
                        label="Church Domain"
                        type="text"
                        value={settings.improvmxConfig.domain}
                        onChange={updateImprovmxConfig}
                        placeholder="e.g., hkmministries.org"
                        icon={AtSign}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Aliases are auto-created when a member's registration fee (500 KSH) is completed.
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save Email Alias Settings
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'AI' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                      <AiIcon className="h-6 w-6 mr-2 text-purple-600" />
                      Artificial Intelligence
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Configure the Google Gemini API Key to enable AI features (Message generation, Announcements,
                      etc).
                    </p>
                  </div>
                  <div className="p-6 border border-purple-200 rounded-lg bg-purple-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.aiApiKey}
                        onChange={updateAiConfig}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your AI Studio API Key"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Don't have a key?{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-600 hover:underline"
                      >
                        Get one here
                      </a>
                      .
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg flex items-center shadow transition duration-300"
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save AI Configuration
                    </button>
                  </div>
                </div>
              )}
            </form>

            {activeTab === 'Security' && <SecuritySettings currentUser={currentUser} />}

            {activeTab === 'Database' && <DatabaseManagement />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
