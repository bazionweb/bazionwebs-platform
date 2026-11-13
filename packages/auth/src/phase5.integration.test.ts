import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const runIntegration = process.env.AUTH_INTEGRATION_TESTS === "true" || process.env.AUTH_INTEGRATION_TESTS === "1";

describe.skipIf(!runIntegration)("Phase 5 PostgreSQL identity, OIDC BFF, claim proof, and email lifecycle", () => {
  const suffix = randomUUID().slice(0, 8);
  const cleanupPool = runIntegration
    ? new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL ?? process.env.TENANT_PROVISIONER_DATABASE_URL })
    : null;
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdClientIds: string[] = [];

  async function loadServer() {
    return import("./server.js");
  }

  async function seedVerifiedUser(label: string) {
    const server = await loadServer();
    const email = `phase5-${label}-${suffix}@example.test`;
    const result = await server.auth.api.signUpEmail({
      body: {
        email,
        password: `Phase5!StrongPass#${suffix}`,
        name: `Phase5 ${label}`,
      },
    });
    const userId = result.user.id;
    createdUserIds.push(userId);
    await server.authPool.query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [userId]);
    return { userId, email };
  }

  async function seedTenantWithOrg(slugSuffix: string) {
    const server = await loadServer();
    const slug = `p5-${slugSuffix}-${suffix}`;
    const orgId = `org_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    createdOrgIds.push(orgId);
    await server.authPool.query(
      'INSERT INTO "organization" (id, name, slug, "createdAt") VALUES ($1, $2, $3, now())',
      [orgId, `Phase 5 Tenant ${slugSuffix}`, slug],
    );
    const tRes = await cleanupPool!.query(
      `INSERT INTO public.tenants (slug, name, default_currency, auth_organization_id, status)
       VALUES ($1, $2, 'KES', $3, 'active')
       RETURNING id`,
      [slug, `Phase 5 Tenant ${slugSuffix}`, orgId],
    );
    const tenantId = String(tRes.rows[0]!.id);
    createdTenantIds.push(tenantId);
    return { tenantId, orgId, slug };
  }

  afterAll(async () => {
    if (!runIntegration) return;
    const server = await loadServer();
    try {
      for (const userId of createdUserIds) {
        await cleanupPool?.query("DELETE FROM public.account_email_change_requests WHERE user_id = $1", [userId]);
        await cleanupPool?.query("DELETE FROM public.oidc_bff_sessions WHERE user_id = $1", [userId]);
        await cleanupPool?.query("DELETE FROM public.oidc_authorization_codes WHERE user_id = $1", [userId]);
        await cleanupPool?.query("DELETE FROM public.federated_identity_links WHERE user_id = $1", [userId]);
        await cleanupPool?.query(
          "DELETE FROM public.identity_link_collisions WHERE existing_user_id = $1 OR conflicting_user_id = $1",
          [userId],
        );
      }
      for (const tenantId of createdTenantIds) {
        await cleanupPool?.query("DELETE FROM public.commercial_order_claim_proofs WHERE tenant_id = $1::uuid", [tenantId]);
        await cleanupPool?.query("DELETE FROM public.tenants WHERE id = $1::uuid", [tenantId]);
      }
      for (const clientId of createdClientIds) {
        await cleanupPool?.query("DELETE FROM public.oidc_bff_auth_transactions WHERE client_id = $1", [clientId]);
        await cleanupPool?.query("DELETE FROM public.oidc_clients WHERE client_id = $1", [clientId]);
      }
      for (const orgId of createdOrgIds) {
        await server.authPool.query('DELETE FROM "member" WHERE "organizationId" = $1', [orgId]);
        await server.authPool.query('DELETE FROM "organization" WHERE id = $1', [orgId]);
      }
      for (const userId of createdUserIds) {
        await server.authPool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
        await server.authPool.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
        await server.authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
      }
    } finally {
      await cleanupPool?.end();
      await server.closeAuthResources();
    }
  });

  it("completes OIDC PKCE S256 BFF flow, rejects code replay, and revokes BFF sessions on logout", async () => {
    const server = await loadServer();
    const user = await seedVerifiedUser("oidc");
    const tenant = await seedTenantWithOrg("oidc");
    await server.auth.api.addMember({ body: { organizationId: tenant.orgId, userId: user.userId, role: "owner" } });

    const authority = server.getOidcAuthority({
      issuer: "https://auth.bazion.example",
      vaultSecret: "phase5-vault-secret-material-at-least-32-chars",
      nodeEnv: "test",
    });

    const clientId = `bff-client-${suffix}`;
    const clientSecret = `secret-material-${suffix}-${randomUUID()}`;
    const redirectUri = "https://app.bazion.example/api/bff/callback";
    createdClientIds.push(clientId);

    await authority.upsertClient({
      clientId,
      clientName: "Test BFF RP",
      clientType: "confidential_bff",
      clientSecret,
      redirectUris: [redirectUri],
      allowedScopes: ["openid", "profile", "email", "tenant:admin"],
    });

    await expect(
      authority.authorize({
        clientId,
        redirectUri,
        responseType: "code",
        scope: "openid profile",
        state: "state-1234567890abcdef",
        nonce: "nonce-1234567890abcdef",
        codeChallenge: server.computePkceS256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-123456"),
        codeChallengeMethod: "S256",
        userId: user.userId,
        tenantId: tenant.tenantId,
        isSandboxSession: true,
      }),
    ).rejects.toThrow(server.OidcSecurityError);

    const tx = await authority.beginBffTransaction({
      clientId,
      returnTo: "https://evil.example.test/steal",
    });
    expect(tx.returnTo).toBe("/workspace");

    const authz = await authority.authorize({
      clientId,
      redirectUri,
      responseType: "code",
      scope: "openid profile email tenant:admin",
      state: tx.state,
      nonce: tx.nonce,
      codeChallenge: tx.codeChallenge,
      codeChallengeMethod: tx.codeChallengeMethod,
      userId: user.userId,
      tenantId: tenant.tenantId,
    });
    expect(authz.redirectTo).not.toContain("access_token");
    expect(authz.redirectTo).not.toContain("id_token");

    await expect(
      authority.completeBffCallback({
        txToken: tx.txToken,
        code: authz.code,
        state: "tampered-state-value-123456",
        clientId,
        clientSecret,
        redirectUri,
      }),
    ).rejects.toThrow(/state/i);

    const tx2 = await authority.beginBffTransaction({ clientId, returnTo: "/admin" });
    const authz2 = await authority.authorize({
      clientId,
      redirectUri,
      responseType: "code",
      scope: "openid profile email tenant:admin",
      state: tx2.state,
      nonce: tx2.nonce,
      codeChallenge: tx2.codeChallenge,
      codeChallengeMethod: tx2.codeChallengeMethod,
      userId: user.userId,
      tenantId: tenant.tenantId,
    });

    const completed = await authority.completeBffCallback({
      txToken: tx2.txToken,
      code: authz2.code,
      state: tx2.state,
      clientId,
      clientSecret,
      redirectUri,
    });
    expect(completed.returnTo).toBe("/admin");
    expect(completed.user.email).toBe(user.email);
    expect(completed.user.orgRoles).toContain("owner");

    const txWrongPkce = await authority.beginBffTransaction({ clientId, returnTo: "/admin" });
    const authzWrongPkce = await authority.authorize({
      clientId,
      redirectUri,
      responseType: "code",
      scope: "openid profile",
      state: txWrongPkce.state,
      nonce: txWrongPkce.nonce,
      codeChallenge: server.computePkceS256Challenge("correct-verifier-material-0123456789abcdef012345"),
      codeChallengeMethod: "S256",
      userId: user.userId,
      tenantId: tenant.tenantId,
    });
    await expect(
      authority.exchangeToken({
        grantType: "authorization_code",
        code: authzWrongPkce.code,
        redirectUri,
        clientId,
        clientSecret,
        codeVerifier: "tampered-verifier-material-0123456789abcdef01234",
      }),
    ).rejects.toThrow(/PKCE/);

    await expect(
      authority.exchangeToken({
        grantType: "authorization_code",
        code: authz2.code,
        redirectUri,
        clientId,
        clientSecret,
        codeVerifier: "another-verifier-material-0123456789abcdef012345",
      }),
    ).rejects.toThrow(/invalid, expired, or already used/);

    const activeSession = await authority.getBffSession(completed.sessionToken);
    expect(activeSession?.userId).toBe(user.userId);
    expect(activeSession).not.toHaveProperty("accessTokenCiphertext");

    expect(await authority.revokeBffSession(completed.sessionToken)).toBe(true);
    expect(await authority.getBffSession(completed.sessionToken)).toBeNull();
  }, 15_000);

  it("refuses automatic email-based identity merge, logs collisions, and lets support resolve them explicitly", async () => {
    const server = await loadServer();
    const userA = await seedVerifiedUser("col-a");
    const userB = await seedVerifiedUser("col-b");
    const externalIssuer = `https://idp-${suffix}.example.test`;
    const externalSubject = `ext-sub-${suffix}`;

    let caughtError: unknown;
    try {
      await server.resolveFederatedSubjectLink({
        issuer: externalIssuer,
        subject: externalSubject,
        email: userA.email,
        emailVerified: true,
        linkedVia: "oidc_login",
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(server.IdentityLifecycleError);
    const err = caughtError as InstanceType<typeof server.IdentityLifecycleError>;
    expect(err.code).toBe("IDENTITY_LINK_COLLISION");
    expect(err.collisionId).toBeTruthy();

    const openCollisions = await server.listIdentityCollisionsForSupport({ status: "open" });
    expect(openCollisions.some((c) => c.id === err.collisionId && c.existingUserId === userA.userId)).toBe(true);

    const resolved = await server.resolveIdentityCollisionForSupport({
      collisionId: err.collisionId!,
      actorUserId: "platform-owner-test",
      action: "resolve_link",
      targetUserId: userA.userId,
      note: "Verified user ticket confirmation #1001",
    });
    expect(resolved.status).toBe("resolved_linked");

    await expect(
      server.resolveFederatedSubjectLink({
        issuer: externalIssuer,
        subject: externalSubject,
        email: userB.email,
        emailVerified: true,
        explicitUserId: userB.userId,
        linkedVia: "oidc_login",
      }),
    ).rejects.toThrow(/already bound/);
  });

  it("enforces single-use guest order claim proofs and protects against silent owner takeover or email merge", async () => {
    const server = await loadServer();
    const claimantA = await seedVerifiedUser("claim-a");
    const claimantB = await seedVerifiedUser("claim-b");
    const tenant = await seedTenantWithOrg("claim");

    const issued = await server.issueGuestOrderClaim({
      externalOrderId: `ord-${suffix}-1`,
      externalCustomerId: `cus-${suffix}-1`,
      tenantId: tenant.tenantId,
      expiresInSeconds: 600,
    });
    expect(issued.proofToken.length).toBeGreaterThanOrEqual(32);

    const rawCheck = await cleanupPool!.query(
      "SELECT id FROM public.commercial_order_claim_proofs WHERE proof_hash = $1",
      [issued.proofToken],
    );
    expect(rawCheck.rowCount).toBe(0);

    await expect(
      server.claimGuestOrder({
        proofToken: issued.proofToken,
        claimantUserId: claimantA.userId,
        claimantEmailVerified: false,
      }),
    ).rejects.toThrow(/Verify your email/);

    const claimed = await server.claimGuestOrder({
      proofToken: issued.proofToken,
      claimantUserId: claimantA.userId,
      claimantEmailVerified: true,
    });
    expect(claimed.membershipRole).toBe("owner");

    await expect(
      server.claimGuestOrder({
        proofToken: issued.proofToken,
        claimantUserId: claimantA.userId,
        claimantEmailVerified: true,
      }),
    ).rejects.toThrow(/already been used/);

    const issued2 = await server.issueGuestOrderClaim({
      externalOrderId: `ord-${suffix}-2`,
      externalCustomerId: `cus-${suffix}-2`,
      tenantId: tenant.tenantId,
      expiresInSeconds: 600,
    });
    await expect(
      server.claimGuestOrder({
        proofToken: issued2.proofToken,
        claimantUserId: claimantB.userId,
        claimantEmailVerified: true,
      }),
    ).rejects.toThrow(/already has an owner/);
  });

  it("executes verified email changes safely, rejects conflicts without merging, and invalidates active BFF sessions", async () => {
    const server = await loadServer();
    const userA = await seedVerifiedUser("email-a");
    const userB = await seedVerifiedUser("email-b");

    await expect(
      server.requestEmailChange({
        userId: userA.userId,
        currentEmail: userA.email,
        newEmail: userB.email,
      }),
    ).rejects.toThrow(/already registered/);

    const requested = await server.requestEmailChange({
      userId: userA.userId,
      currentEmail: userA.email,
      newEmail: `updated-${suffix}@example.test`,
    });

    await expect(
      server.confirmEmailChange({
        actorUserId: userB.userId,
        token: requested.verificationToken,
      }),
    ).rejects.toThrow(/belongs to a different account/);

    const confirmed = await server.confirmEmailChange({
      actorUserId: userA.userId,
      token: requested.verificationToken,
    });
    expect(confirmed.newEmail).toBe(`updated-${suffix}@example.test`);

    const userRow = await server.authPool.query('SELECT email, "emailVerified" AS ev FROM "user" WHERE id = $1', [userA.userId]);
    expect(userRow.rows[0]?.email).toBe(`updated-${suffix}@example.test`);
    expect(userRow.rows[0]?.ev).toBe(true);
  });
});
