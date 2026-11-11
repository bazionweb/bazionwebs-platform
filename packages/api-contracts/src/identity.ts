import { z } from "zod";

export const oidcDiscoveryDocumentSchema = z.object({
  issuer: z.string().url(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  userinfo_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
  end_session_endpoint: z.string().url(),
  response_types_supported: z.array(z.literal("code")).min(1),
  grant_types_supported: z.array(z.literal("authorization_code")).min(1),
  subject_types_supported: z.array(z.literal("public")).min(1),
  id_token_signing_alg_values_supported: z.array(z.literal("RS256")).min(1),
  code_challenge_methods_supported: z.array(z.literal("S256")).min(1),
  token_endpoint_auth_methods_supported: z.array(z.enum(["client_secret_post", "none"])).min(1),
  scopes_supported: z.array(z.string().min(1)).min(1),
  claims_supported: z.array(z.string().min(1)).min(1),
}).strict();

export const oidcAuthorizationRequestSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  redirect_uri: z.string().trim().url().max(1024),
  response_type: z.literal("code"),
  scope: z.string().trim().min(6).max(512),
  state: z.string().trim().min(16).max(256),
  nonce: z.string().trim().min(16).max(256),
  code_challenge: z.string().trim().regex(/^[A-Za-z0-9_-]{43,128}$/, "PKCE S256 challenge must be Base64URL (43-128 chars)."),
  code_challenge_method: z.literal("S256"),
  tenant_id: z.string().uuid().optional(),
}).strict();

export const oidcTokenExchangeRequestSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().trim().min(24).max(512),
  redirect_uri: z.string().trim().url().max(1024),
  client_id: z.string().trim().min(1).max(128),
  client_secret: z.string().min(16).max(256).optional(),
  code_verifier: z.string().trim().regex(/^[A-Za-z0-9._~-]{43,128}$/, "PKCE code_verifier violates RFC 7636 syntax."),
}).strict();

export const oidcIdentityClaimsSchema = z.object({
  iss: z.string().url(),
  sub: z.string().min(1).max(255),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  exp: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  auth_time: z.number().int().nonnegative(),
  jti: z.string().min(1).max(128),
  nonce: z.string().min(16).max(256).optional(),
  email: z.string().email().max(254),
  email_verified: z.boolean(),
  name: z.string().max(160),
  platform_role: z.enum(["platform_owner", "platform_admin", "platform_support"]).nullable(),
  tenant_id: z.string().uuid().nullable(),
  tenant_slug: z.string().max(80).nullable(),
  org_roles: z.array(z.string().min(1).max(64)),
  is_sandbox: z.literal(false).optional(),
}).strict();

export const issueOrderClaimProofInputSchema = z.object({
  externalOrderId: z.string().trim().min(1).max(128),
  externalCustomerId: z.string().trim().min(1).max(128),
  tenantId: z.string().uuid(),
  installationId: z.string().uuid().optional(),
  expiresInSeconds: z.number().int().min(60).max(86_400).default(900),
}).strict();

export const consumeOrderClaimProofInputSchema = z.object({
  proofToken: z.string().trim().min(32).max(256),
}).strict();

export const requestEmailChangeInputSchema = z.object({
  newEmail: z.string().trim().email().max(254),
}).strict();

export const confirmEmailChangeInputSchema = z.object({
  token: z.string().trim().min(32).max(256),
}).strict();

export const resolveIdentityCollisionInputSchema = z.object({
  action: z.enum(["resolve_link", "reject"]),
  targetUserId: z.string().trim().min(1).max(128).optional(),
  note: z.string().trim().min(3).max(500),
}).strict().superRefine((value, ctx) => {
  if (value.action === "resolve_link" && !value.targetUserId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetUserId"],
      message: "targetUserId is required when resolving an identity collision by linking.",
    });
  }
});

export const deepLinkAreaSchema = z.enum([
  "commercial_billing",
  "commercial_invoices",
  "commercial_subscriptions",
  "commercial_proposals",
  "commercial_support",
  "platform_console_tenant",
  "platform_console_deployments",
  "platform_console_domains",
  "tenant_workspace_admin",
  "tenant_storefront",
]);

export const scopedDeepLinkRequestSchema = z.object({
  area: deepLinkAreaSchema,
  tenantId: z.string().uuid().optional(),
  installationId: z.string().uuid().optional(),
  externalRef: z.string().trim().min(1).max(128).optional(),
}).strict();

export type OidcDiscoveryDocument = z.infer<typeof oidcDiscoveryDocumentSchema>;
export type OidcAuthorizationRequest = z.infer<typeof oidcAuthorizationRequestSchema>;
export type OidcTokenExchangeRequest = z.infer<typeof oidcTokenExchangeRequestSchema>;
export type OidcIdentityClaims = z.infer<typeof oidcIdentityClaimsSchema>;
export type IssueOrderClaimProofInput = z.infer<typeof issueOrderClaimProofInputSchema>;
export type ConsumeOrderClaimProofInput = z.infer<typeof consumeOrderClaimProofInputSchema>;
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeInputSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeInputSchema>;
export type ResolveIdentityCollisionInput = z.infer<typeof resolveIdentityCollisionInputSchema>;
export type DeepLinkArea = z.infer<typeof deepLinkAreaSchema>;
export type ScopedDeepLinkRequest = z.infer<typeof scopedDeepLinkRequestSchema>;

