# Deployment and operations strategy

## Start low-cost, retain portability

- **Local development:** Docker Compose with PostgreSQL 18 and separate admin, migration and app roles.
- **Source/CI:** private GitHub repository. GitHub Free currently includes 2,000 GitHub Actions minutes/month for personal Free accounts, subject to account type and usage rules; monitor actual consumption and configure budgets. Public-repository standard runners have different terms.
- **Static sites:** Cloudflare Pages is a good candidate for genuinely static exports and asset-heavy sites.
- **Full-stack Next.js:** choose a runtime that supports the app's server features. Cloudflare now recommends vinext for new Next.js-on-Workers work, but its documentation still labels vinext beta; the existing OpenNext path is documented as a maintenance/migration path. Do compatibility testing before adopting either for a client production workload. A conventional Node hosting target remains the portable default for this starter.
- **Node API:** a managed Node/container target with outbound PostgreSQL connectivity and support for scheduled/background jobs. Avoid PHP-only shared hosting for this API.
- **Database:** managed PostgreSQL with backups and a region chosen for latency and data requirements. A free tier is acceptable for learning, demos and temporary previews, not a production availability promise.
- **Object files:** S3-compatible object storage or Cloudflare R2 behind the `storage` port.
- **Email/SMS:** provider adapters behind `notifications`.

## Verified free-tier caveats (5 November 2026)

- Cloudflare Workers Free lists 100,000 requests/day and 10 ms CPU time per invocation. The Next.js guide recommends vinext, which is beta; test framework compatibility and execution limits before deciding to host a real commerce checkout there.
- Supabase Free lists two active projects, a 500 MB database per project, 5 GB egress, and pauses projects after a week of low activity. It is suitable for prototypes, but pause behavior and resource limits make it a poor default for client stores that must respond reliably at any hour.
- Render offers free web services for preview but spins them down after 15 minutes without traffic; the first subsequent request can wait for a spin-up. Its free Postgres database expires 30 days after creation. Do not use those free services/databases for production client commerce.
- Railway's Free plan currently provides $1/month of resource credit after the initial trial; this is useful for experimentation, not a promise of free always-on production hosting.
- GitHub Actions allowance depends on the account plan/repository type. Budget and monitor private-repository CI usage rather than assuming unlimited builds.

These are provider-specific plan details and can change. Verify the plan page before committing to an architecture or giving a client a hosting quote.

## Production environment separation

Use distinct development, staging and production projects, databases, credentials and callback URLs. Never copy production secrets to local `.env` or CI logs. Prefer separate databases and payment credentials for higher-risk clients. If multiple tenants share a database, apply tenant predicates, tenant-aware foreign keys and RLS, and test cross-tenant denial.

## CI/CD baseline

Recommended mature pull-request gates: install from the committed lockfile, typecheck, lint, unit tests, build, dependency audit and migration/RLS integration tests. The current starter CI runs typecheck, available unit tests and build; lint, dependency audit and live PostgreSQL migration/RLS tests remain to be added once the first dependency install and database-backed CI service are available. Protect `main`; require review and green CI; deploy staging from main; approve production deployments. The starter CI uses a bootstrap install only because a lockfile has not yet been generated in the offline build environment. Commit `pnpm-lock.yaml` and switch to frozen installs immediately after the first successful package install.

## Backups and recovery

Automate encrypted backups, retain according to contract, periodically restore into an isolated environment, and document RPO/RTO for each client. A backup that has never been restored is not a verified recovery plan.
