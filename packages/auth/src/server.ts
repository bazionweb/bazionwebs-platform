import { betterAuth } from "better-auth";
import { createHash } from "node:crypto";
import { createOutboxPayloadCodec, PostgresNotificationOutbox } from "@bazion/notifications";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";
import { reconcileTenantProvisioning } from "./tenant-reconciliation.js";
import { ac, organizationRoles } from "./permissions.js";
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
  event: "password-reset" | "email-verification" | "organization-invitation",
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
     VALUES ($1, $2, $3, 'provisioning')`,
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
        SET auth_organization_id = $1, name = $2, status = 'active'
      WHERE slug = $3 AND status = 'provisioning'`,
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
    sendResetPassword: async ({ user, url }) => {
      await enqueueAuthEmail(
        user.email,
        "Reset your Bazion Web password",
        url,
        "Use the secure link below to reset your password.",
        "password-reset",
        url,
      );
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
}

/** Read-only platform directory; caller must enforce tenant.list permission. */
export async function listPlatformTenants(input: { limit: number; offset: number; status?: string | undefined }) {
  const values: unknown[] = [];
  const where = input.status ? (values.push(input.status), "WHERE status = $1") : "";
  values.push(input.limit, input.offset);
  const result = await tenantResolverPool.query<PlatformTenantRecord>(
    `SELECT id, slug, name, default_currency, status, created_at, suspended_at, closed_at
       FROM public.tenants ${where}
      ORDER BY created_at DESC, id ASC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const countValues = input.status ? [input.status] : [];
  const countResult = await tenantResolverPool.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM public.tenants ${where}`,
    countValues,
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


export interface PlatformTenantOwnerTransfer {
  previousOwnerUserId: string;
  newOwnerUserId: string;
}

/**
 * Atomically transfers the Better Auth organization owner role. The organization
 * row serializes concurrent transfers; membership rows are locked and checked
 * again inside the transaction. The previous owner is retained as an admin.
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
    }>(
      'SELECT id, "userId", role FROM "member" WHERE "organizationId" = $1 ORDER BY id FOR UPDATE',
      [tenant.auth_organization_id],
    );
    const memberships = membershipResult.rows;
    const hasOwner = (role: string) => role.split(",").map((item) => item.trim()).includes("owner");
    const owners = memberships.filter((member) => hasOwner(member.role));
    const target = memberships.find((member) => member.userId === targetUserId);
    if (owners.length !== 1 || !target || owners[0]!.userId === targetUserId) {
      await client.query("ROLLBACK");
      return null;
    }

    const previousOwner = owners[0]!;
    const previousRoles = previousOwner.role.split(",").map((item) => item.trim()).filter((item) => item && item !== "owner");
    const targetRoles = target.role.split(",").map((item) => item.trim()).filter(Boolean);
    if (!targetRoles.includes("owner")) targetRoles.push("owner");

    await client.query(
      'UPDATE "member" SET role = $1 WHERE id = $2',
      [previousRoles.length ? previousRoles.join(",") : "admin", previousOwner.id],
    );
    await client.query(
      'UPDATE "member" SET role = $1 WHERE id = $2',
      [targetRoles.join(","), target.id],
    );
    await client.query("COMMIT");
    return { previousOwnerUserId: previousOwner.userId, newOwnerUserId: target.userId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
