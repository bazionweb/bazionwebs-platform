import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";
import nodemailer from "nodemailer";
import { ac, organizationRoles } from "./permissions.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required authentication environment variable: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const defaultTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000,http://localhost:4000")
  .split(",").map((value) => value.trim()).filter(Boolean);

export const authPool = new Pool({
  connectionString: required("AUTH_DATABASE_URL"),
  options: "-c search_path=auth",
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const tenantResolverPool = new Pool({
  connectionString: required("TENANT_RESOLVER_DATABASE_URL"),
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const tenantProvisionerPool = new Pool({
  connectionString: required("TENANT_PROVISIONER_DATABASE_URL"),
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const smtpHost = process.env.AUTH_SMTP_HOST?.trim();
const smtpTransport = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.AUTH_SMTP_PORT ?? "587"),
      secure: process.env.AUTH_SMTP_SECURE === "true",
      ...(process.env.AUTH_SMTP_USER && process.env.AUTH_SMTP_PASSWORD
        ? { auth: { user: process.env.AUTH_SMTP_USER, pass: process.env.AUTH_SMTP_PASSWORD } }
        : {}),
    })
  : null;

const emailFrom = process.env.AUTH_EMAIL_FROM ?? "Bazion Web <noreply@example.test>";
const appBaseUrl = process.env.AUTH_APP_URL ?? "http://localhost:3000";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function sendAuthEmail(to: string, subject: string, url: string, intro: string): Promise<void> {
  if (!smtpTransport) {
    if (nodeEnv === "production") throw new Error("Authentication email transport is not configured.");
    console.info("[bazion-auth-email:development]", { to, subject, url });
    return;
  }
  const safeUrl = escapeHtml(url);
  const safeIntro = escapeHtml(intro);
  await smtpTransport.sendMail({
    from: emailFrom,
    to,
    subject,
    text: `${intro}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>${safeIntro}</p><p><a href="${safeUrl}">Continue to Bazion Web</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

function fireAuthEmail(to: string, subject: string, url: string, intro: string): void {
  void sendAuthEmail(to, subject, url, intro).catch((error: unknown) => {
    console.error("[bazion-auth-email] delivery failed", error instanceof Error ? error.name : "unknown error");
  });
}

function normalizeHostname(hostname: string): string | null {
  const value = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.length > 253 || value.includes("/") || value.includes("@")) return null;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(value)) return null;
  return value;
}

export async function isVerifiedTenantHost(hostname: string): Promise<boolean> {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  const result = await tenantResolverPool.query(
    "SELECT 1 FROM public.tenant_domain_directory WHERE hostname = $1 LIMIT 1",
    [host],
  );
  return result.rowCount === 1;
}

async function trustedOriginsForRequest(request?: Request): Promise<string[]> {
  if (!request) return defaultTrustedOrigins;
  const origin = request.headers.get("origin");
  if (!origin || defaultTrustedOrigins.includes(origin)) return defaultTrustedOrigins;

  try {
    const parsed = new URL(origin);
    const host = normalizeHostname(parsed.hostname);
    const local = host === "localhost" || host === "127.0.0.1";
    if (!host || parsed.username || parsed.password) return defaultTrustedOrigins;
    if (local && nodeEnv !== "production") return [...new Set([...defaultTrustedOrigins, origin])];
    if (parsed.protocol !== "https:" || (parsed.port !== "" && parsed.port !== "443")) return defaultTrustedOrigins;
    if (await isVerifiedTenantHost(host)) return [...new Set([...defaultTrustedOrigins, origin])];
  } catch {
    // An invalid Origin is never added to the trusted set.
  }
  return defaultTrustedOrigins;
}

function fireAuthEmail(to: string, subject: string, url: string, intro: string): void {
  // Do not block auth responses on SMTP. In production, use a durable email
  // outbox/worker before depending on email for onboarding or recovery.
  void sendAuthEmail(to, subject, url, intro).catch((error: unknown) => {
    console.error("[bazion-auth-email] delivery failed", error instanceof Error ? error.message : "unknown error");
  });
}

export interface PlatformMember {
  userId: string;
  email: string;
  role: "platform_owner" | "platform_admin" | "platform_support";
  status: "active" | "suspended";
}

export async function resolvePlatformMemberByEmail(email: string): Promise<PlatformMember | null> {
  const result = await tenantResolverPool.query<{
    user_id: string;
    email: string;
    role: PlatformMember["role"];
    status: PlatformMember["status"];
  }>(
    "SELECT user_id, email, role, status FROM public.platform_members WHERE lower(email) = lower($1) AND status = 'active' LIMIT 1",
    [email],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, email: row.email, role: row.role, status: row.status } : null;
}

export async function resolvePlatformMemberByUserId(userId: string): Promise<PlatformMember | null> {
  const result = await tenantResolverPool.query<{
    user_id: string;
    email: string;
    role: PlatformMember["role"];
    status: PlatformMember["status"];
  }>(
    "SELECT user_id, email, role, status FROM public.platform_members WHERE user_id = $1 AND status = 'active' LIMIT 1",
    [userId],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, email: row.email, role: row.role, status: row.status } : null;
}

async function beforeCreateOrganization({ organization: org, user }: {
  organization: { slug: string; name: string };
  user: { email: string; emailVerified: boolean };
}): Promise<void> {
  if (!user.emailVerified) throw new Error("A verified email is required to create a client organization.");
  const platformMember = await resolvePlatformMemberByEmail(user.email);
  if (!platformMember || !["platform_owner", "platform_admin"].includes(platformMember.role)) {
    throw new Error("Only an authorized Bazion platform administrator can create a client organization.");
  }

  const result = await tenantProvisionerPool.query(
    `INSERT INTO public.tenants (slug, name, default_currency, status)
     VALUES ($1, $2, $3, 'provisioning')`,
    [org.slug, org.name, process.env.DEFAULT_TENANT_CURRENCY ?? "KES"],
  );
  if (result.rowCount !== 1) throw new Error("Could not reserve the client tenant slug.");
}

async function afterCreateOrganization({ organization: org }: {
  organization: { id: string; slug: string; name: string };
}): Promise<void> {
  const result = await tenantProvisionerPool.query(
    `UPDATE public.tenants
        SET auth_organization_id = $1, name = $2, status = 'active'
      WHERE slug = $3 AND status = 'provisioning'`,
    [org.id, org.name, org.slug],
  );
  if (result.rowCount !== 1) {
    throw new Error("Organization was created but its Bazion tenant mapping needs reconciliation.");
  }
}

export const auth = betterAuth({
  appName: "Bazion Web",
  database: authPool,
  baseURL: required("BETTER_AUTH_URL"),
  secret: required("BETTER_AUTH_SECRET"),
  trustedOrigins: trustedOriginsForRequest,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false",
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      fireAuthEmail(user.email, "Reset your Bazion Web password", url, "Use the secure link below to reset your password.");
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      fireAuthEmail(user.email, "Verify your Bazion Web email", url, "Verify your email address to activate your Bazion Web account.");
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
    freshAge: 60 * 5,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/forget-password": { window: 3600, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: nodeEnv === "production",
  },
  plugins: [
    organization({
      ac,
      roles: organizationRoles,
      creatorRole: "admin",
      allowUserToCreateOrganization: async (user) => {
        if (!user.emailVerified) return false;
        const platformMember = await resolvePlatformMemberByEmail(user.email);
        return platformMember?.role === "platform_owner" || platformMember?.role === "platform_admin";
      },
      requireEmailVerificationOnInvitation: true,
      disableOrganizationDeletion: true,
      organizationHooks: {
        beforeCreateOrganization,
        beforeCreateInvitation: async ({ invitation, inviter }: {
          invitation: { role: string };
          inviter: { user: { id: string } };
        }) => {
          const requestedRoles = invitation.role.split(",").map((role) => role.trim()).filter(Boolean);
          if (requestedRoles.includes("owner")) {
            const platformMember = await resolvePlatformMemberByUserId(inviter.user.id);
            if (!platformMember || !["platform_owner", "platform_admin"].includes(platformMember.role)) {
              throw new Error("Only a Bazion platform administrator can invite a new client owner.");
            }
          }
        },
        beforeUpdateMemberRole: async ({ newRole, user }: { newRole: string; user: { id: string } }) => {
          const requestedRoles = newRole.split(",").map((role) => role.trim()).filter(Boolean);
          if (requestedRoles.includes("owner")) {
            const platformMember = await resolvePlatformMemberByUserId(user.id);
            if (!platformMember || !["platform_owner", "platform_admin"].includes(platformMember.role)) {
              throw new Error("Only an authorized Bazion platform administrator can assign the client owner role.");
            }
          }
        },
        afterCreateOrganization,
      },
      sendInvitationEmail: async (data) => {
        const invitationUrl = new URL(
          `/accept-invitation?invitationId=${encodeURIComponent(data.id)}`,
          appBaseUrl,
        ).toString();
        fireAuthEmail(
          data.email,
          `Invitation to join ${data.organization.name} on Bazion Web`,
          invitationUrl,
          `${data.inviter.user.name} invited you to join ${data.organization.name}.`,
        );
      },
    }),
  ],
});

export async function resolveTenantByOrganizationId(organizationId: string) {
  const result = await tenantResolverPool.query<{
    id: string;
    slug: string;
    name: string;
    default_currency: string;
    status: string;
  }>(
    `SELECT id, slug, name, default_currency, status
       FROM public.tenants
      WHERE auth_organization_id = $1
      LIMIT 1`,
    [organizationId],
  );
  return result.rows[0] ?? null;
}

export async function resolvePublicTenantByHostname(hostname: string) {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  const result = await tenantResolverPool.query<{
    id: string;
    slug: string;
    name: string;
    default_currency: string;
  }>(
    `SELECT t.id, t.slug, t.name, t.default_currency
       FROM public.tenant_domain_directory d
       JOIN public.tenants t ON t.id = d.tenant_id
      WHERE d.hostname = $1 AND t.status = 'active'
      LIMIT 1`,
    [host],
  );
  return result.rows[0] ?? null;
}

export async function closeAuthResources(): Promise<void> {
  await Promise.all([authPool.end(), tenantResolverPool.end(), tenantProvisionerPool.end()]);
  smtpTransport?.close();
}
