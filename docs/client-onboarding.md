# New client project onboarding

1. Create a client record and choose the isolation tier: dedicated database/deployment or shared platform with tenant isolation.
2. Create a separate client configuration file (never branch business logic just to change branding).
3. Configure brand tokens, locale, timezone, currency, domain, enabled modules and integrations.
4. Provision client-specific database roles, secrets, storage buckets/paths, email sender identity and payment credentials.
5. Deploy the shared app/template at a separate deployment target when required.
6. Run onboarding checks: domain and TLS, email delivery, payment sandbox, backups, monitoring, RBAC, data export and restore.
7. Record the client's package versions and approved custom extensions.

Use `templates/client.config.example.json` as a non-secret configuration template. Store credentials only in environment-specific secret stores.
