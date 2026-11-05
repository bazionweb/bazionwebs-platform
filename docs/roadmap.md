# Bazion platform roadmap

## Phase 0 — foundations (this starter)

Monorepo, platform contracts, config, Fastify API, Postgres schema/RLS, UI starter, provider ports, CI and docs.

## Phase 1 — commerce MVP hardening

Two-tenant isolation tests, API integration tests, payment state machine, stock reservation expiry/reconciliation, payment webhook inbox, M-Pesa Daraja sandbox adapter, Stripe hosted checkout adapter, tax/shipping/discount ports, order notifications and admin order screens.

## Phase 2 — shared client blocks

Authentication/authorization with self-hosted Better Auth (MIT), trusted tenant/domain resolution and server-side RBAC, customer/user management, file uploads, notifications, booking/reservations, audit log, analytics and admin shell.

## Phase 3 — templates and client delivery

Corporate website, ecommerce, school/church management and booking templates; client configuration; automated deployment; custom domains; environment provisioning; per-client backup/monitoring.

## Phase 4 — AI/MCP and internal developer platform

MCP servers exposing permission-checked operations, internal CLI/scaffolding, package release automation, usage metering and client module catalog.

## Release rule

Do not market a module as production-ready until it has integration tests, security review, monitoring, backup/recovery, operational documentation and a supported upgrade path.
