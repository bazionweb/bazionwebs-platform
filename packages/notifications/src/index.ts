export interface NotificationMessage {
  tenantId: string | null;
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string | number>;
}

export interface NotificationProvider {
  sendEmail(message: NotificationMessage): Promise<{ providerMessageId: string }>;
  sendSms(message: NotificationMessage): Promise<{ providerMessageId: string }>;
}

export * from "./outbox.js";
