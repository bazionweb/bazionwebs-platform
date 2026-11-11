import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { productInstallations } from "./product-installations.js";

export const federatedIdentityLinks = pgTable("federated_identity_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  issuer: varchar("issuer", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  emailAtLink: varchar("email_at_link", { length: 254 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  linkedVia: varchar("linked_via", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("federated_identity_links_issuer_subject_uq").on(table.issuer, table.subject),
  index("federated_identity_links_user_idx").on(table.userId),
  check("federated_identity_links_status_ck", sql`${table.status} in ('active', 'revoked', 'conflicted')`),
  check("federated_identity_links_via_ck", sql`${table.linkedVia} in ('oidc_login', 'owner_claim', 'admin_link', 'migration_backfill')`),
]);

export const identityLinkCollisions = pgTable("identity_link_collisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  collisionType: varchar("collision_type", { length: 32 }).notNull(),
  issuer: varchar("issuer", { length: 255 }),
  subject: varchar("subject", { length: 255 }),
  existingUserId: varchar("existing_user_id", { length: 128 }),
  conflictingUserId: varchar("conflicting_user_id", { length: 128 }),
  externalReference: varchar("external_reference", { length: 128 }),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  resolutionNote: varchar("resolution_note", { length: 500 }),
  resolvedBy: varchar("resolved_by", { length: 128 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("identity_link_collisions_status_created_idx").on(table.status, table.createdAt),
  check("identity_link_collisions_status_ck", sql`${table.status} in ('open', 'resolved_linked', 'resolved_rejected')`),
]);

export const oidcClients = pgTable("oidc_clients", {
  clientId: varchar("client_id", { length: 128 }).primaryKey(),
  clientName: varchar("client_name", { length: 160 }).notNull(),
  clientType: varchar("client_type", { length: 24 }).notNull(),
  clientSecretHash: varchar("client_secret_hash", { length: 64 }),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull().default([]),
  postLogoutRedirectUris: jsonb("post_logout_redirect_uris").$type<string[]>().notNull().default([]),
  allowedScopes: jsonb("allowed_scopes").$type<string[]>().notNull().default(["openid", "profile", "email"]),
  requirePkce: boolean("require_pkce").notNull().default(true),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oidcAuthorizationCodes = pgTable("oidc_authorization_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  clientId: varchar("client_id", { length: 128 }).notNull().references(() => oidcClients.clientId, { onDelete: "restrict" }),
  userId: varchar("user_id", { length: 128 }).notNull(),
  redirectUri: varchar("redirect_uri", { length: 1024 }).notNull(),
  scope: varchar("scope", { length: 512 }).notNull(),
  codeChallenge: varchar("code_challenge", { length: 128 }).notNull(),
  codeChallengeMethod: varchar("code_challenge_method", { length: 16 }).notNull(),
  nonce: varchar("nonce", { length: 256 }).notNull(),
  stateHash: varchar("state_hash", { length: 64 }).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  authTime: timestamp("auth_time", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oidcBffAuthTransactions = pgTable("oidc_bff_auth_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  txHash: varchar("tx_hash", { length: 64 }).notNull().unique(),
  clientId: varchar("client_id", { length: 128 }).notNull(),
  stateHash: varchar("state_hash", { length: 64 }).notNull(),
  nonce: varchar("nonce", { length: 256 }).notNull(),
  codeVerifierCiphertext: text("code_verifier_ciphertext").notNull(),
  returnTo: varchar("return_to", { length: 512 }).notNull().default("/workspace"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oidcBffSessions = pgTable("oidc_bff_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionHash: varchar("session_hash", { length: 64 }).notNull().unique(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  issuer: varchar("issuer", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  clientId: varchar("client_id", { length: 128 }).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  scope: varchar("scope", { length: 512 }).notNull(),
  idTokenJti: varchar("id_token_jti", { length: 128 }).notNull(),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commercialOrderClaimProofs = pgTable("commercial_order_claim_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  proofHash: varchar("proof_hash", { length: 64 }).notNull().unique(),
  externalOrderId: varchar("external_order_id", { length: 128 }).notNull(),
  externalCustomerId: varchar("external_customer_id", { length: 128 }).notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  installationId: uuid("installation_id").references(() => productInstallations.id, { onDelete: "set null" }),
  issuedByClient: varchar("issued_by_client", { length: 64 }).notNull().default("bazionweb"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  claimedByUserId: varchar("claimed_by_user_id", { length: 128 }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountEmailChangeRequests = pgTable("account_email_change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  currentEmail: varchar("current_email", { length: 254 }).notNull(),
  newEmail: varchar("new_email", { length: 254 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

