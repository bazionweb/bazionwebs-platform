import type { OutboxDelivery } from "./outbox.js";
import { renderEmailTemplate } from "./templates.js";

function platformEmailBrandVariables(): Record<string, string> {
  const publicUrl = process.env.PUBLIC_STOREFRONT_URL?.trim() || process.env.AUTH_APP_URL?.trim() || "";
  let logoUrl = process.env.PLATFORM_BRAND_LOGO_URL?.trim() || "";
  if (!logoUrl && publicUrl) {
    try {
      logoUrl = new URL("/brand/bazion-platform-logo.png", publicUrl).toString();
    } catch {
      // A missing base URL should not block text-only notification delivery.
    }
  }
  return {
    platformBrandName: process.env.PLATFORM_BRAND_NAME?.trim() || "Bazion Web",
    platformLogoUrl: logoUrl,
    platformPrimaryColor: process.env.PLATFORM_BRAND_PRIMARY_COLOR?.trim() || "#0B2F75",
    platformSecondaryColor: process.env.PLATFORM_BRAND_SECONDARY_COLOR?.trim() || "#17345E",
    platformAccentColor: process.env.PLATFORM_BRAND_ACCENT_COLOR?.trim() || "#EF3024",
    platformTagline: process.env.PLATFORM_BRAND_TAGLINE?.trim() || "Build, Host n Grow",
    platformWebsiteUrl: publicUrl,
    platformSupportEmail: process.env.PLATFORM_BRAND_SUPPORT_EMAIL?.trim() || "",
  };
}

export interface EmailTransportLike {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId?: string }>;
}

function platformFromAddress(value: string): string {
  const platformName = (process.env.PLATFORM_BRAND_NAME?.trim() || "Bazion Web").replace(/[<>\r\n]/g, "");
  const address = value.trim();
  const bracketed = address.match(/<([^<>\s]+)>/);
  if (bracketed) return `${platformName} <${bracketed[1]}>`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return `${platformName} <${address}>`;
  return address;
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
    { ...delivery.payload.variables, ...platformEmailBrandVariables() },
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
      from: platformFromAddress(this.emailFrom),
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
