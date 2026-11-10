# ADR 0012: Tenant and product installation boundary

- Status: accepted
- Date: 10 November 2026
- Scope: customer identity, product configuration and future provisioning state

## Context

The current system treats a tenant/workspace as the customer boundary. Tenant identity, memberships, module overrides, platform settings, domains and business records are all keyed to the tenant. This works for one tenant website/product, but product composition and configuration are becoming explicit and a customer may eventually operate multiple products or sites.

Adding an installation table now would not by itself create a usable product lifecycle. Current domain resolution maps a host to a tenant, tenant settings are singular, and business records use `tenant_id` rather than an installation key.

## Decision

- A tenant remains the customer account, membership/identity scope, billing/support boundary and PostgreSQL data-isolation boundary.
- A tenant may own zero or more product installations. Each installation represents one product composition with its own selected template, validated configuration and lifecycle. Product definitions and releases remain Bazion-owned and immutable; installation configuration remains customer-owned.
- An installation is not a security boundary. Business records remain shared within the tenant unless a domain explicitly adds installation-level ownership and authorization. Creating an installation must not imply a separate database or prevent sibling installations from accessing tenant-scoped data.
- Tenant-level entitlements remain the platform/plan ceiling. A product's declared composition narrows that ceiling; an installation cannot enable a module that the tenant is not entitled to use. Installation-specific feature overrides are deferred until a real product workflow requires them.
- Domain routing must resolve a verified host to the intended installation once a tenant can own multiple independently branded products. The existing host-to-tenant path remains correct for the current one-site tenant model.
- Do not create installation/configuration-history tables until the first provisioning workflow needs them. Before that migration, define idempotency, unique active-install rules, RLS/grants, domain mapping, export/offboarding and compatibility behavior.
- Existing tenants continue to operate as their current implicit single installation during the transition; no eager data migration or tenant split is authorized by this ADR.

## Consequences

- Product configuration, template selection, custom-domain routing and installation history can evolve without replacing tenant identity or memberships.
- Two installations in one tenant share tenant-owned data by default. Customers requiring hard data isolation must use separate tenants or a later explicitly isolated deployment mode.
- The current host/domain and singular settings model must be expanded before exposing multiple independently configured public sites under one tenant.
- Database work remains deferred until provisioning requirements and cardinality are exercised by an end-to-end managed product workflow.
