# Node.js / Next.js application

A portable Compose runtime for one client-owned Node.js application or Next.js production build. The image is built and tested by the client's CI pipeline (or Bazionweb's build pipeline) and published to a trusted OCI registry. This template deliberately does not build source code on the production VPS.

## Image contract

The container image must:

- Run a production build, not a development server.
- Listen on `0.0.0.0:3000`.
- Include Node.js and support the healthcheck command below.
- Run as a non-root user.
- Handle SIGTERM gracefully.
- Include all runtime dependencies and static assets (for Next.js, use a tested standalone output image or equivalent).
- Store no irreplaceable user uploads in the container filesystem.

Use a pinned release tag or preferably an immutable image digest. Do not deploy `latest`.

## Configure in Dokploy

1. Create a separate Dokploy project for the client.
2. Add this Compose file as a Compose service.
3. Set `APP_IMAGE` in the Dokploy environment editor to the published image.
4. Add application-specific variables in Dokploy. Secrets must remain server-side and must never use a `NEXT_PUBLIC_` prefix.
5. Deploy and configure the client's hostname to target the `app` service on port `3000`, with HTTPS enabled.
6. Verify the healthcheck, logs, TLS, application flows, and rollback to the previous image.

## Persistence and data

This template intentionally defines no persistent volume. Treat the container as replaceable:

- Use PostgreSQL or another appropriate database service/provider for durable application data.
- Use S3-compatible object storage (such as R2) for uploads and media; keep credentials server-side.
- If a client has a justified local persistent-data requirement, add a dedicated named volume and a documented backup/restore procedure before launch.
- Back up databases using native logical/database-aware backups, not by copying a live database data directory.
- Record and test the client's RPO/RTO and restore process.

## Security and resource controls

- No host ports are published; Dokploy/Traefik routes HTTPS traffic internally.
- The app has a 1 CPU / 1 GiB memory ceiling and a PID limit of 128 as starting values. Tune against measured workload and available VPS headroom.
- Linux capabilities are dropped and privilege escalation is disabled.
- The image must run as non-root; Compose cannot compensate for an image that runs as root.
- Do not attach client applications to shared platform or monitoring networks unless a documented integration requires it.
- Use a separate database, credentials, and object-storage bucket or prefix per client according to the client's isolation tier.
