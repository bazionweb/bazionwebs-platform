function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailBrand {
  name: string;
  logoUrl: string;
  tagline: string;
  supportEmail: string;
  websiteUrl: string;
  primary: string;
  secondary: string;
  accent: string;
}

function emailBrand(variables: Record<string, string | number>): EmailBrand {
  const appName = typeof variables.appName === "string" ? variables.appName.trim() : "";
  const name = typeof variables.brandName === "string" ? variables.brandName.trim() : "";
  const rawLogo = typeof variables.logoUrl === "string" ? variables.logoUrl : "";
  const rawSupport = typeof variables.supportEmail === "string" ? variables.supportEmail.trim() : "";
  const rawWebsite = typeof variables.websiteUrl === "string" ? variables.websiteUrl : "";
  return {
    name: name || appName || "Bazion Web",
    logoUrl: safeHttpUrl(rawLogo),
    tagline: typeof variables.tagline === "string" ? variables.tagline.trim() : "",
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSupport) ? rawSupport : "",
    websiteUrl: safeHttpUrl(rawWebsite),
    primary: safeColor(variables.primaryColor, "#0f172a"),
    secondary: safeColor(variables.secondaryColor, "#334155"),
    accent: safeColor(variables.accentColor, "#10b981"),
  };
}

function renderEmailShell(
  subject: string,
  brand: EmailBrand,
  content: string,
  sectionLabel?: string,
): string {
  const name = escapeHtml(brand.name);
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:contain;border:0;">`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">${name}</span>`;
  const tagline = brand.tagline
    ? `<div style="margin-top:6px;font-size:12px;line-height:1.5;color:#cbd5e1;">${escapeHtml(brand.tagline)}</div>`
    : "";
  const label = sectionLabel
    ? `<div style="margin-top:5px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#cbd5e1;font-weight:600;">${escapeHtml(sectionLabel)}</div>`
    : "";
  const support = brand.supportEmail
    ? `<a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accent};text-decoration:underline;">${escapeHtml(brand.supportEmail)}</a>`
    : "";
  const website = brand.websiteUrl
    ? `<a href="${escapeHtml(brand.websiteUrl)}" style="color:${brand.accent};text-decoration:underline;">${escapeHtml(brand.websiteUrl.replace(/^https?:\/\//, ""))}</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${brand.secondary};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;background:${brand.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background:${brand.primary};padding:24px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            ${brand.logoUrl ? `<td valign="middle" style="padding-right:14px;">${logo}</td><td valign="middle"><div style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;">${name}</div>${label}${tagline}</td>` : `<td valign="middle">${logo}${label}${tagline}</td>`}
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
          ${name}${website ? ` · ${website}` : ""}${support ? ` · Support: ${support}` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text: string, brand: EmailBrand): string {
  return `<h1 style="margin:0 0 16px;font-size:23px;font-weight:700;color:${brand.primary};line-height:1.3;">${text}</h1>`;
}

function paragraph(text: string, color = "#475569"): string {
  return `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${color};">${text}</p>`;
}

function button(url: string, label: string, brand: EmailBrand): string {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 22px;"><tr><td align="center" style="border-radius:7px;background:${brand.primary};"><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 25px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:7px;background:${brand.primary};">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderEmailTemplate(
  template: string,
  to: string,
  subjectOverride: string | undefined,
  variables: Record<string, string | number>,
): RenderedEmail {
  const brand = emailBrand(variables);
  const url = typeof variables.url === "string" ? safeHttpUrl(variables.url) : "";
  const token = typeof variables.token === "string" ? variables.token.trim() : "";
  const intro = typeof variables.intro === "string" ? variables.intro : "";
  const safeTo = escapeHtml(to);

  switch (template) {
    case "auth.password-reset": {
      const subject = subjectOverride || `Reset your ${brand.name} password`;
      const content = `${heading("Choose a new password", brand)}
        ${paragraph(`We received a request to reset the password for your account registered to <strong style="color:${brand.primary};">${safeTo}</strong>.`)}
        ${button(url, "Reset Password", brand)}
        ${token ? `<div style="background:#f1f5f9;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:${brand.secondary};"><p style="margin:0 0 7px;font-weight:700;">One-time reset token</p><code style="display:inline-block;font-family:monospace;font-size:14px;background:#ffffff;padding:6px 12px;border-radius:5px;border:1px solid #cbd5e1;word-break:break-all;color:${brand.primary};">${escapeHtml(token)}</code><p style="margin:7px 0 0;font-size:12px;color:#64748b;">Enter this token on the password reset page if your browser does not open the link.</p></div>` : ""}
        ${url ? `${paragraph("If the button does not work, copy and paste this link into your address bar:", "#64748b")}<p style="margin:0 0 22px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:${brand.accent};text-decoration:underline;">${escapeHtml(url)}</a></p>` : ""}
        <div style="border-top:1px solid #e2e8f0;padding-top:18px;margin-top:24px;">${paragraph("⏱ <strong>Security notice:</strong> This single-use link expires in 60 minutes.", "#64748b")}${paragraph("🛡 <strong>Did not request this?</strong> Ignore this email. Your current password remains unchanged.", "#64748b")}</div>`;
      const text = `Reset your ${brand.name} password\n\nWe received a request to reset the password for your account (${to}).\n\n${url ? `Choose a new password: ${url}\n` : ""}${token ? `One-time reset token: ${token}\n` : ""}\nThis single-use link expires in 60 minutes. If you did not request this change, you can ignore this email.\n\n${brand.name}`;
      return { subject, html: renderEmailShell(subject, brand, content, "Account security"), text };
    }

    case "auth.password-reset-complete": {
      const subject = subjectOverride || `Your ${brand.name} password was changed`;
      const content = `${heading("Password successfully changed", brand)}
        ${paragraph(`The password for your account (<strong>${safeTo}</strong>) was just updated.`)}
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 18px;margin:20px 0;color:#166534;font-size:14px;line-height:1.6;">✓ If you made this change, no further action is required. You can now sign in using your new password.</div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin:20px 0;color:#991b1b;font-size:13.5px;line-height:1.6;">⚠ <strong>Did not make this change?</strong> Contact ${escapeHtml(brand.name)} support immediately to secure your account.${brand.supportEmail ? ` ${escapeHtml(brand.supportEmail)}` : ""}</div>`;
      const text = `Password successfully changed\n\nThe password for your ${brand.name} account (${to}) was just updated.\n\nIf you made this change, you can sign in with your new password. If you did not make this change, contact support immediately.${brand.supportEmail ? ` ${brand.supportEmail}` : ""}`;
      return { subject, html: renderEmailShell(subject, brand, content, "Security confirmation"), text };
    }

    case "auth.email-verification": {
      const subject = subjectOverride || `Verify your ${brand.name} email`;
      const content = `${heading("Verify your email address", brand)}
        ${paragraph(`Please verify that <strong>${safeTo}</strong> belongs to you to activate your account.`)}
        ${button(url, "Verify Email", brand)}
        ${paragraph("This verification link expires in 60 minutes.", "#64748b")}`;
      const text = `Verify your ${brand.name} email\n\nPlease verify that ${to} belongs to you:${url ? `\n${url}` : ""}\n\nThis link expires in 60 minutes.`;
      return { subject, html: renderEmailShell(subject, brand, content, "Email verification"), text };
    }

    default: {
      const subject = subjectOverride || `Notification from ${brand.name}`;
      const messageIntro = intro || `You have a new notification from ${brand.name}.`;
      const actionLabel = typeof variables.actionLabel === "string" ? variables.actionLabel : `Continue to ${brand.name}`;
      const content = `${paragraph(escapeHtml(messageIntro), brand.secondary)}
        ${button(url, actionLabel, brand)}
        ${paragraph("If you did not request this, you can ignore this email.", "#64748b")}`;
      const text = url
        ? `${messageIntro}\n\n${actionLabel}: ${url}\n\nIf you did not request this, you can ignore this email.`
        : `${messageIntro}\n\nIf you did not request this, you can ignore this email.`;
      return { subject, html: renderEmailShell(subject, brand, content), text };
    }
  }
}
