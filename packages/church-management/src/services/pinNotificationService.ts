/**
 * PIN Notification Service
 *
 * Sends the auto-generated Member Portal PIN to a member via:
 *   1. SMS  — using Africa's Talking (https://africastalking.com) — Kenya/Africa native
 *   2. SMS  — using Textbee (https://textbee.dev) — Free Android phone gateway (fallback)
 *   2. Email — using Resend  (https://resend.com) — transactional email
 *
 * API keys are stored in the CMS Settings page (Settings → SMS Config / Email Config)
 * and persisted in localStorage under the 'hkm_sms_settings' / 'hkm_notification_settings' keys.
 *
 * Both channels are attempted independently. Failure in one does not block the other.
 * All errors are logged to the console but never thrown — the Registration Fee transaction
 * must always succeed even if a notification fails.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationSettings {
  atApiKey: string; // Africa's Talking API key (Settings → SMS Config)
  atUsername: string; // Africa's Talking username (e.g. "hkmministries" or "sandbox")
  atSenderId: string; // Alphanumeric sender ID, e.g. "HKM MIN" (must be registered)
  textbeeApiKey?: string; // Textbee API Key
  textbeeDeviceId?: string; // Textbee Device ID
  resendApiKey: string; // Resend email API key (Settings → Email Config)
  resendFromEmail: string; // Verified sender email, e.g. "noreply@hkmministries.org"
  portalUrl: string; // e.g. "https://hkmministries.org/login"
}

export interface PinNotificationPayload {
  memberId: string;
  memberName: string;
  phone?: string | null;
  email?: string | null;
  pin: string;
  orgEmail?: string;
  branding?: {
    name?: string;
    shortName?: string;
    tagline?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    websiteUrl?: string;
    portalUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  };
  platformBranding?: {
    name?: string;
    logoUrl?: string;
    markUrl?: string;
    websiteUrl?: string;
    tagline?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  };
}

export interface NotificationResult {
  sms: { sent: boolean; error?: string };
  email: { sent: boolean; error?: string };
}

// ─── Settings Loader ─────────────────────────────────────────────────────────

function loadNotificationSettings(): NotificationSettings {
  let smsKey = '';
  let smsFrom = 'HKM MIN';
  let atUsername = 'sandbox';
  let textbeeApiKey = '';
  let textbeeDeviceId = '';
  let emailKey = '';
  let emailFrom = 'noreply@hkmministries.org';
  let portalUrl = 'https://hkmministries.org/login';

  try {
    const raw = localStorage.getItem('hkm_app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.smsConfig) {
        smsKey = parsed.smsConfig.apiKey || '';
        smsFrom = parsed.smsConfig.senderId || 'HKM MIN';
        atUsername = parsed.smsConfig.atUsername || 'sandbox';
        textbeeApiKey = parsed.smsConfig.textbeeApiKey || '';
        textbeeDeviceId = parsed.smsConfig.textbeeDeviceId || '';
      }
      if (parsed.emailConfig) {
        emailKey = parsed.emailConfig.resendApiKey || '';
        emailFrom = parsed.emailConfig.resendFromEmail || 'noreply@hkmministries.org';
        portalUrl = parsed.emailConfig.portalUrl || 'https://hkmministries.org/login';
      }
    }
  } catch {
    console.warn('[PinNotification] Could not parse hkm_app_settings');
  }

  return {
    atApiKey: smsKey,
    atUsername,
    atSenderId: smsFrom,
    textbeeApiKey,
    textbeeDeviceId,
    resendApiKey: emailKey,
    resendFromEmail: emailFrom,
    portalUrl,
  };
}

// ─── Retry Helper ────────────────────────────────────────────────────────────

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000,
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[PinNotification] Attempt ${attempt}/${maxRetries} failed: ${msg}`);
      if (attempt >= maxRetries) {
        throw error;
      }
      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry loop failed unexpectedly');
}

// ─── SMS via Textbee ─────────────────────────────────────────────────────────

async function sendSmsViaTextbee(
  payload: PinNotificationPayload,
  settings: NotificationSettings,
): Promise<{ sent: boolean; error?: string }> {
  if (!payload.phone) {
    return { sent: false, error: 'Member has no phone number on file.' };
  }
  if (!settings.textbeeApiKey || !settings.textbeeDeviceId) {
    return { sent: false, error: 'Textbee API key or Device ID not configured.' };
  }

  try {
    const backendUrl = import.meta.env.VITE_SMS_BACKEND_URL || 'http://localhost:3000/api/sms/send';

    const response = await withRetry(async () => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: payload.memberId,
          memberName: payload.memberName,
          phone: payload.phone!.replace(/\s+/g, ''),
          pin: payload.pin,
          portalUrl: settings.portalUrl,
          textbeeApiKey: settings.textbeeApiKey,
          textbeeDeviceId: settings.textbeeDeviceId,
        }),
      });
      if (!res.ok && res.status >= 500) {
        throw new Error(`SMS Backend API returned ${res.status}`);
      }
      return res;
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[PinNotification] SMS Backend API Error: ${response.status}`, result);
      return { sent: false, error: `SMS Backend API returned ${response.status}: ${JSON.stringify(result)}` };
    }

    console.warn(`[PinNotification] SMS successfully queued on backend for ${payload.phone}.`);
    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PinNotification] Unexpected error calling SMS Backend API:', err);
    return { sent: false, error: msg };
  }
}

// ─── SMS via Africa's Talking ────────────────────────────────────────────────
// Africa's Talking is the industry standard for Kenya.
// It natively supports Safaricom, Airtel Kenya, and custom alphanumeric Sender IDs.
// Sign up at: https://africastalking.com | Docs: https://developers.africastalking.com/docs/sms

async function sendSmsViaAfricasTalking(
  payload: PinNotificationPayload,
  settings: NotificationSettings,
): Promise<{ sent: boolean; error?: string }> {
  if (!payload.phone) {
    return { sent: false, error: 'Member has no phone number on file.' };
  }
  if (!settings.atApiKey) {
    return { sent: false, error: "Africa's Talking API key not configured. Go to Settings → SMS Config." };
  }

  const message =
    `HKM Ministries: Dear ${payload.memberName}, your Member Portal has been activated! ` +
    `Your Member ID: ${payload.memberId} | PIN: ${payload.pin} ` +
    `Login at: ${settings.portalUrl} — Keep your PIN private.`;

  // Format phone number to E.164 format (e.g. +254712345678)
  let phone = payload.phone!.replace(/\s+/g, '');
  if (phone.startsWith('0')) {
    phone = '+254' + phone.substring(1);
  } else if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  try {
    const response = await withRetry(async () => {
      // Africa's Talking uses URL-encoded form data
      const params = new URLSearchParams();
      params.append('username', settings.atUsername || 'sandbox');
      params.append('to', phone);
      params.append('message', message);
      if (settings.atSenderId) {
        params.append('from', settings.atSenderId);
      }

      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: settings.atApiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });
      if (!res.ok && res.status >= 500) {
        throw new Error(`Africa's Talking API returned ${res.status}`);
      }
      return res;
    });

    const result = await response.json();
    const recipients = result?.SMSMessageData?.Recipients;

    if (response.ok && recipients?.length > 0 && recipients[0].status === 'Success') {
      console.warn(`[PinNotification] SMS sent to ${phone} via Africa's Talking.`);
      return { sent: true };
    }

    const errMsg = recipients?.[0]?.status || result?.SMSMessageData?.Message || `HTTP ${response.status}`;
    console.error("[PinNotification] Africa's Talking error:", result);
    return { sent: false, error: `Africa's Talking: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PinNotification] SMS network error:', err);
    return { sent: false, error: `Network error: ${msg}` };
  }
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function safeEmailUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function buildPinEmailHtml(
  memberName: string,
  memberId: string,
  pin: string,
  portalUrl: string,
  orgEmail?: string,
  branding: PinNotificationPayload["branding"] = {},
  platformBranding: PinNotificationPayload["platformBranding"] = {},
): string {
  const safeColor = (value: string | undefined, fallback: string) =>
    value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  const platformName = escapeHtml(platformBranding.name || "Bazion Web");
  const platformPrimaryColor = safeColor(platformBranding.primaryColor, "#0B2F75");
  const platformSecondaryColor = safeColor(platformBranding.secondaryColor, "#17345E");
  const platformAccentColor = safeColor(platformBranding.accentColor, "#EF3024");
  const platformLogoUrl = safeEmailUrl(platformBranding.logoUrl, portalUrl)
    || safeEmailUrl("/brand/bazion-platform-logo.png", portalUrl);
  const safePlatformLogoUrl = platformLogoUrl ? escapeHtml(platformLogoUrl) : "";
  const platformMarkUrl = safeEmailUrl(platformBranding.markUrl, portalUrl)
    || safeEmailUrl(platformBranding.logoUrl?.replace(/bazion-platform-logo\.png$/, "bazion-platform-mark.png"), portalUrl)
    || safeEmailUrl("/brand/bazion-platform-mark.png", portalUrl);
  const safePlatformMarkUrl = platformMarkUrl ? escapeHtml(platformMarkUrl) : "";
  const safePlatformWebsiteUrl = safeEmailUrl(platformBranding.websiteUrl, portalUrl);
  const platformLogo = safePlatformLogoUrl
    ? `<img src="${safePlatformLogoUrl}" alt="${platformName}" width="88" height="78" style="display:block;width:88px;height:78px;object-fit:contain;border:0;background:#ffffff;border-radius:6px;">`
    : "";
  const platformFooterLogo = safePlatformMarkUrl
    ? `<img src="${safePlatformMarkUrl}" alt="${platformName}" width="48" height="39" style="display:block;width:48px;height:39px;object-fit:contain;border:0;background:#ffffff;border-radius:4px;">`
    : "";
  const name = escapeHtml(branding.name || "Heavenly God Kingdom Churches (HKM Ministries)");
  const shortName = escapeHtml(branding.shortName || "HKM Church");
  const tagline = escapeHtml(branding.tagline || "Church Management & Member Discipleship Portal");
  const websiteHref = safeEmailUrl(branding.websiteUrl, portalUrl) || safeEmailUrl(portalUrl, "https://hkmministries.org")?.replace(/\/[^/]*$/, "") || "https://hkmministries.org";
  const configuredPortal = branding.portalUrl || (branding.websiteUrl ? `${branding.websiteUrl.replace(/\/$/, "")}/portal/login` : portalUrl);
  const portalHref = safeEmailUrl(configuredPortal, websiteHref) || "https://hkmministries.org/login";
  const hasCustomBrand = Boolean(branding.name || branding.shortName || branding.logoUrl || branding.websiteUrl);
  const logoUrl = safeEmailUrl(branding.logoUrl, websiteHref) || (hasCustomBrand ? "" : "https://admin.hkmministries.org/hkm-logo.webp");
  const safeLogoUrl = escapeHtml(logoUrl);
  const safePortalHref = escapeHtml(portalHref);
  const safeWebsiteHref = escapeHtml(websiteHref);
  const primaryColor = safeColor(branding.primaryColor, "#16a34a");
  const secondaryColor = safeColor(branding.secondaryColor, "#0f172a");
  const accentColor = safeColor(branding.accentColor, "#d4af37");
  const logo = logoUrl
    ? `<img src="${safeLogoUrl}" alt="${shortName} Logo" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:50%;border:2px solid ${accentColor};background-color:#ffffff;object-fit:contain;" />`
    : `<span style="display:inline-flex;width:90px;height:90px;align-items:center;justify-content:center;border-radius:50%;border:2px solid ${accentColor};background:${primaryColor};color:#ffffff;font:700 32px Arial,Helvetica,sans-serif;">${escapeHtml(shortName.slice(0, 1).toUpperCase())}</span>`;
  const safeMemberName = escapeHtml(memberName);
  const safeMemberId = escapeHtml(memberId);
  const safePin = escapeHtml(pin);
  const safeOrgEmail = orgEmail ? escapeHtml(orgEmail) : undefined;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your ${shortName} Member Portal PIN</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- ── Email Card ───────────────────────────────────────── -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;
                      box-shadow:0 8px 40px rgba(15,23,42,0.12);">

          <!-- ── Header ──────────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(160deg,${platformSecondaryColor} 0%,${platformPrimaryColor} 100%);padding:0;text-align:center;position:relative;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:3px;background:${platformAccentColor};"></td>
                </tr>
              </table>
              <!-- Platform identity -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 18px;">
                <tr>
                  <td align="center">
                    ${platformLogo}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:12px 40px 0;">
                    <p style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;">${platformName}</p>
                    <p style="margin:4px 0 0;color:#dbeafe;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${escapeHtml(platformBranding.tagline || "Build, Host n Grow")}</p>
                    <div style="width:64px;height:1px;background:${platformAccentColor};margin:16px auto 14px;"></div>
                    <p style="margin:0;color:${accentColor};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${name}</p>
                    <div style="margin:12px auto 10px;">${logo}</div>
                    <h1 style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Member Portal Access</h1>
                    <p style="margin:8px 0 0;color:#dbeafe;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${tagline}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:3px;background:${platformAccentColor};"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ────────────────────────────────────────────── -->
          <tr>
            <td style="padding:40px 44px;">

              <p style="margin:0 0 8px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;
                         font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                Greetings,
              </p>
              <p style="margin:0 0 20px;color:#0f172a;font-family:Arial,Helvetica,sans-serif;
                         font-size:20px;font-weight:700;">
                Dear ${safeMemberName},
              </p>
              <p style="margin:0 0 28px;color:#475569;font-family:Arial,Helvetica,sans-serif;
                         font-size:15px;line-height:1.75;">
                Welcome to the <strong style="color:${primaryColor};">${shortName} Member Portal</strong>.
                Your account has been activated following confirmation of your Registration Fee.
                Use the secure credentials below to sign in.
              </p>

              ${
                orgEmail
                  ? `
              <!-- ── Church Email Box ──────────────────────────── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8f5ff;border:1.5px solid #c4b5fd;border-radius:12px;margin:0 0 28px;">
                <tr>
                  <td style="padding:20px 24px;text-align:center;">
                    <p style="margin:0 0 6px;color:#7c3aed;font-family:Arial,Helvetica,sans-serif;
                               font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                      Your Church Email Address
                    </p>
                    <p style="margin:0 0 6px;color:#4c1d95;font-family:Arial,Helvetica,sans-serif;
                               font-size:18px;font-weight:700;">
                      ${safeOrgEmail}
                    </p>
                    <p style="margin:0;color:#7c3aed;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                      This email forwards to your personal inbox.
                    </p>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              <!-- ── Credentials Box ───────────────────────────── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:linear-gradient(160deg,${secondaryColor} 0%,${primaryColor} 100%);
                            border-radius:16px;margin:0 0 28px;
                            box-shadow:0 8px 32px rgba(15,23,42,0.2);">
                <tr>
                  <td style="padding:32px;text-align:center;">
                    <!-- Member ID -->
                    <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-family:Arial,Helvetica,sans-serif;
                               font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">
                      Membership ID
                    </p>
                    <p style="margin:0 0 24px;color:#ffffff;font-family:'Courier New',Courier,monospace;
                               font-size:22px;font-weight:700;letter-spacing:6px;">
                      ${safeMemberId}
                    </p>
                    <!-- Gold divider -->
                    <div style="height:1px;background:${accentColor};
                                margin:0 0 24px;"></div>
                    <!-- PIN label -->
                    <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-family:Arial,Helvetica,sans-serif;
                               font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">
                      Your Personal PIN
                    </p>
                    <!-- PIN digits -->
                    <p style="margin:0;color:${accentColor};font-family:'Courier New',Courier,monospace;
                               font-size:48px;font-weight:700;letter-spacing:16px;
                               text-shadow:0 0 20px rgba(212,175,55,0.3);">
                      ${safePin}
                    </p>
                  </td>
                </tr>
                <!-- Gold bottom accent -->
                <tr>
                  <td style="height:3px;background:${accentColor};
                              border-radius:0 0 16px 16px;"></td>
                </tr>
              </table>

              <!-- ── CTA Button ─────────────────────────────────── -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:10px;background:${secondaryColor};">
                    <a href="${safePortalHref}"
                       style="display:inline-block;padding:15px 40px;color:${accentColor};font-family:Arial,Helvetica,sans-serif;
                              font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                              text-decoration:none;border-radius:10px;
                              border:1.5px solid ${accentColor};">
                      Sign In to Member Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ── Security Warning ───────────────────────────── -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fefce8;border:1px solid #fbbf24;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#78350f;font-family:Arial,Helvetica,sans-serif;
                               font-size:13px;line-height:1.65;">
                      &#9888;&#65039; <strong>Keep your PIN private.</strong>
                      ${shortName} staff will <strong>never</strong> ask you to share your PIN or password.
                      If you did not expect this email, please contact ${shortName} immediately.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── Divider ────────────────────────────────────── -->
              <div style="height:1px;background:#e2e8f0;margin:0 0 24px;"></div>

              <p style="margin:0;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;
                         font-size:13px;line-height:1.7;">
                Blessings,<br />
                <strong style="color:${primaryColor};">The ${shortName} Team</strong>
              </p>
            </td>
          </tr>

          <!-- ── Footer ──────────────────────────────────────────── -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                        padding:22px 44px;text-align:center;">
              <p style="margin:0 0 6px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                &copy; ${year} ${name}${branding.address ? ` &bull; ${escapeHtml(branding.address)}` : ""}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                <a href="${safeWebsiteHref}" style="color:${primaryColor};text-decoration:none;">${escapeHtml(branding.websiteUrl || "Visit our website")}</a>
                &nbsp;&bull;&nbsp;
                <a href="${safePortalHref}" style="color:${primaryColor};text-decoration:none;">${shortName} Portal</a>
              </p>
              ${branding.contactEmail ? `<p style="margin:6px 0 0;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${escapeHtml(branding.contactEmail)}${branding.contactPhone ? ` &bull; ${escapeHtml(branding.contactPhone)}` : ""}</p>` : ""}
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0;border-top:1px solid #e2e8f0;padding-top:14px;">
                <tr>
                  ${safePlatformMarkUrl ? `<td valign="middle" style="padding-right:8px;">${platformFooterLogo}</td>` : ""}
                  <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${platformPrimaryColor};">Powered by ${platformName}${safePlatformWebsiteUrl ? `<br /><a href="${escapeHtml(safePlatformWebsiteUrl)}" style="font-size:10px;font-weight:400;color:#64748b;text-decoration:none;">${escapeHtml(safePlatformWebsiteUrl.replace(/^https?:\/\//, ""))}</a>` : ""}</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- ── End Email Card ──────────────────────────────────── -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmailViaResend(
  payload: PinNotificationPayload,
  settings: NotificationSettings,
): Promise<{ sent: boolean; error?: string }> {
  if (!payload.email) {
    return { sent: false, error: 'Member has no email address on file.' };
  }
  if (!settings.resendApiKey) {
    return {
      sent: false,
      error: 'Resend API key not configured. Go to Settings → Email Config.',
    };
  }

  const platformBranding = payload.platformBranding ?? {
    name: "Bazion Web",
    logoUrl: safeEmailUrl("/brand/bazion-platform-logo.png", settings.portalUrl),
    markUrl: safeEmailUrl("/brand/bazion-platform-mark.png", settings.portalUrl),
    tagline: "Build, Host n Grow",
    primaryColor: "#0B2F75",
    secondaryColor: "#17345E",
    accentColor: "#EF3024",
  };
  const html = buildPinEmailHtml(
    payload.memberName,
    payload.memberId,
    payload.pin,
    settings.portalUrl,
    payload.orgEmail,
    payload.branding,
    platformBranding,
  );
  const senderDisplayName = `${platformBranding.name || "Bazion Web"} · ${payload.branding?.shortName || "Member Portal"}`
    .replace(/[<>\"\r\n]/g, "")
    .slice(0, 100);

  try {
    const response = await withRetry(async () => {
      const supabaseGraphqlUrl = import.meta.env.VITE_SUPABASE_GRAPHQL_URL || '';
      const supabaseBaseUrl = supabaseGraphqlUrl.replace('/graphql/v1', '');
      const fetchUrl = supabaseBaseUrl
        ? `${supabaseBaseUrl}/functions/v1/resend-proxy`
        : 'https://api.resend.com/emails';

      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderDisplayName} <${settings.resendFromEmail}>`,
          to: [payload.email],
          subject: `${platformBranding.name || "Bazion Web"} · Your ${payload.branding?.shortName || "Member Portal"} PIN — Keep This Private`,
          html,
        }),
      });
      if (!res.ok && res.status >= 500) {
        // Trigger retry on 5xx errors
        throw new Error(`Resend API returned ${res.status}`);
      }
      return res;
    });

    const result = await response.json();

    if (response.ok && result.id) {
      console.warn(`[PinNotification] Email sent to ${payload.email} via Resend. ID: ${result.id}`);
      return { sent: true };
    }

    const errMsg = result.message || result.name || `HTTP ${response.status}`;
    console.error('[PinNotification] Resend error:', result);
    return { sent: false, error: `Resend: ${errMsg}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PinNotification] Email network error:', err);
    return { sent: false, error: `Network error: ${msg}` };
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Send the auto-generated portal PIN to a member via SMS and Email.
 *
 * Both channels run in parallel. Failure in one channel does not affect the other.
 * Returns a result object so the caller can log or display outcomes.
 *
 * @example
 * const result = await sendPinNotification({
 *   memberId: 'HKM-1234567890',
 *   memberName: 'Jane Wanjiku',
 *   phone: '+254712345678',
 *   email: 'jane@example.com',
 *   pin: '847291',
 * });
 * console.log(result); // { sms: { sent: true }, email: { sent: true } }
 */
export async function sendPinNotification(payload: PinNotificationPayload): Promise<NotificationResult> {
  const settings = loadNotificationSettings();

  const results: NotificationResult = {
    sms: { sent: false, error: 'Not attempted' },
    email: { sent: false, error: 'Not attempted' },
  };

  // 1. Send SMS — Priority: Textbee (free) → Africa's Talking (paid, custom sender name)
  if (settings.textbeeApiKey && settings.textbeeDeviceId) {
    results.sms = await sendSmsViaTextbee(payload, settings);
  } else if (settings.atApiKey) {
    results.sms = await sendSmsViaAfricasTalking(payload, settings);
  } else {
    results.sms = {
      sent: false,
      error: "Neither Textbee nor Africa's Talking are configured. Go to Settings → SMS Config.",
    };
  }

  // 2. Send Email
  results.email = await sendEmailViaResend(payload, settings);

  console.warn('[PinNotification] Results:', results);
  return results;
}
