
import { IEmailProvider, Mailbox, EmailMessage } from '../../ports';

export class ResendEmailAdapter implements IEmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createMailbox(_userId: string, _email: string, _password: string): Promise<Mailbox> {
    throw new Error('Resend does not support mailbox creation directly. Use a separate email service like Mailcow or Google Workspace for mailboxes.');
  }

  async deleteMailbox(_email: string): Promise<void> {
    throw new Error('Resend does not support mailbox management.');
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    const fromAddr = message.from || 'BMI University <noreply@bmiuniversities.org>';
    let response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ResendEmailAdapter] Initial send failed (${response.status}): ${errorText}`);
      
      // Fallback to onboarding@resend.dev if custom sender domain is rejected
      if (!fromAddr.includes('onboarding@resend.dev')) {
        console.warn(`[ResendEmailAdapter] Retrying with onboarding@resend.dev...`);
        const fallbackResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            reply_to: message.replyTo,
            cc: message.cc,
            bcc: message.bcc,
          }),
        });

        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          throw new Error(`Failed to send email via fallback: ${fallbackResponse.status} ${fallbackError}`);
        }
        return;
      }
      throw new Error(`Failed to send email: ${response.status} ${errorText}`);
    }
  }

  async resetMailboxPassword(_email: string, _newPassword: string): Promise<void> {
    throw new Error('Resend does not support mailbox password management.');
  }
}
