# Bazionweb client deployment templates

These Compose files are portable deployment blueprints for Dokploy-managed client workloads. They are infrastructure examples, not product source code or production-ready promises by themselves.

## Deployment rules

- Keep one Dokploy project per client and a separate Compose service per independently deployed application.
- Use unique project/service names, database names, credentials, and named volumes for every client.
- Do not publish database ports. Route only the application service through Dokploy/Traefik HTTPS.
- Store secrets in the Dokploy environment editor. Never commit real `.env` files, passwords, API keys, or customer data.
- Keep each client deployment on its own Compose network. Do not attach client services to monitoring or platform networks.
- Pin production images to a tested version tag or digest. Do not blindly deploy `latest`.
- Set resource limits according to the VPS capacity and client plan. Do not overcommit memory.
- Back up databases with native logical dumps and persistent files/volumes with Restic. Test restores before production onboarding.
- Record the image versions, domain, volume names, backup policy, RPO/RTO, and restore procedure in the client runbook.

## Templates

- [WordPress + MariaDB](wordpress/README.md) — first managed website template.
- Node.js/Next.js — planned.
- E-commerce — planned.

## Dokploy workflow

1. Create a dedicated project for the client.
2. Add a Compose service and import the relevant Compose file.
3. Add the environment variables from the template's `.env.example` in Dokploy (replace all placeholders).
4. Deploy without publishing container ports.
5. In the WordPress/app service's Domains settings, route the client's hostname to the internal application port and enable HTTPS.
6. Verify health, TLS, persistence, isolation, and restore readiness before handing over access.
