import type { OutboxDelivery } from "./outbox.js";
import { renderEmailTemplate } from "./templates.js";

export interface EmailTransportLike {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId?: string }>;
}

export interface SmsHttpAdapterConfig {
  webhookUrl?: string | undefined;
  bearerToken?: string | undefined;
  senderId?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}

export function renderNotificationContent(delivery: OutboxDelivery): {
  subject: string;
  text: string;
  html: string;
} {
  return renderEmailTemplate(
    delivery.payload.template,
    delivery.payload.to,
    delivery.payload.subject,
    delivery.payload.variables,
  );
}

export class SmtpEmailNotificationAdapter {
  constructor(
    private readonly transport: EmailTransportLike,
    private readonly emailFrom: string,
  ) {}

  async send(delivery: OutboxDelivery): Promise<{ providerMessageId: string }> {
    const rendered = renderNotificationContent(delivery);
    const info = await this.transport.sendMail({
      from: this.emailFrom,
      to: delivery.payload.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return { providerMessageId: info.messageId ?? delivery.id };
  }
}

export class HttpSmsNotificationAdapter {
  private readonly webhookUrl: string;
  private readonly bearerToken: string;
  private readonly senderId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SmsHttpAdapterConfig = {}) {
    this.webhookUrl = (config.webhookUrl ?? "").trim();
    this.bearerToken = (config.bearerToken ?? "").trim();
    this.senderId = (config.senderId ?? "BAZION").trim();
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(delivery: OutboxDelivery): Promise<{ providerMessageId: string }> {
    if (!this.webhookUrl) {
      const error = new Error("SMS delivery requested but NOTIFICATION_SMS_WEBHOOK_URL is not configured.");
      error.name = "SMS_PROVIDER_NOT_CONFIGURED";
      throw error;
    }

    const rendered = renderNotificationContent(delivery);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.bearerToken) headers.authorization = `Bearer ${this.bearerToken}`;

    const response = await this.fetchImpl(this.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        senderId: this.senderId,
        tenantId: delivery.tenantId,
        to: delivery.payload.to,
        template: delivery.payload.template,
        message: rendered.text,
      }),
    });

    if (!response.ok) {
      const error = new Error(`SMS provider returned HTTP ${response.status}.`);
      error.name = `SMS_HTTP_${response.status}`;
      throw error;
    }

    const body = await response.json().catch(() => null) as { id?: string; messageId?: string } | null;
    return { providerMessageId: body?.messageId ?? body?.id ?? delivery.id };
  }
}
