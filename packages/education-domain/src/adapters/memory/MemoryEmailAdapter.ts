
import { IEmailProvider, Mailbox, EmailMessage } from '../../ports';

export class MemoryEmailAdapter implements IEmailProvider {
  private mailboxes: Map<string, Mailbox & { password: string }> = new Map();
  public sentEmails: EmailMessage[] = [];

  async createMailbox(userId: string, email: string, password: string): Promise<Mailbox> {
    const id = crypto.randomUUID();
    const mailbox: Mailbox & { password: string } = {
      id,
      email,
      userId,
      isActive: true,
      password,
    };
    this.mailboxes.set(email, mailbox);
    return mailbox;
  }

  async deleteMailbox(email: string): Promise<void> {
    const mailbox = this.mailboxes.get(email);
    if (mailbox) {
      mailbox.isActive = false;
      this.mailboxes.set(email, mailbox);
    }
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    this.sentEmails.push(message);
    console.log('Email sent:', message);
  }

  async resetMailboxPassword(email: string, newPassword: string): Promise<void> {
    const mailbox = this.mailboxes.get(email);
    if (mailbox) {
      mailbox.password = newPassword;
    }
  }
}
