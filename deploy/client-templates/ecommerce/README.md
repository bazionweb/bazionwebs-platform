# E-commerce application + PostgreSQL

This profile provides an application container and a private PostgreSQL database with a persistent named volume. It is a deployment starting point, not a complete commerce product or a declaration that payment, tax, shipping, or regulatory features are production-ready.

## Application image contract

The application image must:

- Be built and tested in CI and published to a trusted OCI registry.
- Listen on `0.0.0.0:3000` and include Node.js for the container healthcheck.
- Run in production mode as a non-root user, handle SIGTERM, and contain its runtime dependencies/assets.
- Support the database environment contract below, or have its Compose environment adapted to the application's actual configuration.
- Run migrations through a controlled release/deployment step; do not automatically run destructive migrations on every container start.
- Store no irreplaceable media or order data in its writable container layer.

The supplied environment contract is `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Adapt these names if the selected application expects a connection URL or another configuration format. Never commit actual secrets.

## Deploy in Dokploy

1. Create a dedicated Dokploy project for this client.
2. Add this Compose file as the project's Compose service.
3. Set `APP_IMAGE`, `POSTGRES_IMAGE`, `POSTGRES_DB`, `POSTGRES_USER`, and a unique strong `POSTGRES_PASSWORD` in Dokploy.
4. Add application-specific environment variables and payment/storage credentials in Dokploy. Keep secrets server-side and never expose them through `NEXT_PUBLIC_*`.
5. Deploy. Configure the client hostname to route to service `app` on internal port `3000`, with HTTPS enabled.
6. Confirm database migrations, storefront, admin access, checkout, order persistence, health, logs, TLS, and rollback before launch.

## Database and media

- PostgreSQL is internal-only; no database port is published to the host.
- The named `db_data` volume persists PostgreSQL data across container replacement. It is not a backup.
- Back up PostgreSQL with scheduled, database-aware logical backups (for example, `pg_dump`) to encrypted off-site storage. Test restoration into a separate database before onboarding customers.
- Use S3-compatible object storage (for example, Cloudflare R2) for product images, uploads, and other media. Configure bucket credentials and lifecycle/retention in the storage provider; do not rely on container-local uploads.
- If local media storage is unavoidable, define a dedicated named volume and include it in the backup and restore runbook.
- Document RPO, RTO, backup frequency, retention, restore owner, and last restore-test date for each store.

## Commerce and payment launch gates

Infrastructure does not make an application commerce-ready. Before accepting real orders or payments, verify:

- Product price, stock, discounts, totals, and order state are validated server-side.
- Payment initiation and confirmation are verified server-side; webhook signatures, idempotency, retries, and reconciliation are implemented.
- An order is not marked paid merely because the browser reports success or a customer returns from a payment page.
- M-PESA and card methods are enabled only after the relevant provider's production credentials, callback URLs, settlement, refunds, and reconciliation have been tested.
- Tax, shipping/delivery, customer communications, privacy, and applicable Kenyan/East African business requirements are addressed for the actual launch market.

Do not assume a provider integration, payment method, tax engine, or shipping workflow exists just because this Compose profile deploys successfully.

## Isolation and resource controls

- Use one Dokploy project and separate credentials/volumes per client.
- Do not publish PostgreSQL ports or attach the stack to shared monitoring/platform networks without a documented need.
- Starting limits are 1 GiB / 1 CPU for the app and 1 GiB / 0.75 CPU for PostgreSQL. Measure real workload and ensure aggregate limits leave headroom for the VPS, Dokploy, Traefik, and monitoring.
- PostgreSQL image versions must be tested against application migrations and extensions. Pin a tested tag or digest; plan major-version upgrades separately.
- Keep the previous application image available for rollback. Database schema rollback needs its own tested migration strategy.
