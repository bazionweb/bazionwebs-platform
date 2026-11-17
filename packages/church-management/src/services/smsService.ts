import { storage } from './storage';
import { SmsRecord } from '../components/smsData';

export const smsService = {
  /**
   * Simulates sending an SMS.
   * In a real app, this would make an HTTP POST to Twilio/Hubtel/Arkesel using the apiKey.
   */
  sendSms: async (recipients: string[], message: string): Promise<{ success: boolean; message: string }> => {
    const settings = await storage.appSettings.getAll();

    if (!settings.smsConfig.apiKey) {
      return { success: false, message: 'SMS API Key is missing. Please configure it in Settings.' };
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Create a history record
    const newRecord: SmsRecord = {
      id: Date.now(),
      recipientCount: recipients.length,
      message: message,
      status: 'Sent', // In a real API, this might be 'Pending' initially
      date: new Date().toISOString().split('T')[0],
    };

    // Save to storage
    await storage.sms.save(newRecord);

    return { success: true, message: `Successfully sent to ${recipients.length} recipients.` };
  },

  getCredits: async (): Promise<number> => {
    // In a real app, fetch this from the provider API
    return 500; // Mock balance
  },
};
