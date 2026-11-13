import { createHmac } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import {
  oidcAuthorizationRequestSchema,
  oidcTokenExchangeRequestSchema,
} from "@bazion/api-contracts";
import {
  buildBffSessionCookieOptions,
  buildOidcTransactionCookieOptions,
  getCurrentIdentity,
  isSandboxRequestHeaders,
  parseCookieHeader,
  resolveSafeRedirectTarget,
  serializeClearCookieHeader,
  serializeSetCookieHeader,
  shouldUseStrictHostCookies,
} from "@bazion/auth";
import type { OidcSecurityError } from "@bazion/auth/server";
import type { AppConfig } from "../../config.js";
import { pool } from "../../lib/database.js";

const auditWriter = new PostgresAuditEventWriter(pool);

export interface OidcRoutesOptions {
  config?: AppConfig;
}

async function resolveRuntimeOidcSettings(config?: AppConfig) {
  const authServer = await import("@bazion/auth/server");
  const nodeEnv = config?.NODE_ENV ?? process.env.NODE_ENV ?? "development";
  const issuer = (
    config?.oidc?.issuer
    ?? process.env.OIDC_ISSUER
    ?? config?.BETTER_AUTH_URL
    ?? process.env.BETTER_AUTH_URL
    ?? "http://localhost:4000"
  ).replace(/\/+$/, "");
  const vaultSecret =
    config?.BETTER_AUTH_SECRET
    ?? process.env.BETTER_AUTH_SECRET
    ?? "dev-test-vault-secret-minimum-32-chars-for-tests";
  const storefrontOrigin = config?.PUBLIC_STOREFRONT_URL ?? process.env.PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
  const consoleOrigin = config?.platformConsoleUrl ?? process.env.PLATFORM_CONSOLE_URL ?? "http://localhost:3001";
  const commercialOrigin = config?.commercialPortalUrl ?? process.env.COMMERCIAL_PORTAL_URL;
  const trustedRedirectOrigins = [
    storefrontOrigin,
    consoleOrigin,
    ...(commercialOrigin ? [commercialOrigin] : []),
    ...(config?.corsOrigins ?? []),
  ];
  const bffClientId = config?.oidc?.bffClientId ?? process.env.OIDC_BFF_CLIENT_ID ?? "bazion-bff-platform";
  const configuredBffClientSecret = config?.oidc?.bffClientSecret ?? process.env.OIDC_BFF_CLIENT_SECRET;
  if (nodeEnv === "production" && !configuredBffClientSecret) {
    throw new Error("OIDC_BFF_CLIENT_SECRET must be configured explicitly in production.");
  }
  const bffClientSecret =
    configuredBffClientSecret
    ?? createHmac("sha256", vaultSecret).update("bazion:oidc:bff-client").digest("hex");

  const authority = authServer.getOidcAuthority({
    issuer,
    privateKeyPem: config?.oidc?.privateKeyPem ?? process.env.OIDC_SIGNING_PRIVATE_KEY_PEM,
    keyId: config?.oidc?.keyId ?? process.env.OIDC_SIGNING_KEY_ID,
    vaultSecret,
    nodeEnv,
    trustedRedirectOrigins,
  });

  const redirectUris = Array.from(new Set([
    `${issuer}/v1/bff/callback`,
    `${storefrontOrigin.replace(/\/+$/, "")}/api/auth/callback`,
    `${storefrontOrigin.replace(/\/+$/, "")}/api/auth/oidc/callback`,
    `${consoleOrigin.replace(/\/+$/, "")}/api/auth/callback`,
    `${consoleOrigin.replace(/\/+$/, "")}/api/auth/oidc/callback`,
    ...(commercialOrigin ? [
      `${commercialOrigin.replace(/\/+$/, "")}/api/auth/callback`,
      `${commercialOrigin.replace(/\/+$/, "")}/api/auth/oidc/callback`,
    ] : []),
  ]));

  return {
    nodeEnv,
    issuer,
    authServer,
    authority,
    bffClientId,
    bffClientSecret,
    bffCallbackUri: `${issuer}/v1/bff/callback`,
    trustedRedirectOrigins,
    redirectUris,
  };
}

function setSecurityNoStoreHeaders(reply: FastifyReply) {
  reply.header("cache-control", "no-store");
  reply.header("pragma", "no-cache");
  reply.header("referrer-policy", "no-referrer");
}

function readCookie(request: FastifyRequest, names: readonly string[]): string | undefined {
  const parsed = parseCookieHeader(request.headers.cookie);
  for (const name of names) {
    if (parsed[name]) return parsed[name];
  }
  return undefined;
}

function strictCookiesForRequest(request: FastifyRequest, nodeEnv: string, issuer: string): boolean {
  const forwardedProto = Array.isArray(request.headers["x-forwarded-proto"])
    ? request.headers["x-forwarded-proto"][0]
    : request.headers["x-forwarded-proto"];
  return shouldUseStrictHostCookies({
    nodeEnv,
    baseUrl: issuer,
    ...(forwardedProto ? { forwardedProto } : {}),
  });
}

let defaultClientEnsuredFor: string | null = null;

async function ensureDefaultClientRegistered(settings: Awaited<ReturnType<typeof resolveRuntimeOidcSettings>>) {
  const cacheKey = `${settings.issuer}|${settings.bffClientId}|${settings.redirectUris.join(",")}`;
  if (defaultClientEnsuredFor === cacheKey) return;
  await settings.authority.upsertClient({
    clientId: settings.bffClientId,
    clientName: "Bazion Platform BFF",
    clientType: "confidential_bff",
    clientSecret: settings.bffClientSecret,
    redirectUris: settings.redirectUris,
    allowedScopes: ["openid", "profile", "email", "tenant:admin", "platform:control", "commercial:billing:read"],
  });
  defaultClientEnsuredFor = cacheKey;
}

export async function oidcDiscoveryRoutes(app: FastifyInstance, options: OidcRoutesOptions = {}): Promise<void> {
  app.get("/.well-known/openid-configuration", async (_request, reply) => {
    const settings = await resolveRuntimeOidcSettings(options.config);
    reply.header("cache-control", "public, max-age=300");
    return reply.send(settings.authority.getDiscoveryDocument());
  });
}

export async function oidcRoutes(app: FastifyInstance, options: OidcRoutesOptions = {}): Promise<void> {
  // Support OAuth2 standard form-urlencoded token requests within this route scope.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try {
      const params = new URLSearchParams(typeof body === "string" ? body : String(body));
      done(null, Object.fromEntries(params.entries()));
    } catch (error) {
      done(error as Error);
    }
  });

  app.get("/oidc/jwks", async (_request, reply) => {
    const settings = await resolveRuntimeOidcSettings(options.config);
    reply.header("cache-control", "public, max-age=300");
    return reply.send(settings.authority.getJwks());
  });

  app.get("/oidc/authorize", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Sign in before authorizing OIDC access." });
    }

    const settings = await resolveRuntimeOidcSettings(options.config);
    const sessionDetails = await settings.authServer.auth.api.getSession({ headers: new Headers(request.headers as Record<string, string>) }).catch(() => null);
    const impersonatedBy = (sessionDetails as { session?: { impersonatedBy?: unknown } } | null)?.session?.impersonatedBy;
    const isSandboxHeader = isSandboxRequestHeaders(request.headers);
    const isSandboxSession = Boolean(impersonatedBy || isSandboxHeader);

    try {
      settings.authServer.assertNoSandboxImpersonation({
        impersonatedBy,
        is_sandbox: isSandboxHeader,
      });
    } catch (error) {
      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: identity.tenant?.id ?? null,
        action: "oidc.authorize",
        resourceType: "oidc_authorization",
        outcome: "denied",
        requestId: request.id,
        metadata: { reason: "sandbox_impersonation_blocked" },
      }).catch(() => undefined);
      const err = error as OidcSecurityError;
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }

    const parsed = oidcAuthorizationRequestSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message: parsed.error.issues[0]?.message ?? "Invalid OIDC authorization parameters.",
      });
    }

    await ensureDefaultClientRegistered(settings);

    try {
      const authorized = await settings.authority.authorize({
        clientId: parsed.data.client_id,
        redirectUri: parsed.data.redirect_uri,
        responseType: parsed.data.response_type,
        scope: parsed.data.scope,
        state: parsed.data.state,
        nonce: parsed.data.nonce,
        codeChallenge: parsed.data.code_challenge,
        codeChallengeMethod: parsed.data.code_challenge_method,
        userId: identity.user.id,
        tenantId: parsed.data.tenant_id ?? identity.tenant?.id ?? null,
        isSandboxSession,
      });

      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: parsed.data.tenant_id ?? identity.tenant?.id ?? null,
        action: "oidc.authorize",
        resourceType: "oidc_client",
        resourceId: parsed.data.client_id,
        outcome: "succeeded",
        requestId: request.id,
      }).catch(() => undefined);

      return reply.redirect(authorized.redirectTo, 302);
    } catch (error) {
      if (error instanceof settings.authServer.OidcSecurityError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.post("/oidc/token", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const parsed = oidcTokenExchangeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message ?? "Malformed OIDC token request.",
      });
    }

    const settings = await resolveRuntimeOidcSettings(options.config);
    await ensureDefaultClientRegistered(settings);

    try {
      const tokens = await settings.authority.exchangeToken({
        grantType: parsed.data.grant_type,
        code: parsed.data.code,
        redirectUri: parsed.data.redirect_uri,
        clientId: parsed.data.client_id,
        ...(parsed.data.client_secret !== undefined ? { clientSecret: parsed.data.client_secret } : {}),
        codeVerifier: parsed.data.code_verifier,
      });

      return reply.code(200).send({
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        id_token: tokens.id_token,
        access_token: tokens.access_token,
      });
    } catch (error) {
      if (error instanceof settings.authServer.OidcSecurityError) {
        await auditWriter.append({
          actorType: "service",
          actorId: parsed.data.client_id,
          action: "oidc.token.exchange",
          resourceType: "oidc_client",
          resourceId: parsed.data.client_id,
          outcome: "denied",
          requestId: request.id,
          metadata: { reason: error.code },
        }).catch(() => undefined);

        return reply.code(error.statusCode).send({
          error: error.code === "OIDC_INVALID_GRANT" ? "invalid_grant" : error.code,
          error_description: error.message,
        });
      }
      throw error;
    }
  });

  app.get("/oidc/userinfo", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const authHeader = request.headers.authorization;
    const match = typeof authHeader === "string" ? /^Bearer\s+(\S+)$/i.exec(authHeader.trim()) : null;
    if (!match?.[1]) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Bearer access token is required." });
    }

    const settings = await resolveRuntimeOidcSettings(options.config);
    try {
      const userinfo = await settings.authority.getUserinfo(match[1]);
      return reply.code(200).send(userinfo);
    } catch (error) {
      if (error instanceof settings.authServer.OidcSecurityError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.get("/bff/login", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const settings = await resolveRuntimeOidcSettings(options.config);
    await ensureDefaultClientRegistered(settings);

    const query = (request.query ?? {}) as Record<string, unknown>;
    const rawReturnTo = typeof query.redirect === "string"
      ? query.redirect
      : typeof query.returnTo === "string"
        ? query.returnTo
        : "/workspace";
    const safeReturnTo = resolveSafeRedirectTarget(rawReturnTo, {
      allowedOrigins: settings.trustedRedirectOrigins,
      fallback: "/workspace",
    });

    const tx = await settings.authority.beginBffTransaction({
      clientId: settings.bffClientId,
      returnTo: safeReturnTo,
    });

    const strictHostCookie = strictCookiesForRequest(request, settings.nodeEnv, settings.issuer);
    const txCookieDescriptor = buildOidcTransactionCookieOptions({ strictHostCookie });
    reply.header("set-cookie", serializeSetCookieHeader({ ...txCookieDescriptor, value: tx.txToken }));

    const authorizeUrl = new URL(`${settings.issuer}/v1/oidc/authorize`);
    authorizeUrl.searchParams.set("client_id", settings.bffClientId);
    authorizeUrl.searchParams.set("redirect_uri", settings.bffCallbackUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid profile email tenant:admin");
    authorizeUrl.searchParams.set("state", tx.state);
    authorizeUrl.searchParams.set("nonce", tx.nonce);
    authorizeUrl.searchParams.set("code_challenge", tx.codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    if (query.mode === "json") {
      return reply.code(200).send({
        authorizeUrl: authorizeUrl.toString(),
        state: tx.state,
        codeChallenge: tx.codeChallenge,
        codeChallengeMethod: tx.codeChallengeMethod,
        returnTo: tx.returnTo,
      });
    }

    return reply.redirect(authorizeUrl.toString(), 302);
  });

  app.get("/bff/callback", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const settings = await resolveRuntimeOidcSettings(options.config);
    await ensureDefaultClientRegistered(settings);

    const strictHostCookie = strictCookiesForRequest(request, settings.nodeEnv, settings.issuer);
    const txCookieDescriptor = buildOidcTransactionCookieOptions({ strictHostCookie });
    const txToken = readCookie(request, ["__Host-Http-bazion_oidc_tx", "bazion_oidc_tx"]);
    const query = (request.query ?? {}) as Record<string, unknown>;
    const code = typeof query.code === "string" ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";

    if (!txToken || !code || !state) {
      reply.header("set-cookie", serializeClearCookieHeader(txCookieDescriptor));
      return reply.code(400).send({
        error: "BFF_CALLBACK_INVALID",
        message: "Missing OIDC transaction cookie, authorization code, or state.",
      });
    }

    try {
      const completed = await settings.authority.completeBffCallback({
        txToken,
        code,
        state,
        clientId: settings.bffClientId,
        clientSecret: settings.bffClientSecret,
        redirectUri: settings.bffCallbackUri,
      });

      const sessionCookieDescriptor = buildBffSessionCookieOptions({ strictHostCookie });
      reply.header("set-cookie", [
        serializeClearCookieHeader(txCookieDescriptor),
        serializeSetCookieHeader({ ...sessionCookieDescriptor, value: completed.sessionToken }),
      ]);

      await auditWriter.append({
        actorType: "user",
        actorId: completed.user.sub,
        actorRole: completed.user.platformRole ?? null,
        tenantId: completed.user.tenantId ?? null,
        action: "auth.bff.login",
        resourceType: "oidc_bff_session",
        outcome: "succeeded",
        requestId: request.id,
      }).catch(() => undefined);

      return reply.redirect(completed.returnTo, 302);
    } catch (error) {
      reply.header("set-cookie", serializeClearCookieHeader(txCookieDescriptor));
      if (error instanceof settings.authServer.OidcSecurityError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.get("/bff/session", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const settings = await resolveRuntimeOidcSettings(options.config);
    const strictHostCookie = strictCookiesForRequest(request, settings.nodeEnv, settings.issuer);
    const sessionToken = readCookie(request, ["__Host-Http-bazion_bff_session", "bazion_bff_session"]);
    if (!sessionToken) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "No active BFF session." });
    }

    const session = await settings.authority.getBffSession(sessionToken);
    if (!session) {
      reply.header("set-cookie", serializeClearCookieHeader(buildBffSessionCookieOptions({ strictHostCookie })));
      return reply.code(401).send({ error: "SESSION_EXPIRED", message: "BFF session expired or was revoked." });
    }

    return reply.code(200).send(session);
  });

  app.post("/bff/logout", async (request, reply) => {
    setSecurityNoStoreHeaders(reply);
    const settings = await resolveRuntimeOidcSettings(options.config);
    const strictHostCookie = strictCookiesForRequest(request, settings.nodeEnv, settings.issuer);
    const sessionToken = readCookie(request, ["__Host-Http-bazion_bff_session", "bazion_bff_session"]);

    const identity = await getCurrentIdentity(request.headers).catch(() => null);
    let revokedBff = false;
    if (sessionToken) {
      revokedBff = await settings.authority.revokeBffSession(sessionToken);
    }

    await settings.authServer.auth.api.signOut({
      headers: new Headers(request.headers as Record<string, string>),
    }).catch(() => undefined);

    reply.header("set-cookie", [
      serializeClearCookieHeader(buildBffSessionCookieOptions({ strictHostCookie })),
      serializeClearCookieHeader(buildOidcTransactionCookieOptions({ strictHostCookie })),
    ]);

    if (identity) {
      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: identity.tenant?.id ?? null,
        action: "auth.bff.logout",
        resourceType: "oidc_bff_session",
        outcome: "succeeded",
        requestId: request.id,
        metadata: { revokedBff },
      }).catch(() => undefined);
    }

    return reply.code(200).send({ signedOut: true, revokedBff });
  });
}
