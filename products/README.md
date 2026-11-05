# Bazion product catalogue

This directory is the commercial-to-engineering map for the capabilities advertised by Bazion Web.

## Source-of-truth files

- `catalog.json`: 111 advertised capabilities mapped to 36 reusable domain/platform modules.
- `commercial-offerings.json`: 35 website/ecommerce/custom-system/hosting/care packages, add-ons and rate-card items mapped to those modules.
- `module-manifest.schema.json`: required structure for a reusable module manifest.
- `solution-manifest.schema.json`: required structure for a client solution pack.
- `../solutions/*/manifest.json`: nine initial vertical solution compositions.

## Important distinction

The 111 catalogue entries are capabilities, adapters, commercial capabilities and solution-pack labels. They are **not** an instruction to create 111 pnpm packages.

Build a module once when it represents a cohesive domain boundary. Multiple advertised products can compose the same modules with different templates, configuration, feature entitlements, hosting plans, support levels and service scope.

For example:

- Launch, Business, Professional and Enterprise websites are service bundles over the same website engine.
- Ecommerce Starter, Business and Enterprise are commerce entitlements and implementation scopes over the same commerce engine.
- Host Essential, Business, Professional and Cloud are infrastructure/resource plans, not four different hosting codebases.
- Care tiers are operational support/SLA bundles, not separate maintenance applications.
- M-Pesa, Paystack, Stripe, PayPal, Mailchimp, Brevo, QuickBooks, Xero and courier providers are adapters behind Bazion-owned interfaces.
- Additional pages, copywriting, discovery, revisions and hourly support are commercial services/rate-card items, not runtime modules.

## Status rules

The module status in `catalog.json` is an inventory starting point:

- `implemented`: code already exists in main for that boundary; it does not mean every advertised capability is complete.
- `partial`: an interface or foundation exists, but the full product is not production-complete.
- `planned`: no usable implementation exists yet.

Do not mark a module stable because a folder or empty package exists. Update the status only after code, tests, tenant security, permissions, operations and documentation pass the definition of done in the module manifest.

## Package policy

The `sourcePath` field is the intended owner path. Existing package paths are retained. Planned packages are created only when their first vertical slice is ready to implement. Keep the pnpm workspace small and meaningful.

Every module must define its tenant ownership, permissions, tables/RLS, events/jobs, provider adapters, dependencies, feature entitlements, observability, retention, recovery and upgrade path.

## Commercial pricing

Price amounts and currency-specific price books remain in the commercial website's canonical price-book source. This repository records offer IDs and their module composition, not copied price values. That avoids drift between the public website and the platform implementation.

## Adding a capability

1. Check whether an existing module already owns the domain.
2. Add or update the capability mapping in `catalog.json`.
3. Create/update the module manifest following `module-manifest.schema.json`.
4. Request a migration owner before adding tenant-owned tables.
5. Implement domain rules first, then persistence/API/UI/worker adapters.
6. Test permissions and cross-tenant isolation.
7. Update the relevant solution manifests and commercial offer compositions.
8. Mark the capability complete only after the pull request is merged and the release checks pass.
