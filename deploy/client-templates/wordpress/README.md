# WordPress + MariaDB

A single-client WordPress deployment for Dokploy. Each client gets its own Compose project, MariaDB database, WordPress content volume, credentials, and private Compose network.

## Configure in Dokploy

Add all variables from `.env.example` to the Compose service's environment editor. Generate unique passwords for every client. `MARIADB_PASSWORD` and the WordPress database password are deliberately sourced from the same variable.

Before production, replace the example image tags with tested, pinned versions or digests. Review the release notes and test upgrades on a staging copy first.

## Deploy

1. Create a new Dokploy project named for the client.
2. Add a Compose service and import `compose.yaml`.
3. Add the environment variables in Dokploy; do not upload a real `.env` file to Git.
4. Deploy. The database has no published host port.
5. In the Dokploy Domains settings for the `wordpress` service, add the client's hostname, target container port `80`, and enable HTTPS.
6. Complete WordPress installation and verify that the browser stays on HTTPS.
7. Confirm that a test media upload survives a container redeploy.

## Persistent data

- `db_data`: MariaDB database files. Back up with a MariaDB logical dump; do not copy the live database directory as the only backup.
- `wordpress_content`: plugins, themes, and uploads. Back up the volume with Restic.

The database and content volume must be included in the client's backup policy. Run a restore test before production handover.

## Resource profile

Initial Compose limits: WordPress 1 CPU / 768 MiB RAM; MariaDB 0.75 CPU / 1 GiB RAM. These are starting ceilings, not performance guarantees. Adjust based on observed usage and VPS headroom.

## Security notes

- No host ports are published.
- The database is reachable only by the WordPress service on its private Compose network.
- Each client must have unique database credentials and named volumes.
- Disable WordPress theme/plugin file editing in wp-admin via `DISALLOW_FILE_EDIT`.
- Keep WordPress core, plugins, themes, and MariaDB patched; test updates before applying to client production.
