/**
 * storage.ts — App-level localStorage persistence layer.
 * Handles app settings (church info, SMS config, email config, AI key, biometrics, etc.)
 */

export interface ChurchInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface SmsConfig {
  apiKey: string;
  provider: string;
  senderId: string;
  atUsername?: string;
  textbeeApiKey?: string;
  textbeeDeviceId?: string;
  welcomeMessage: string;
  birthdayMessage: string;
}

export interface EmailConfig {
  resendApiKey: string;
  resendFromEmail: string;
  portalUrl: string;
}

export interface ImprovmxConfig {
  apiKey: string;
  domain: string;
}

export interface AppSettings {
  churchInfo: ChurchInfo;
  smsConfig: SmsConfig;
  emailConfig: EmailConfig;
  improvmxConfig: ImprovmxConfig;
  aiApiKey: string;
  biometrics: Record<string, boolean>;
}

const SETTINGS_KEY = 'hkm_app_settings';
const API_KEY_KEY = 'hkm_sms_api_key';

const defaultSettings: AppSettings = {
  churchInfo: { name: 'HKM Ministries', address: '', phone: '', email: '' },
  smsConfig: {
    apiKey: '',
    provider: 'arkesel',
    senderId: 'HKM',
    atUsername: '',
    textbeeApiKey: '',
    textbeeDeviceId: '',
    welcomeMessage: 'Welcome to HKM Ministries! We are glad to have you.',
    birthdayMessage: 'Happy Birthday! May God bless you abundantly.',
  },
  emailConfig: { resendApiKey: '', resendFromEmail: '', portalUrl: '' },
  improvmxConfig: { apiKey: '', domain: '' },
  aiApiKey: '',
  biometrics: {},
};

export const storage = {
  appSettings: {
    getAll: async (): Promise<AppSettings> => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return JSON.parse(JSON.stringify(defaultSettings)) as AppSettings;
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        return {
          churchInfo: { ...defaultSettings.churchInfo, ...(parsed.churchInfo ?? {}) },
          smsConfig: { ...defaultSettings.smsConfig, ...(parsed.smsConfig ?? {}) },
          emailConfig: { ...defaultSettings.emailConfig, ...(parsed.emailConfig ?? {}) },
          improvmxConfig: { ...defaultSettings.improvmxConfig, ...(parsed.improvmxConfig ?? {}) },
          aiApiKey: parsed.aiApiKey ?? '',
          biometrics: parsed.biometrics ?? {},
        };
      } catch {
        return JSON.parse(JSON.stringify(defaultSettings)) as AppSettings;
      }
    },
    save: async (settings: AppSettings): Promise<void> => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (settings.smsConfig?.apiKey) {
        localStorage.setItem(API_KEY_KEY, settings.smsConfig.apiKey);
      }
    },
  },

  getApiKey: async (): Promise<string | null> => {
    const direct = localStorage.getItem(API_KEY_KEY);
    if (direct) return direct;
    const settings = await storage.appSettings.getAll();
    return settings.smsConfig.apiKey || null;
  },

  exportBackup: async (): Promise<string> => {
    const backup: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          backup[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
        } catch {
          backup[key] = localStorage.getItem(key);
        }
      }
    }
    return JSON.stringify(backup, null, 2);
  },

  importBackup: async (data: string): Promise<void> => {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  },

  clearAll: async (): Promise<void> => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('hkm_')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  },

  sms: {
    save: async (_record: unknown): Promise<void> => {
      // SMS records are persisted to Supabase via GraphQL hooks.
    },
  },
};
