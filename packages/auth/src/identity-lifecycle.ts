import { createHash, randomBytes } from "node:crypto";

export interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>;
}

export interface SqlPool extends SqlClient {
  connect(): Promise<SqlClient & { release(): void }>;
}

export class IdentityLifecycleError extends Error {
  constructor(
    public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 410,
    public readonly code: string,
    message: string,
    public readonly collisionId?: string,
  ) {
    super(message);
    this.name = "IdentityLifecycleError";
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateHighEntropyToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export interface FederatedIdentityLinkRecord {
  id: string;
  issuer: string;
  subject: string;
  userId: string;
  emailAtLink: string;
  emailVerified: boolean;
  status: string;
  linkedVia: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityCollisionRecord {
  id: string;
  collisionType: string;
  issuer: string | null;
  subject: string | null;
  existingUserId: string | null;
  conflictingUserId: string | null;
  externalReference: string | null;
  status: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapLinkRow(row: Record<string, unknown>): FederatedIdentityLinkRecord {
  return {
    id: String(row.id),
    issuer: String(row.issuer),
    subject: String(row.subject),
    userId: String(row.user_id),
    emailAtLink: String(row.email_at_link),
    emailVerified: Boolean(row.email_verified),
    status: String(row.status),
    linkedVia: String(row.linked_via),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCollisionRow(row: Record<string, unknown>): IdentityCollisionRecord {
  return {
    id: String(row.id),
    collisionType: String(row.collision_type),
    issuer: row.issuer ? String(row.issuer) : null,
    subject: row.subject ? String(row.subject) : null,
    existingUserId: row.existing_user_id ? String(row.existing_user_id) : null,
    conflictingUserId: row.conflicting_user_id ? String(row.conflicting_user_id) : null,
    externalReference: row.external_reference ? String(row.external_reference) : null,
    status: String(row.status),
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function recordCollision(
  identityPool: SqlClient,
  input: {
    collisionType: "subject_rebind" | "email_collision" | "email_change_conflict" | "order_claim_collision";
    issuer?: string | null;
    subject?: string | null;
    existingUserId?: string | null;
    conflictingUserId?: string | null;
    externalReference?: string | null;
  },
): Promise<string> {
  const result = await identityPool.query(
    `INSERT INTO public.identity_link_collisions
       (collision_type, issuer, subject, existing_user_id, conflicting_user_id, external_reference, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'open')
     RETURNING id`,
    [
      input.collisionType,
      input.issuer ?? null,
      input.subject ?? null,
      input.existingUserId ?? null,
      input.conflictingUserId ?? null,
      input.externalReference ?? null,
    ],
  );
  return String(result.rows[0]?.id ?? "");
}

/**
 * Persist or resolve a federated identity exclusively by (issuer, subject).
 * Never silently merge an external subject into an existing account by email match.
 */
export async function resolveOrLinkFederatedIdentity(input: {
  identityPool: SqlPool;
  authPool: SqlPool;
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  explicitUserId?: string | null;
  linkedVia: "oidc_login" | "owner_claim" | "admin_link" | "migration_backfill";
}): Promise<FederatedIdentityLinkRecord> {
  const issuer = input.issuer.trim();
  const subject = input.subject.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!issuer || !subject || !normalizedEmail) {
    throw new IdentityLifecycleError(400, "IDENTITY_INPUT_INVALID", "issuer, subject, and email are required.");
  }

  const existingResult = await input.identityPool.query(
    `SELECT * FROM public.federated_identity_links WHERE issuer = $1 AND subject = $2 LIMIT 1`,
    [issuer, subject],
  );
  const existing = existingResult.rows[0];

  if (existing) {
    const linkedUserId = String(existing.user_id);
    if (existing.status !== "active") {
      throw new IdentityLifecycleError(403, "FEDERATED_IDENTITY_SUSPENDED", "This federated identity link is not active.");
    }
    if (input.explicitUserId && input.explicitUserId !== linkedUserId) {
      const collisionId = await recordCollision(input.identityPool, {
        collisionType: "subject_rebind",
        issuer,
        subject,
        existingUserId: linkedUserId,
        conflictingUserId: input.explicitUserId,
      });
      throw new IdentityLifecycleError(
        409,
        "IDENTITY_LINK_COLLISION",
        "Federated subject is already bound to another Bazion account and will not be automatically reassigned.",
        collisionId,
      );
    }

    const updated = await input.identityPool.query(
      `UPDATE public.federated_identity_links
          SET email_at_link = $2,
              email_verified = $3,
              updated_at = now()
        WHERE id = $1
      RETURNING *`,
      [existing.id, normalizedEmail, input.emailVerified],
    );
    return mapLinkRow(updated.rows[0]!);
  }

  // No (issuer, subject) link exists yet. Verify we do NOT silently merge by email.
  const matchingEmailUserResult = await input.authPool.query(
    `SELECT id, "emailVerified" AS email_verified FROM "user" WHERE lower(email) = $1 LIMIT 1`,
    [normalizedEmail],
  );
  const matchingUser = matchingEmailUserResult.rows[0];

  if (input.explicitUserId) {
    const targetUserResult = await input.authPool.query(
      `SELECT id FROM "user" WHERE id = $1 LIMIT 1`,
      [input.explicitUserId],
    );
    if (targetUserResult.rowCount !== 1) {
      throw new IdentityLifecycleError(404, "USER_NOT_FOUND", "Target account does not exist.");
    }
    if (matchingUser && String(matchingUser.id) !== input.explicitUserId) {
      const collisionId = await recordCollision(input.identityPool, {
        collisionType: "email_collision",
        issuer,
        subject,
        existingUserId: String(matchingUser.id),
        conflictingUserId: input.explicitUserId,
      });
      throw new IdentityLifecycleError(
        409,
        "IDENTITY_LINK_COLLISION",
        "Incoming email belongs to a different existing account; contact support or sign into that account to link manually.",
        collisionId,
      );
    }

    const inserted = await input.identityPool.query(
      `INSERT INTO public.federated_identity_links
         (issuer, subject, user_id, email_at_link, email_verified, status, linked_via)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING *`,
      [issuer, subject, input.explicitUserId, normalizedEmail, input.emailVerified, input.linkedVia],
    );
    return mapLinkRow(inserted.rows[0]!);
  }

  if (matchingUser) {
    const collisionId = await recordCollision(input.identityPool, {
      collisionType: "email_collision",
      issuer,
      subject,
      existingUserId: String(matchingUser.id),
    });
    throw new IdentityLifecycleError(
      409,
      "IDENTITY_LINK_COLLISION",
      "An account with this email already exists under another identity; automatic email merging is disabled.",
      collisionId,
    );
  }

  throw new IdentityLifecycleError(
    404,
    "FEDERATED_IDENTITY_UNLINKED",
    "No linked Bazion account was found for this federated subject.",
  );
}

export async function issueOrderClaimProof(input: {
  identityPool: SqlClient;
  externalOrderId: string;
  externalCustomerId: string;
  tenantId: string;
  installationId?: string | null;
  issuedByClient?: string;
  expiresInSeconds?: number;
}): Promise<{ claimId: string; proofToken: string; expiresAt: string }> {
  const proofToken = generateHighEntropyToken(32);
  const proofHash = sha256Hex(proofToken);
  const ttlSeconds = Math.min(Math.max(input.expiresInSeconds ?? 900, 60), 86_400);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const result = await input.identityPool.query(
    `INSERT INTO public.commercial_order_claim_proofs
       (proof_hash, external_order_id, external_customer_id, tenant_id, installation_id, issued_by_client, expires_at)
     VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7::timestamptz)
     RETURNING id, expires_at`,
    [
      proofHash,
      input.externalOrderId.trim(),
      input.externalCustomerId.trim(),
      input.tenantId,
      input.installationId ?? null,
      input.issuedByClient ?? "bazionweb",
      expiresAt,
    ],
  );

  return {
    claimId: String(result.rows[0]!.id),
    proofToken,
    expiresAt: new Date(String(result.rows[0]!.expires_at)).toISOString(),
  };
}

/**
 * Atomically claim a guest-paid order proof as the authenticated, email-verified user.
 * Enforces single-use atomic consumption and refuses silent owner takeover/email merging.
 */
export async function consumeOrderClaimProof(input: {
  identityPool: SqlPool;
  authPool: SqlPool;
  proofToken: string;
  claimantUserId: string;
  claimantEmailVerified: boolean;
  ensureTenantOwnerMembership: (organizationId: string, userId: string) => Promise<void>;
}): Promise<{
  claimId: string;
  externalOrderId: string;
  externalCustomerId: string;
  tenantId: string;
  installationId: string | null;
  membershipRole: "owner";
}> {
  if (!input.claimantUserId) {
    throw new IdentityLifecycleError(401, "UNAUTHENTICATED", "Sign in before claiming an order.");
  }
  if (!input.claimantEmailVerified) {
    throw new IdentityLifecycleError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email address before claiming this workspace.");
  }

  const proofHash = sha256Hex(input.proofToken.trim());
  const client = await input.identityPool.connect();
  let externalOrderIdForCollision: string | null = null;
  let collisionOwnerId: string | null = null;

  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, external_order_id, external_customer_id, tenant_id, installation_id, expires_at, consumed_at
         FROM public.commercial_order_claim_proofs
        WHERE proof_hash = $1
        LIMIT 1
        FOR UPDATE`,
      [proofHash],
    );
    const proof = locked.rows[0];
    if (!proof) {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(404, "CLAIM_PROOF_INVALID", "Order claim token is invalid.");
    }
    if (proof.consumed_at) {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(409, "CLAIM_PROOF_ALREADY_USED", "This order claim token has already been used.");
    }
    if (new Date(String(proof.expires_at)).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(410, "CLAIM_PROOF_EXPIRED", "This order claim token has expired.");
    }

    const tenantResult = await client.query(
      `SELECT id, auth_organization_id, status FROM public.tenants WHERE id = $1::uuid LIMIT 1`,
      [proof.tenant_id],
    );
    const tenant = tenantResult.rows[0];
    if (!tenant || !tenant.auth_organization_id) {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(409, "CLAIM_TENANT_UNLINKED", "Workspace organization is not ready for claiming yet.");
    }

    const orgId = String(tenant.auth_organization_id);
    const ownerResult = await input.authPool.query(
      `SELECT "userId" AS user_id FROM "member"
        WHERE "organizationId" = $1
          AND ('owner' = ANY(string_to_array(role, ',')))`,
      [orgId],
    );

    const otherOwner = ownerResult.rows.find((row) => String(row.user_id) !== input.claimantUserId);
    if (otherOwner) {
      externalOrderIdForCollision = String(proof.external_order_id);
      collisionOwnerId = String(otherOwner.user_id);
      await client.query("ROLLBACK");
    } else {
      await input.ensureTenantOwnerMembership(orgId, input.claimantUserId);
      const consumed = await client.query(
        `UPDATE public.commercial_order_claim_proofs
            SET consumed_at = now(),
                claimed_by_user_id = $2,
                claimed_at = now()
          WHERE id = $1::uuid
            AND consumed_at IS NULL
            AND expires_at > now()
        RETURNING id`,
        [proof.id, input.claimantUserId],
      );
      if (consumed.rowCount !== 1) {
        await client.query("ROLLBACK");
        throw new IdentityLifecycleError(409, "CLAIM_PROOF_ALREADY_USED", "This order claim token has already been used.");
      }
      await client.query("COMMIT");

      return {
        claimId: String(proof.id),
        externalOrderId: String(proof.external_order_id),
        externalCustomerId: String(proof.external_customer_id),
        tenantId: String(proof.tenant_id),
        installationId: proof.installation_id ? String(proof.installation_id) : null,
        membershipRole: "owner",
      };
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (error instanceof IdentityLifecycleError) throw error;
    throw error;
  } finally {
    client.release();
  }

  const collisionId = await recordCollision(input.identityPool, {
    collisionType: "order_claim_collision",
    existingUserId: collisionOwnerId,
    conflictingUserId: input.claimantUserId,
    externalReference: externalOrderIdForCollision,
  });
  throw new IdentityLifecycleError(
    409,
    "ORDER_CLAIM_OWNERSHIP_COLLISION",
    "This tenant already has an owner. Request an invitation or an audited owner transfer through support.",
    collisionId,
  );
}

export async function requestAccountEmailChange(input: {
  identityPool: SqlPool;
  authPool: SqlPool;
  userId: string;
  currentEmail: string;
  newEmail: string;
  expiresInSeconds?: number;
}): Promise<{ requestId: string; verificationToken: string; newEmail: string; expiresAt: string }> {
  const normalizedCurrent = input.currentEmail.trim().toLowerCase();
  const normalizedNew = input.newEmail.trim().toLowerCase();
  if (!normalizedNew || normalizedNew === normalizedCurrent) {
    throw new IdentityLifecycleError(400, "EMAIL_UNCHANGED", "Choose a different email address.");
  }

  const conflictingUserResult = await input.authPool.query(
    `SELECT id FROM "user" WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
    [normalizedNew, input.userId],
  );
  if (conflictingUserResult.rowCount && conflictingUserResult.rows[0]) {
    const collisionId = await recordCollision(input.identityPool, {
      collisionType: "email_change_conflict",
      existingUserId: String(conflictingUserResult.rows[0].id),
      conflictingUserId: input.userId,
    });
    throw new IdentityLifecycleError(
      409,
      "EMAIL_CHANGE_CONFLICT",
      "That email address is already registered to another account; accounts cannot be merged automatically.",
      collisionId,
    );
  }

  const verificationToken = generateHighEntropyToken(32);
  const tokenHash = sha256Hex(verificationToken);
  const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 1800) * 1000).toISOString();

  await input.identityPool.query(
    `UPDATE public.account_email_change_requests
        SET status = 'cancelled', updated_at = now()
      WHERE user_id = $1 AND status = 'pending'`,
    [input.userId],
  );

  const inserted = await input.identityPool.query(
    `INSERT INTO public.account_email_change_requests
       (user_id, current_email, new_email, token_hash, status, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5::timestamptz)
     RETURNING id, expires_at`,
    [input.userId, normalizedCurrent, normalizedNew, tokenHash, expiresAt],
  );

  return {
    requestId: String(inserted.rows[0]!.id),
    verificationToken,
    newEmail: normalizedNew,
    expiresAt: new Date(String(inserted.rows[0]!.expires_at)).toISOString(),
  };
}

export async function confirmAccountEmailChange(input: {
  identityPool: SqlPool;
  authPool: SqlPool;
  actorUserId: string;
  token: string;
}): Promise<{ requestId: string; newEmail: string; revokedSessions: number }> {
  const tokenHash = sha256Hex(input.token.trim());
  const idClient = await input.identityPool.connect();
  const authClient = await input.authPool.connect();

  try {
    await idClient.query("BEGIN");
    const locked = await idClient.query(
      `SELECT id, user_id, new_email, status, expires_at
         FROM public.account_email_change_requests
        WHERE token_hash = $1
        LIMIT 1
        FOR UPDATE`,
      [tokenHash],
    );
    const requestRow = locked.rows[0];
    if (!requestRow) {
      await idClient.query("ROLLBACK");
      throw new IdentityLifecycleError(404, "EMAIL_CHANGE_TOKEN_INVALID", "Email change verification token is invalid.");
    }
    if (String(requestRow.user_id) !== input.actorUserId) {
      await idClient.query("ROLLBACK");
      throw new IdentityLifecycleError(403, "EMAIL_CHANGE_FORBIDDEN", "This email change request belongs to a different account.");
    }
    if (requestRow.status !== "pending") {
      await idClient.query("ROLLBACK");
      throw new IdentityLifecycleError(409, "EMAIL_CHANGE_ALREADY_FINALIZED", "This email change request has already been processed.");
    }
    if (new Date(String(requestRow.expires_at)).getTime() <= Date.now()) {
      await idClient.query(`UPDATE public.account_email_change_requests SET status = 'expired', updated_at = now() WHERE id = $1::uuid`, [requestRow.id]);
      await idClient.query("COMMIT");
      throw new IdentityLifecycleError(410, "EMAIL_CHANGE_EXPIRED", "This email change confirmation link has expired.");
    }

    const newEmail = String(requestRow.new_email).toLowerCase();
    await authClient.query("BEGIN");
    const existingAuthUser = await authClient.query(
      `SELECT email FROM "user" WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [input.actorUserId],
    );
    const previousAuthEmail = existingAuthUser.rows[0]?.email ? String(existingAuthUser.rows[0].email) : null;

    const conflict = await authClient.query(
      `SELECT id FROM "user" WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
      [newEmail, input.actorUserId],
    );
    if (conflict.rowCount && conflict.rows[0]) {
      await authClient.query("ROLLBACK");
      await idClient.query(`UPDATE public.account_email_change_requests SET status = 'conflicted', updated_at = now() WHERE id = $1::uuid`, [requestRow.id]);
      const collisionId = await recordCollision(idClient, {
        collisionType: "email_change_conflict",
        existingUserId: String(conflict.rows[0].id),
        conflictingUserId: input.actorUserId,
      });
      await idClient.query("COMMIT");
      throw new IdentityLifecycleError(
        409,
        "EMAIL_CHANGE_CONFLICT",
        "Target email was registered by another account before confirmation.",
        collisionId,
      );
    }

    // Stage both database transactions before committing so identity constraint failures
    // roll back cleanly without stranding an uncommitted auth update.
    await idClient.query(
      `UPDATE public.platform_members SET email = $2, updated_at = now() WHERE user_id = $1`,
      [input.actorUserId, newEmail],
    );
    await idClient.query(
      `UPDATE public.federated_identity_links SET email_at_link = $2, email_verified = true, updated_at = now() WHERE user_id = $1 AND status = 'active'`,
      [input.actorUserId, newEmail],
    );
    const bffRevocation = await idClient.query(
      `UPDATE public.oidc_bff_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [input.actorUserId],
    );
    await idClient.query(
      `UPDATE public.account_email_change_requests SET status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = $1::uuid`,
      [requestRow.id],
    );

    await authClient.query(
      `UPDATE "user" SET email = $1, "emailVerified" = true, "updatedAt" = now() WHERE id = $2`,
      [newEmail, input.actorUserId],
    );
    const sessionRevocation = await authClient.query(
      `DELETE FROM "session" WHERE "userId" = $1`,
      [input.actorUserId],
    );

    await idClient.query("COMMIT");
    try {
      await authClient.query("COMMIT");
    } catch (authCommitError) {
      // Compensate identityPool state if authPool COMMIT fails after idClient committed.
      if (previousAuthEmail) {
        try {
          await input.identityPool.query(
            `UPDATE public.platform_members SET email = $2, updated_at = now() WHERE user_id = $1`,
            [input.actorUserId, previousAuthEmail],
          );
          await input.identityPool.query(
            `UPDATE public.account_email_change_requests SET status = 'pending', confirmed_at = NULL, updated_at = now() WHERE id = $1::uuid`,
            [requestRow.id],
          );
        } catch {
          // Best-effort compensation before propagating failure
        }
      }
      throw authCommitError;
    }

    return {
      requestId: String(requestRow.id),
      newEmail,
      revokedSessions: (sessionRevocation.rowCount ?? 0) + (bffRevocation.rowCount ?? 0),
    };
  } catch (error) {
    try { await authClient.query("ROLLBACK"); } catch { /* ignore */ }
    try { await idClient.query("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  } finally {
    authClient.release();
    idClient.release();
  }
}

export async function listIdentityCollisions(input: {
  identityPool: SqlClient;
  status?: "open" | "resolved_linked" | "resolved_rejected";
  limit?: number;
}): Promise<IdentityCollisionRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const result = input.status
    ? await input.identityPool.query(
        `SELECT * FROM public.identity_link_collisions WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
        [input.status, limit],
      )
    : await input.identityPool.query(
        `SELECT * FROM public.identity_link_collisions ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
  return result.rows.map(mapCollisionRow);
}

export async function resolveIdentityCollision(input: {
  identityPool: SqlPool;
  authPool: SqlPool;
  collisionId: string;
  actorUserId: string;
  action: "resolve_link" | "reject";
  targetUserId?: string;
  note: string;
}): Promise<IdentityCollisionRecord> {
  const client = await input.identityPool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT * FROM public.identity_link_collisions WHERE id = $1::uuid LIMIT 1 FOR UPDATE`,
      [input.collisionId],
    );
    const collision = locked.rows[0];
    if (!collision) {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(404, "COLLISION_NOT_FOUND", "Identity collision record not found.");
    }
    if (collision.status !== "open") {
      await client.query("ROLLBACK");
      throw new IdentityLifecycleError(409, "COLLISION_ALREADY_RESOLVED", "Identity collision has already been resolved.");
    }

    if (input.action === "resolve_link") {
      if (!collision.issuer || !collision.subject || !input.targetUserId) {
        await client.query("ROLLBACK");
        throw new IdentityLifecycleError(
          400,
          "COLLISION_NOT_LINKABLE",
          "Only federated subject/email collisions with an explicit targetUserId can be linked.",
        );
      }
      const userCheck = await input.authPool.query(
        `SELECT id, email, "emailVerified" AS email_verified FROM "user" WHERE id = $1 LIMIT 1`,
        [input.targetUserId],
      );
      const targetUser = userCheck.rows[0];
      if (!targetUser || !targetUser.email_verified) {
        await client.query("ROLLBACK");
        throw new IdentityLifecycleError(
          409,
          "TARGET_USER_NOT_VERIFIED",
          "Target account must exist with a verified email before manual federated linking.",
        );
      }
      await client.query(
        `INSERT INTO public.federated_identity_links
           (issuer, subject, user_id, email_at_link, email_verified, status, linked_via)
         VALUES ($1, $2, $3, $4, true, 'active', 'admin_link')
         ON CONFLICT (issuer, subject) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               email_at_link = EXCLUDED.email_at_link,
               email_verified = true,
               status = 'active',
               linked_via = 'admin_link',
               updated_at = now()`,
        [collision.issuer, collision.subject, input.targetUserId, String(targetUser.email).toLowerCase()],
      );
    }

    const nextStatus = input.action === "resolve_link" ? "resolved_linked" : "resolved_rejected";
    const updated = await client.query(
      `UPDATE public.identity_link_collisions
          SET status = $2,
              resolution_note = $3,
              resolved_by = $4,
              resolved_at = now(),
              updated_at = now()
        WHERE id = $1::uuid
      RETURNING *`,
      [input.collisionId, nextStatus, input.note.trim(), input.actorUserId],
    );
    await client.query("COMMIT");
    return mapCollisionRow(updated.rows[0]!);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

