import { createOidcAuthority, loadOrGenerateOidcSigningKey } from "./oidc.js";
import {
  confirmAccountEmailChange,
  consumeOrderClaimProof,
  issueOrderClaimProof,
  listIdentityCollisions,
  requestAccountEmailChange,
  resolveIdentityCollision,
  resolveOrLinkFederatedIdentity,
  sha256Hex,
  type SqlPool,
} from "./identity-lifecycle.js";

export interface PlatformPhase5Deps {
  identityPool: SqlPool;
  authPool: SqlPool;
  ensureTenantOwnerMembership: (organizationId: string, userId: string) => Promise<void>;
}

let cachedAuthority: ReturnType<typeof createOidcAuthority> | null = null;
let cachedConfigFingerprint = "";

export function getPlatformOidcAuthority(
  deps: PlatformPhase5Deps,
  config: {
    issuer?: string | undefined;
    privateKeyPem?: string | undefined;
    keyId?: string | undefined;
    vaultSecret?: string | undefined;
    nodeEnv?: string | undefined;
    trustedRedirectOrigins?: readonly string[] | undefined;
  } = {},
) {
  const issuer = (config.issuer ?? process.env.OIDC_ISSUER ?? process.env.BETTER_AUTH_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  const vaultSecret = config.vaultSecret ?? process.env.BETTER_AUTH_SECRET ?? "";
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const privateKeyPem = config.privateKeyPem ?? process.env.OIDC_SIGNING_PRIVATE_KEY_PEM;
  const keyId = config.keyId ?? process.env.OIDC_SIGNING_KEY_ID;
  const trustedRedirectOrigins = config.trustedRedirectOrigins ?? [
    process.env.PUBLIC_STOREFRONT_URL ?? "http://localhost:3000",
    process.env.PLATFORM_CONSOLE_URL ?? "http://localhost:3001",
    ...(process.env.COMMERCIAL_PORTAL_URL ? [process.env.COMMERCIAL_PORTAL_URL] : []),
  ];

  const fingerprint = `${issuer}|${keyId ?? ""}|${sha256Hex(vaultSecret)}|${trustedRedirectOrigins.join(",")}`;
  if (!cachedAuthority || cachedConfigFingerprint !== fingerprint) {
    const signingKey = loadOrGenerateOidcSigningKey({ privateKeyPem, keyId, nodeEnv });
    cachedAuthority = createOidcAuthority({
      issuer,
      identityPool: deps.identityPool,
      authPool: deps.authPool,
      signingKey,
      vaultSecret,
      trustedRedirectOrigins,
    });
    cachedConfigFingerprint = fingerprint;
  }

  return cachedAuthority;
}

export async function issuePlatformGuestOrderClaimProof(
  deps: PlatformPhase5Deps,
  input: {
    externalOrderId: string;
    externalCustomerId: string;
    tenantId: string;
    installationId?: string | null;
    issuedByClient?: string;
    expiresInSeconds?: number;
  },
) {
  return issueOrderClaimProof({
    identityPool: deps.identityPool,
    ...input,
  });
}

export async function claimPlatformGuestOrder(
  deps: PlatformPhase5Deps,
  input: {
    proofToken: string;
    claimantUserId: string;
    claimantEmailVerified: boolean;
  },
) {
  return consumeOrderClaimProof({
    identityPool: deps.identityPool,
    authPool: deps.authPool,
    proofToken: input.proofToken,
    claimantUserId: input.claimantUserId,
    claimantEmailVerified: input.claimantEmailVerified,
    ensureTenantOwnerMembership: deps.ensureTenantOwnerMembership,
  });
}

export async function requestPlatformEmailChange(
  deps: PlatformPhase5Deps,
  input: {
    userId: string;
    currentEmail: string;
    newEmail: string;
    expiresInSeconds?: number;
  },
) {
  return requestAccountEmailChange({
    identityPool: deps.identityPool,
    authPool: deps.authPool,
    ...input,
  });
}

export async function confirmPlatformEmailChange(
  deps: PlatformPhase5Deps,
  input: {
    actorUserId: string;
    token: string;
  },
) {
  return confirmAccountEmailChange({
    identityPool: deps.identityPool,
    authPool: deps.authPool,
    ...input,
  });
}

export async function listPlatformIdentityCollisions(
  deps: PlatformPhase5Deps,
  input: { status?: "open" | "resolved_linked" | "resolved_rejected"; limit?: number } = {},
) {
  return listIdentityCollisions({
    identityPool: deps.identityPool,
    ...input,
  });
}

export async function resolvePlatformIdentityCollision(
  deps: PlatformPhase5Deps,
  input: {
    collisionId: string;
    actorUserId: string;
    action: "resolve_link" | "reject";
    targetUserId?: string;
    note: string;
  },
) {
  return resolveIdentityCollision({
    identityPool: deps.identityPool,
    authPool: deps.authPool,
    ...input,
  });
}

export async function resolvePlatformFederatedIdentity(
  deps: PlatformPhase5Deps,
  input: {
    issuer: string;
    subject: string;
    email: string;
    emailVerified: boolean;
    explicitUserId?: string | null;
    linkedVia: "oidc_login" | "owner_claim" | "admin_link" | "migration_backfill";
  },
) {
  return resolveOrLinkFederatedIdentity({
    identityPool: deps.identityPool,
    authPool: deps.authPool,
    ...input,
  });
}
