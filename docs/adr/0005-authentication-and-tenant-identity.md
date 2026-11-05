# ADR 0005: Better Auth for authentication and organization identity

- **Status:** Accepted as the architecture direction; implementation pending.
- **Date:** 2026-11-05
- **Decision owners:** Bazion Web platform maintainers

## Context

Bazion Web needs reusable authentication and tenant membership for independent client websites and applications. The platform is TypeScript-based (Next.js, Fastify, Drizzle and PostgreSQL) and the governing requirement is to prefer free, current, open-source software that Bazion can operate itself. A paid hosted identity service must not be a required dependency.

The current repository has only auth interfaces and a static development tenant resolver. It does not yet have production authentication or authorization.

## Decision

Adopt **Better Auth** as the initial self-hosted TypeScript authentication library, using:

- Its core session/account functionality.
- The official Organization plugin for organization, member and invitation lifecycle.
- Its custom access-control definitions for organization-scoped roles and permissions.
- The official Drizzle adapter backed by PostgreSQL in a dedicated `auth` schema.
- The official Fastify integration mounted within the existing API.

Keep Bazion-specific tenant configuration and business authorization in Bazion's own packages. Add an explicit mapping between Better Auth's organization ID (text) and Bazion's internal tenant UUID. Do not make a Better Auth active-organization value alone sufficient proof of membership.

## Open-source and currency check

As checked on 2026-11-05:

- The Better Auth GitHub repository declares the MIT license.
- npm reports Better Auth 1.7.17 as the current stable package version.
- Better Auth's 2026-11-03 security release reports 12 security advisories fixed in v1.7.16; v1.7.17 is the later patch release in that stable line.
- Official documentation covers the Organization plugin, custom access control, Fastify integration, and the Drizzle adapter including a PostgreSQL custom schema.

Implementation must re-check the current stable release, licences and security advisories, then pin compatible Better Auth packages and commit the lockfile. Do not use the beta line for production by default.

## Alternatives considered

| Option | Licence / operating model | Assessment |
|---|---|---|
| Better Auth | MIT; embed in the existing TypeScript API | **Selected.** Native fit; organization membership and access-control features; no separate identity server to operate |
| Keycloak | Apache 2.0; self-hosted identity server | Strong open-source IAM and standards support, but adds a separate Java service, database, upgrades and operational burden. Reconsider if Bazion needs centralized SSO/IdP across many unrelated systems |
| Auth.js | Open source; library in application | Viable for sessions and provider sign-in, but Bazion would need to build/maintain more of the organization, invitation and tenant RBAC layer itself |
| Hosted proprietary identity SaaS | Free tiers may exist, with limits and vendor terms | Not a required dependency under Bazion's ownership-first and open-source preference |

## Security consequences and constraints

1. Better Auth authenticates users; it does not by itself complete Bazion's tenant-isolation design.
2. Organization membership must be checked server-side on every protected tenant request. Tenant selection from the browser is only a requested context.
3. The API must enforce resource/action permissions; do not trust client-side role checks.
4. Public storefront tenant resolution uses an activated, verified custom-domain mapping. Dashboard access additionally requires a valid user session and active organization membership.
5. The Better Auth `auth` schema and business application schema use separate PostgreSQL runtime roles. The application role cannot read session, account or verification secrets.
6. Business tables remain protected by tenant-scoped queries, tenant-aware foreign keys and transaction-local PostgreSQL RLS.
7. Platform staff permissions remain separate from tenant roles. Any support access to client data must be explicit and audited.
8. Better Auth configuration, schema generation and migrations must be reviewed when changing plugins or versions.

## Cost implications

Better Auth has no licence fee. Bazion owns the deployment and data. Infrastructure, email delivery, backups, monitoring and production support can still incur costs; free tiers may be used for development and suitable early workloads, but they do not remove reliability or retention limits.

## Implementation consequences

The next implementation branch should:
- Add Better Auth and the matching Drizzle adapter.
- Generate and review its schema from the configured plugin set.
- Add Fastify handlers and a Next.js auth client.
- Add trusted tenant resolution and the organisation-to-tenant mapping.
- Add RBAC checks and audit events.
- Separate auth/app runtime database roles.
- Add integration tests proving cross-tenant access is denied.

Do not build the client administration dashboard's privileged operations before these controls are in place.

## References

- [Better Auth repository (MIT licence)](https://github.com/better-auth/better-auth)
- [Better Auth npm package](https://www.npmjs.com/package/better-auth)
- [Better Auth changelog](https://better-auth.com/changelog)
- [Better Auth 2026-11-03 security release](https://better-auth.com/blog/security-release-2026-11-03)
- [Organization plugin](https://better-auth.com/docs/plugins/organization)
- [Fastify integration](https://better-auth.com/docs/integrations/fastify)
- [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Keycloak project](https://github.com/keycloak/keycloak)
- [Auth.js project](https://github.com/nextauthjs/next-auth)
