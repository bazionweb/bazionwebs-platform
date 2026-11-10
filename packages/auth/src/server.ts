import { betterAuth } from "better-auth";
import { createHash, randomBytes } from "node:crypto";
import { createOutboxPayloadCodec, PostgresNotificationOutbox } from "@bazion/notifications";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";
import { reconcileTenantProvisioning } from "@bazion/platform-identity";
import { ac, organizationRoles, parseOrganizationRoles } from "./permissions.js";
import {
  canCreateClientOrganization,
  canGrantClientOwner,
  normalizeTenantHostname,
  resolveTrustedOriginsForRequest,
} from "./security-policy.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required authentication environment variable: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const appBaseUrl = process.env.AUTH_APP_URL ?? "http://localhost:3000";
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

const notificationEnqueuerPool = new Pool({
  connectionString: required("NOTIFICATION_ENQUEUER_DATABASE_URL"),
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const notificationOutbox = new PostgresNotificationOutbox(
  notificationEnqueuerPool,
  createOutboxPayloadCodec(Buffer.from(required("NOTIFICATION_ENCRYPTION_KEY"), "base64")),
);

async function enqueueAuthEmail(
  to: string,
  subject: string,
  url: string,
  intro: string,
  event: "password-reset" | "password-reset-complete" | "email-verification" | "organization-invitation",
  eventId: string,
): Promise<void> {
  const eventHash = createHash("sha256").update(eventId).digest("hex");
  await notificationOutbox.enqueue({
    idempotencyKey: `auth:${event}:${eventHash}`,
    channel: "email",
    payload: {
      to,
      subject,
      template: `auth.${event}`,
      variables: { url, intro },
    },
  });
}

export async function isVerifiedTenantHost(hostname: string): Promise<boolean> {
  const host = normalizeTenantHostname(hostname);
  if (!host) return false;
  const result = await tenantResolverPool.query(
    "SELECT 1 FROM public.tenant_domain_directory WHERE hostname = $1 LIMIT 1",
    [host],
  );
  return result.rowCount === 1;
}

async function trustedOriginsForRequest(request?: Request): Promise<string[]> {
  return resolveTrustedOriginsForRequest(request, defaultTrustedOrigins, nodeEnv, isVerifiedTenantHost);
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
  organization: { slug?: string; name?: string };
  user: { id: string; email: string; emailVerified: boolean };
}): Promise<void> {
  const slug = org.slug?.trim();
  const name = org.name?.trim();
  if (!slug || !name) throw new Error("A client organization name and slug are required.");

  const platformMember = await resolvePlatformMemberByEmail(user.email);
  if (!canCreateClientOrganization(platformMember?.role, user.emailVerified)) {
    throw new Error("Only a verified Bazion platform administrator can create a client organization.");
  }

  const result = await tenantProvisionerPool.query(
    `INSERT INTO public.tenants (slug, name, default_currency, status)
     VALUES ($1, $2, $3, 'provisioning')
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, updated_at = now()
       WHERE tenants.status = 'active' AND tenants.auth_organization_id IS NULL
     RETURNING id`,
    [slug, name, process.env.DEFAULT_TENANT_CURRENCY ?? "KES"],
  );
  if (result.rowCount !== 1) throw new Error("Could not reserve the client tenant slug.");
}

async function afterCreateOrganization({ organization: org }: {
  organization: { id: string; slug?: string; name?: string };
}): Promise<void> {
  const organizationId = org.id;
  const slug = org.slug?.trim();
  const name = org.name?.trim();
  if (!organizationId || !slug || !name) {
    throw new Error("Organization was created without the required Bazion tenant mapping fields.");
  }
  const result = await tenantProvisionerPool.query(
    `UPDATE public.tenants
        SET auth_organization_id = $1, name = $2, status = 'active', updated_at = now()
      WHERE slug = $3
        AND status IN ('provisioning', 'active')
        AND (auth_organization_id IS NULL OR auth_organization_id = $1)`,
    [organizationId, name, slug],
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
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      try {
        await enqueueAuthEmail(
          user.email,
          "Reset your Bazion Web password",
          url,
          "Use the secure link below to reset your password.",
          "password-reset",
          url,
        );
      } catch {
        // Keep the public response identical for registered and unknown addresses.
        // Do not log the account address, reset URL, or token.
        process.stderr.write("[bazion-auth] password-reset email could not be queued\n");
      }
    },
    onPasswordReset: async ({ user }) => {
      try {
        await enqueueAuthEmail(
          user.email,
          "Your Bazion Web password was changed",
          "",
          "Your password was successfully changed. If you did not make this change, contact Bazion support immediately.",
          "password-reset-complete",
          randomBytes(16).toString("hex"),
        );
      } catch {
        // The password is already changed. Keep the success response while logging
        // a generic alert that does not disclose the account or reset token.
        process.stderr.write("[bazion-auth] password-reset notification could not be queued\n");
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await enqueueAuthEmail(
        user.email,
        "Verify your Bazion Web email",
        url,
        "Verify your email address to activate your Bazion Web account.",
        "email-verification",
        url,
      );
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
      "/request-password-reset": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 10 },
      "/reset-password/*": { window: 3600, max: 10 },
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
        const platformMember = await resolvePlatformMemberByEmail(user.email);
        return canCreateClientOrganization(platformMember?.role, user.emailVerified);
      },
      requireEmailVerificationOnInvitation: true,
      disableOrganizationDeletion: true,
      organizationHooks: {
        beforeCreateOrganization,
        beforeCreateInvitation: async ({ invitation, inviter }) => {
          const platformMember = await resolvePlatformMemberByUserId(inviter.id);
          if (!canGrantClientOwner(platformMember?.role, invitation.role)) {
            throw new Error("Client ownership must be assigned through the audited platform ownership transfer workflow.");
          }
        },
        beforeUpdateMemberRole: async ({ newRole, user }) => {
          const platformMember = await resolvePlatformMemberByUserId(user.id);
          if (!canGrantClientOwner(platformMember?.role, newRole)) {
            throw new Error("Client ownership must be assigned through the audited platform ownership transfer workflow.");
          }
        },
        afterCreateOrganization,
      },
      sendInvitationEmail: async (data) => {
        const invitationUrl = new URL(
          `/accept-invitation?invitationId=${encodeURIComponent(data.id)}`,
          appBaseUrl,
        ).toString();
        await enqueueAuthEmail(
          data.email,
          `Invitation to join ${data.organization.name} on Bazion Web`,
          invitationUrl,
          `${data.inviter.user.name} invited you to join ${data.organization.name}.`,
          "organization-invitation",
          data.id,
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
  const host = normalizeTenantHostname(hostname);
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


export interface PlatformTenantDomain {
  id: string;
  hostname: string;
  status: "pending" | "active" | "disabled";
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformTenantDomainChallenge {
  domain: PlatformTenantDomain;
  challenge: { type: "TXT"; name: string; value: string };
}

/** Lists tenant domains without exposing stored verification hashes. */
export async function listPlatformTenantDomains(tenantId: string): Promise<PlatformTenantDomain[]> {
  const result = await tenantProvisionerPool.query<PlatformTenantDomain>(
    `SELECT id, hostname, status, verified_at::text AS verified_at,
            created_at::text AS created_at, updated_at::text AS updated_at
       FROM public.tenant_domains
      WHERE tenant_id = $1
      ORDER BY created_at DESC, hostname ASC`,
    [tenantId],
  );
  return result.rows;
}

/** Creates or rotates a DNS challenge only for an inactive domain owned by this tenant. */
export async function createPlatformTenantDomain(
  tenantId: string,
  hostname: string,
): Promise<
  | { kind: "created"; value: PlatformTenantDomainChallenge }
  | { kind: "tenant_not_active" }
  | { kind: "hostname_conflict" }
> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const client = await tenantProvisionerPool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query<{ status: string }>(
      "SELECT status FROM public.tenants WHERE id = $1 FOR UPDATE",
      [tenantId],
    );
    if (tenant.rowCount !== 1 || tenant.rows[0]?.status !== "active") {
      await client.query("ROLLBACK");
      return { kind: "tenant_not_active" };
    }
    const result = await client.query<PlatformTenantDomain>(
      `INSERT INTO public.tenant_domains (tenant_id, hostname, verification_token_hash, status, verified_at)
       VALUES ($1, $2, $3, 'pending', NULL)
       ON CONFLICT (hostname)
       DO UPDATE SET verification_token_hash = EXCLUDED.verification_token_hash,
                     status = 'pending', verified_at = NULL, updated_at = now()
       WHERE public.tenant_domains.tenant_id = EXCLUDED.tenant_id
         AND public.tenant_domains.status IN ('pending', 'disabled')
       RETURNING id, hostname, status, verified_at::text AS verified_at,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [tenantId, hostname, tokenHash],
    );
    const domain = result.rows[0];
    if (!domain) {
      await client.query("ROLLBACK");
      return { kind: "hostname_conflict" };
    }
    await client.query("COMMIT");
    return {
      kind: "created",
      value: {
        domain,
        challenge: {
          type: "TXT",
          name: `_bazionweb-challenge.${hostname}`,
          value: `bazionweb-verification=${token}`,
        },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Returns the verification hash only to the API verification service. */
export async function getPlatformTenantDomainChallenge(
  tenantId: string,
  domainId: string,
): Promise<{ hostname: string; verificationTokenHash: string; status: "pending" | "active" | "disabled" } | null> {
  const result = await tenantProvisionerPool.query<{
    hostname: string;
    verification_token_hash: string | null;
    status: "pending" | "active" | "disabled";
  }>(
    `SELECT hostname, verification_token_hash, status
       FROM public.tenant_domains
      WHERE tenant_id = $1 AND id = $2
        AND status = 'pending' AND updated_at > now() - interval '7 days'
      LIMIT 1`,
    [tenantId, domainId],
  );
  const row = result.rows[0];
  if (!row || !row.verification_token_hash) return null;
  return { hostname: row.hostname, verificationTokenHash: row.verification_token_hash, status: row.status };
}

/** Activates only the exact pending challenge checked against DNS. */
export async function activatePlatformTenantDomain(
  tenantId: string,
  domainId: string,
  verificationTokenHash: string,
): Promise<PlatformTenantDomain | null> {
  const result = await tenantProvisionerPool.query<PlatformTenantDomain>(
    `UPDATE public.tenant_domains d
        SET status = 'active', verified_at = now(), verification_token_hash = NULL, updated_at = now()
      WHERE d.tenant_id = $1 AND d.id = $2 AND d.status = 'pending'
        AND d.verification_token_hash = $3
        AND d.updated_at > now() - interval '7 days'
        AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = d.tenant_id AND t.status = 'active')
      RETURNING d.id, d.hostname, d.status, d.verified_at::text AS verified_at,
                d.created_at::text AS created_at, d.updated_at::text AS updated_at`,
    [tenantId, domainId, verificationTokenHash],
  );
  return result.rows[0] ?? null;
}

/** Disabling removes a hostname from the read-only resolver view immediately. */
export async function disablePlatformTenantDomain(
  tenantId: string,
  domainId: string,
): Promise<PlatformTenantDomain | null> {
  const result = await tenantProvisionerPool.query<PlatformTenantDomain>(
    `UPDATE public.tenant_domains
        SET status = 'disabled', verification_token_hash = NULL, updated_at = now()
      WHERE tenant_id = $1 AND id = $2 AND status <> 'disabled'
      RETURNING id, hostname, status, verified_at::text AS verified_at,
                created_at::text AS created_at, updated_at::text AS updated_at`,
    [tenantId, domainId],
  );
  return result.rows[0] ?? null;
}


export async function closeAuthResources(): Promise<void> {
  await Promise.all([authPool.end(), tenantResolverPool.end(), tenantProvisionerPool.end(), notificationEnqueuerPool.end()]);
}


/** Recover stale tenant reservations only when their Better Auth organization exists. */
export async function reconcileProvisioningTenants(options: {
  staleMinutes?: number;
  limit?: number;
} = {}) {
  return reconcileTenantProvisioning({
    async findStaleProvisioningTenants(staleMinutes, limit) {
      const result = await tenantProvisionerPool.query<{
        id: string;
        slug: string;
        auth_organization_id: string | null;
      }>(
        `SELECT id, slug, auth_organization_id
           FROM public.tenants
          WHERE status = 'provisioning'
            AND created_at < now() - ($1::integer * interval '1 minute')
          ORDER BY created_at ASC
          LIMIT $2`,
        [staleMinutes, limit],
      );
      return result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        authOrganizationId: row.auth_organization_id,
      }));
    },
    async findOrganizationsBySlugs(slugs) {
      const result = await authPool.query<{ id: string; slug: string; name: string }>(
        `SELECT id, slug, name
           FROM organization
          WHERE slug = ANY($1::text[])`,
        [slugs],
      );
      return result.rows;
    },
    async activateTenant({ tenantId, organizationId, organizationName }) {
      const result = await tenantProvisionerPool.query(
        `UPDATE public.tenants
            SET auth_organization_id = $1, name = $2, status = 'active'
          WHERE id = $3
            AND status = 'provisioning'
            AND (auth_organization_id IS NULL OR auth_organization_id = $1)`,
        [organizationId, organizationName, tenantId],
      );
      return result.rowCount === 1;
    },
  }, options);
}


export interface PlatformTenantRecord {
  id: string;
  slug: string;
  name: string;
  default_currency: string;
  status: "provisioning" | "active" | "suspended" | "closed";
  created_at: string;
  suspended_at: string | null;
  closed_at: string | null;
  auth_workspace_linked?: boolean;
}

/** Read-only platform directory; caller must enforce global or tenant-scoped tenant.list permission. */
export async function listPlatformTenants(input: { limit: number; offset: number; status?: string | undefined; tenantId?: string | undefined }) {
  const values: unknown[] = [];
  const predicates: string[] = [];
  if (input.tenantId) {
    values.push(input.tenantId);
    predicates.push(`id = $${values.length}`);
  }
  if (input.status) {
    values.push(input.status);
    predicates.push(`status = $${values.length}`);
  }
  const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
  const pageValues = [...values, input.limit, input.offset];
  const result = await tenantResolverPool.query<PlatformTenantRecord>(
    `SELECT id, slug, name, default_currency, status, created_at, suspended_at, closed_at,
            auth_organization_id IS NOT NULL AS auth_workspace_linked
       FROM public.tenants ${where}
      ORDER BY created_at DESC, id ASC
      LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues,
  );
  const countResult = await tenantResolverPool.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM public.tenants ${where}`,
    values,
  );
  return { items: result.rows, total: Number(countResult.rows[0]?.total ?? 0), limit: input.limit, offset: input.offset };
}

/**
 * Compare-and-set lifecycle transition. Closed tenants are terminal; no data is
 * deleted. A transition succeeds only from the expected current state.
 */
export async function transitionPlatformTenant(input: {
  tenantId: string;
  action: "suspend" | "restore" | "close";
}): Promise<PlatformTenantRecord | null> {
  const transition = {
    suspend: { from: "active", to: "suspended" },
    restore: { from: "suspended", to: "active" },
    close: { from: "suspended", to: "closed" },
  } as const;
  const selected = transition[input.action];
  const result = await tenantProvisionerPool.query<PlatformTenantRecord>(
    `UPDATE public.tenants
        SET status = $1,
            suspended_at = CASE WHEN $1 = 'suspended' THEN now() ELSE NULL END,
            closed_at = CASE WHEN $1 = 'closed' THEN now() ELSE closed_at END,
            updated_at = now()
      WHERE id = $2 AND status = $3
      RETURNING id, slug, name, default_currency, status, created_at, suspended_at, closed_at`,
    [selected.to, input.tenantId, selected.from],
  );
  return result.rows[0] ?? null;
}


/** Read-only detail lookup; caller must enforce tenant.read permission. */
export async function getPlatformTenant(tenantId: string): Promise<PlatformTenantRecord | null> {
  const result = await tenantResolverPool.query<PlatformTenantRecord>(
    `SELECT id, slug, name, default_currency, status, created_at, suspended_at, closed_at
       FROM public.tenants
      WHERE id = $1
      LIMIT 1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
}


export interface PlatformTenantOwnerCandidate {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
}

export async function listPlatformTenantOwnerCandidates(
  tenantId: string,
  input: { limit: number; offset: number; query?: string },
): Promise<{ currentOwners: PlatformTenantOwnerCandidate[]; candidates: PlatformTenantOwnerCandidate[]; total: number; limit: number; offset: number } | null> {
  const tenantResult = await tenantResolverPool.query<{ auth_organization_id: string | null; status: string }>(
    "SELECT auth_organization_id, status FROM public.tenants WHERE id = $1 LIMIT 1",
    [tenantId],
  );
  const tenant = tenantResult.rows[0];
  if (!tenant?.auth_organization_id || tenant.status === "closed") return null;

  const values: unknown[] = [tenant.auth_organization_id];
  let search = "";
  if (input.query?.trim()) {
    values.push(`%${input.query.trim().replace(/[!%_]/g, "!$&")}%`);
    search = ` AND (u.name ILIKE $2 ESCAPE '!' OR u.email ILIKE $2 ESCAPE '!')`;
  }
  const pageValues = [...values, input.limit, input.offset];
  const membershipRows = await authPool.query<{
    user_id: string; name: string; email: string; email_verified: boolean; role: string;
  }>(
    `SELECT m."userId" AS user_id, u.name, u.email, u."emailVerified" AS email_verified, m.role
       FROM "member" m
       JOIN "user" u ON u.id = m."userId"
      WHERE m."organizationId" = $1${search}
      ORDER BY u.name ASC, u.email ASC, m.id ASC
      LIMIT ${pageValues.length - 1} OFFSET ${pageValues.length}`,
    pageValues,
  );
  const countResult = await authPool.query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM "member" m
       JOIN "user" u ON u.id = m."userId"
      WHERE m."organizationId" = $1${search}`,
    values,
  );
  const ownerResult = await authPool.query<{
    user_id: string; name: string; email: string; email_verified: boolean; role: string;
  }>(
    `SELECT m."userId" AS user_id, u.name, u.email, u."emailVerified" AS email_verified, m.role
       FROM "member" m
       JOIN "user" u ON u.id = m."userId"
      WHERE m."organizationId" = $1
        AND (',' || replace(m.role, ' ', '') || ',') LIKE '%,owner,%'
      ORDER BY u.name ASC, m.id ASC`,
    [tenant.auth_organization_id],
  );
  const toCandidate = (row: typeof membershipRows.rows[number]): PlatformTenantOwnerCandidate => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified,
    roles: row.role.split(",").map((role) => role.trim()).filter(Boolean),
  });
  return {
    currentOwners: ownerResult.rows.map(toCandidate),
    candidates: membershipRows.rows.map(toCandidate),
    total: Number(countResult.rows[0]?.total ?? 0),
    limit: input.limit,
    offset: input.offset,
  };
}

export type TenantAdminAssignmentResult =
  | { kind: "tenant_not_found" }
  | { kind: "tenant_not_active" }
  | { kind: "tenant_workspace_setup_required" }
  | { kind: "verified_account_required" }
  | { kind: "already_admin"; userId: string; email: string; organizationId: string; role: string }
  | { kind: "assigned"; userId: string; email: string; organizationId: string; role: "admin" };

/** Called only by the audited platform-owner recovery route. */
export async function assignVerifiedTenantAdminByEmail(
  tenantId: string,
  email: string,
  platformOwnerUserId: string,
): Promise<TenantAdminAssignmentResult> {
  const tenantResult = await tenantProvisionerPool.query<{
    id: string; slug: string; name: string; auth_organization_id: string | null; status: string;
  }>(
    "SELECT id, slug, name, auth_organization_id, status FROM public.tenants WHERE id = $1 LIMIT 1",
    [tenantId],
  );
  const tenant = tenantResult.rows[0];
  if (!tenant) return { kind: "tenant_not_found" };
  if (tenant.status !== "active") return { kind: "tenant_not_active" };

  const normalizedEmail = email.trim().toLowerCase();
  const userResult = await authPool.query<{ id: string; email: string; email_verified: boolean }>(
    'SELECT id, email, "emailVerified" AS email_verified FROM "user" WHERE lower(email) = $1 LIMIT 1',
    [normalizedEmail],
  );
  const user = userResult.rows[0];
  if (!user?.email_verified) return { kind: "verified_account_required" };

  let organizationId = tenant.auth_organization_id;
  if (organizationId) {
    const organizationResult = await authPool.query<{ id: string }>(
      'SELECT id FROM "organization" WHERE id = $1 LIMIT 1',
      [organizationId],
    );
    if (!organizationResult.rows[0]) return { kind: "tenant_workspace_setup_required" };
  } else {
    const organizationsBySlug = await authPool.query<{ id: string }>(
      'SELECT id FROM "organization" WHERE slug = $1 LIMIT 2',
      [tenant.slug],
    );
    if (organizationsBySlug.rows.length > 1) return { kind: "tenant_workspace_setup_required" };
    let organization = organizationsBySlug.rows[0];

    if (!organization) {
      try {
        await auth.api.createOrganization({
          body: { name: tenant.name, slug: tenant.slug, userId: platformOwnerUserId },
        });
      } catch (error) {
        // Another owner request may have created the same organization first.
        // Re-read by the exact tenant slug and continue only if it now exists.
        const concurrentResult = await authPool.query<{ id: string }>(
          'SELECT id FROM "organization" WHERE slug = $1 LIMIT 2',
          [tenant.slug],
        );
        if (concurrentResult.rows.length !== 1) throw error;
        organization = concurrentResult.rows[0];
      }
      if (!organization) {
        const createdResult = await authPool.query<{ id: string }>(
          'SELECT id FROM "organization" WHERE slug = $1 LIMIT 2',
          [tenant.slug],
        );
        if (createdResult.rows.length !== 1) return { kind: "tenant_workspace_setup_required" };
        organization = createdResult.rows[0];
      }
    }
    if (!organization) return { kind: "tenant_workspace_setup_required" };
    const organizationIdCandidate = organization.id;

    const existingTenantLink = await tenantProvisionerPool.query<{ id: string }>(
      "SELECT id FROM public.tenants WHERE auth_organization_id = $1 AND id <> $2 LIMIT 1",
      [organizationIdCandidate, tenant.id],
    );
    if (existingTenantLink.rows[0]) return { kind: "tenant_workspace_setup_required" };

    const linkedTenant = await tenantProvisionerPool.query(
      `UPDATE public.tenants
          SET auth_organization_id = $1, status = 'active', updated_at = now()
        WHERE id = $2 AND status = 'active' AND auth_organization_id IS NULL
        RETURNING id`,
      [organizationIdCandidate, tenant.id],
    );
    if (linkedTenant.rowCount !== 1) {
      const currentTenantResult = await tenantProvisionerPool.query<{ auth_organization_id: string | null; status: string }>(
        "SELECT auth_organization_id, status FROM public.tenants WHERE id = $1 LIMIT 1",
        [tenant.id],
      );
      const currentTenant = currentTenantResult.rows[0];
      if (currentTenant?.status !== "active") return { kind: "tenant_not_active" };
      if (currentTenant?.auth_organization_id !== organizationIdCandidate) return { kind: "tenant_workspace_setup_required" };
    }
    organizationId = organizationIdCandidate;
  }

  const existingMemberResult = await authPool.query<{ id: string; role: string }>(
    'SELECT id, role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1',
    [organizationId, user.id],
  );
  const existingMember = existingMemberResult.rows[0];
  if (existingMember) {
    const roles = parseOrganizationRoles(existingMember.role);
    if (roles.includes("admin") || roles.includes("owner")) {
      return {
        kind: "already_admin",
        userId: user.id,
        email: user.email,
        organizationId,
        role: existingMember.role,
      };
    }
    const client = await authPool.connect();
    try {
      await client.query("BEGIN");
      const lockedMember = await client.query<{ id: string; role: string }>(
        'SELECT id, role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 FOR UPDATE',
        [organizationId, user.id],
      );
      const current = lockedMember.rows[0];
      if (!current) {
        await client.query("ROLLBACK");
        return { kind: "verified_account_required" };
      }
      const updatedRoles = parseOrganizationRoles(current.role);
      if (!updatedRoles.includes("admin")) updatedRoles.push("admin");
      await client.query('UPDATE "member" SET role = $1 WHERE id = $2', [updatedRoles.join(","), current.id]);
      await client.query("COMMIT");
      return {
        kind: "assigned",
        userId: user.id,
        email: user.email,
        organizationId,
        role: "admin",
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  await auth.api.addMember({
    body: { organizationId, userId: user.id, role: "admin" },
  });
  return {
    kind: "assigned",
    userId: user.id,
    email: user.email,
    organizationId,
    role: "admin",
  };
}

export interface PlatformTenantModuleEntitlement {
  module_id: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export async function getPlatformTenantModuleEntitlements(tenantId: string): Promise<PlatformTenantModuleEntitlement[]> {
  const result = await tenantResolverPool.query<PlatformTenantModuleEntitlement>(
    `SELECT module_id, enabled, updated_at, updated_by
       FROM public.tenant_module_entitlements
      WHERE tenant_id = $1
      ORDER BY module_id ASC`,
    [tenantId],
  );
  return result.rows;
}

export async function updatePlatformTenantModuleEntitlement(input: {
  tenantId: string;
  moduleId: string;
  enabled: boolean;
  actorUserId: string;
}): Promise<PlatformTenantModuleEntitlement | null> {
  const client = await tenantProvisionerPool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM public.tenants WHERE id = $1 FOR UPDATE",
      [input.tenantId],
    );
    if (tenant.rowCount !== 1 || tenant.rows[0]?.status === "closed") {
      await client.query("ROLLBACK");
      return null;
    }
    const result = await client.query<PlatformTenantModuleEntitlement>(
      `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, module_id)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING module_id, enabled, updated_at, updated_by`,
      [input.tenantId, input.moduleId, input.enabled, input.actorUserId],
    );
    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface PlatformTenantSettings {
  settings: {
    locale: string;
    timeZone: string;
    defaultCurrency: "KES" | "USD" | "EUR" | "GBP";
    brandName: string;
    primaryColor: string;
    supportEmail: string;
  };
  version: number;
  updatedAt: string | null;
}

const defaultPlatformTenantSettings = {
  locale: "en-KE",
  timeZone: "Africa/Nairobi",
  defaultCurrency: "KES" as const,
  brandName: "",
  primaryColor: "#236b4c",
  supportEmail: "",
};

export async function getPlatformTenantSettings(tenantId: string): Promise<PlatformTenantSettings | null> {
  const tenant = await tenantResolverPool.query<{ id: string; default_currency: "KES" | "USD" | "EUR" | "GBP" }>(
    "SELECT id, default_currency FROM public.tenants WHERE id = $1 LIMIT 1",
    [tenantId],
  );
  if (tenant.rowCount !== 1) return null;
  const result = await tenantResolverPool.query<{
    settings: Partial<PlatformTenantSettings["settings"]>;
    version: number;
    updated_at: Date | null;
  }>(
    "SELECT settings, version, updated_at FROM public.tenant_platform_settings WHERE tenant_id = $1 LIMIT 1",
    [tenantId],
  );
  const row = result.rows[0];
  return {
    settings: { ...defaultPlatformTenantSettings, ...(row?.settings ?? {}), defaultCurrency: tenant.rows[0]!.default_currency },
    version: row?.version ?? 0,
    updatedAt: row?.updated_at?.toISOString() ?? null,
  };
}

export async function updatePlatformTenantSettings(input: {
  tenantId: string;
  expectedVersion: number;
  settings: Partial<PlatformTenantSettings["settings"]>;
  actorUserId: string;
}): Promise<{ kind: "updated"; value: PlatformTenantSettings } | { kind: "conflict" | "not_found" }> {
  const client = await tenantProvisionerPool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query<{ id: string; status: string; default_currency: "KES" | "USD" | "EUR" | "GBP" }>(
      "SELECT id, status, default_currency FROM public.tenants WHERE id = $1 FOR UPDATE",
      [input.tenantId],
    );
    if (tenant.rowCount !== 1 || tenant.rows[0]?.status === "closed") {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }
    const current = await client.query<{
      settings: Partial<PlatformTenantSettings["settings"]>;
      version: number;
      updated_at: Date | null;
    }>(
      "SELECT settings, version, updated_at FROM public.tenant_platform_settings WHERE tenant_id = $1 FOR UPDATE",
      [input.tenantId],
    );
    const row = current.rows[0];
    const version = row?.version ?? 0;
    if (version !== input.expectedVersion) {
      await client.query("ROLLBACK");
      return { kind: "conflict" };
    }
    const settings = { ...defaultPlatformTenantSettings, ...(row?.settings ?? {}), ...input.settings, defaultCurrency: input.settings.defaultCurrency ?? tenant.rows[0]!.default_currency };
    await client.query("UPDATE public.tenants SET default_currency = $1, updated_at = now() WHERE id = $2", [settings.defaultCurrency, input.tenantId]);
    const { defaultCurrency, ...persistedSettings } = settings;
    const written = await client.query<{
      settings: PlatformTenantSettings["settings"];
      version: number;
      updated_at: Date;
    }>(
      `INSERT INTO public.tenant_platform_settings (tenant_id, settings, version, updated_by)
       VALUES ($1, $2::jsonb, 1, $3)
       ON CONFLICT (tenant_id)
       DO UPDATE SET settings = EXCLUDED.settings, version = public.tenant_platform_settings.version + 1,
                     updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING settings, version, updated_at`,
      [input.tenantId, JSON.stringify(persistedSettings), input.actorUserId],
    );
    await client.query("COMMIT");
    const saved = written.rows[0]!;
    return {
      kind: "updated",
      value: { settings: { ...defaultPlatformTenantSettings, ...saved.settings, defaultCurrency }, version: saved.version, updatedAt: saved.updated_at.toISOString() },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function countPlatformTenantMembers(tenantId: string): Promise<number | null> {
  const tenant = await tenantResolverPool.query<{ auth_organization_id: string | null }>(
    "SELECT auth_organization_id FROM public.tenants WHERE id = $1 LIMIT 1",
    [tenantId],
  );
  const organizationId = tenant.rows[0]?.auth_organization_id;
  if (!organizationId) return null;
  const result = await authPool.query<{ total: string }>(
    'SELECT count(*)::text AS total FROM "member" WHERE "organizationId" = $1',
    [organizationId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

export interface PlatformTenantOwnerTransfer {
  previousOwnerUserId: string | null;
  newOwnerUserId: string;
}

/**
 * Atomically transfers the Better Auth organization owner role. The organization
 * row serializes concurrent transfers; membership rows are locked and checked
 * again inside the transaction. Initial assignment is allowed when no owner
 * exists; on transfer, the previous owner is retained as an admin.
 */
export async function transferPlatformTenantOwner(
  tenantId: string,
  targetUserId: string,
): Promise<PlatformTenantOwnerTransfer | null> {
  const tenantResult = await tenantResolverPool.query<{
    auth_organization_id: string | null;
    status: string;
  }>(
    `SELECT auth_organization_id, status
       FROM public.tenants
      WHERE id = $1
      LIMIT 1`,
    [tenantId],
  );
  const tenant = tenantResult.rows[0];
  if (!tenant?.auth_organization_id || tenant.status === "closed") return null;

  const client = await authPool.connect();
  try {
    await client.query("BEGIN");
    const organization = await client.query<{ id: string }>(
      'SELECT id FROM "organization" WHERE id = $1 FOR UPDATE',
      [tenant.auth_organization_id],
    );
    if (organization.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    const membershipResult = await client.query<{
      id: string;
      userId: string;
      role: string;
      email_verified: boolean;
    }>(
      'SELECT m.id, m."userId", m.role, u."emailVerified" AS email_verified FROM "member" m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 ORDER BY m.id FOR UPDATE OF m',
      [tenant.auth_organization_id],
    );
    const memberships = membershipResult.rows;
    const hasOwner = (role: string) => role.split(",").map((item) => item.trim()).includes("owner");
    const owners = memberships.filter((member) => hasOwner(member.role));
    const target = memberships.find((member) => member.userId === targetUserId);
    if (owners.length > 1 || !target || !target.email_verified || owners[0]?.userId === targetUserId) {
      await client.query("ROLLBACK");
      return null;
    }

    const previousOwner = owners[0] ?? null;
    const targetRoles = target.role.split(",").map((item) => item.trim()).filter(Boolean);
    if (!targetRoles.includes("owner")) targetRoles.push("owner");

    if (previousOwner) {
      const previousRoles = previousOwner.role.split(",").map((item) => item.trim()).filter((item) => item && item !== "owner");
      await client.query(
        'UPDATE "member" SET role = $1 WHERE id = $2',
        [previousRoles.length ? previousRoles.join(",") : "admin", previousOwner.id],
      );
    }
    await client.query(
      'UPDATE "member" SET role = $1 WHERE id = $2',
      [targetRoles.join(","), target.id],
    );
    await client.query("COMMIT");
    return { previousOwnerUserId: previousOwner?.userId ?? null, newOwnerUserId: target.userId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
