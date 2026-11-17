
export interface Mailbox {
  id: string;
  email: string;
  userId: string;
  isActive: boolean;
}

export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface IEmailProvider {
  createMailbox(userId: string, email: string, password: string): Promise<Mailbox>;
  deleteMailbox(email: string): Promise<void>;
  sendEmail(message: EmailMessage): Promise<void>;
  resetMailboxPassword(email: string, newPassword: string): Promise<void>;
}
