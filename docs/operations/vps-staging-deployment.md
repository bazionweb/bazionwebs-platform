# VPS staging deployment

This guide prepares the Platform monorepo for staging on the single-node Dokploy VPS. It does not move the live Bazionweb site from Render or enable production customer intake.

## Image targets

Build from the repository root so the Docker build includes the pnpm workspace and its local packages:

```bash
docker build --target api -t bazion-platform-api:staging .
docker build --target admin -t bazion-platform-admin:staging \
  --build-arg API_BASE_URL=http://api:4000 \
  --build-arg PUBLIC_STOREFRONT_URL=https://staging.bazionweb.com .
docker build --target storefront -t bazion-platform-storefront:staging \
  --build-arg API_BASE_URL=http://api:4000 .
docker build --target migrate -t bazion-platform-migrate:staging .
```

The API target deploys production workspace dependencies only and runs as the unprivileged `node` user. The admin and storefront targets use Next.js standalone output. The migration target is an operator-run, one-shot image; provide `MIGRATION_DATABASE_URL` through Dokploy's protected runtime environment and run it before starting or updating the API. Never bake database URLs or application secrets into image build arguments.

## Build and delivery performance

The main-branch CI workflow publishes the four runtime targets to GitHub Container Registry only after the full validation job passes. Images receive an immutable `sha-<commit>` tag and the default branch also updates a `staging` tag. The packages are `ghcr.io/bazionweb/bazionwebs-platform-api`, `...-admin`, `...-storefront`, and `...-migrate`. The workflow builds for `linux/amd64`, limits parallel image builds, uses a separate BuildKit cache per image, and includes provenance and an SBOM. This moves CPU and memory intensive image compilation to GitHub-hosted runners instead of Dokploy's 3-core VPS. The workflow does not deploy or change live services. Before pulling on the VPS, verify `uname -m` reports `x86_64`; for an ARM host, adjust the workflow architecture first.

For a release, configure Dokploy to pull the `sha-<commit>` image tag so the API, admin, storefront, and migration image all correspond to the same validated commit. Use the `staging` tag only when deliberately testing the latest successful main build. GHCR packages are private by default; configure a read-only package pull credential in Dokploy's registry settings. CI publishing uses the repository-scoped `GITHUB_TOKEN` and does not require a long-lived registry token.

The Dockerfile copies workspace manifests and the lockfile before application source, so ordinary source edits reuse the dependency installation layer. A BuildKit cache mount retains pnpm downloads. Runtime Next.js images use standalone output, and app containers run as the unprivileged `node` user. Google fonts are fetched during the build and served from the app, avoiding a third-party font request in each visitor's browser. Build telemetry is disabled.

The storefront's server-side public tenant metadata fetch is revalidated every 30 seconds. The resolved host and tenant selector are forwarded in the fetch request, and are included in Next.js's fetch-cache key to keep cached public data separated by tenant. This allows repeated metadata reads to reuse recent results; edits to that server-rendered metadata may take up to 30 seconds to appear. Authenticated and tenant-private data should remain uncached unless it receives an explicit tenant-aware cache design.

## Measured state and next performance work

On the development Docker host, the local image listing reported approximately 957 MB for the API, 405 MB for admin, and 408 MB for storefront. Docker's displayed image size is a virtual, uncompressed size; it is not the registry transfer size or the container's RAM use, and the images share their Node base layers. These figures are a baseline, not performance claims. The API image still contains large optional auth peer dependencies; do not remove them until API runtime tests prove the smaller artifact supports every enabled auth path.

The repository audit found public media rendered with native `<img>` elements across church pages, shared UI cards, gallery, events, sermons, and the shop. Some are lazy-loaded, but the app does not yet generate responsive modern-format variants. The CMS accepts tenant-managed image URLs, so adding a restrictive `next/image` remote-host allowlist would break legitimate tenants and an unrestricted allowlist would weaken the boundary. The next media optimization should add an explicit tenant-safe image delivery path: preserve original uploads in a dedicated media bucket, generate/cache AVIF or WebP width variants through Cloudflare Images transformations or an equivalent media service, and render using correct `srcset`/`sizes`, intrinsic dimensions, lazy loading below the fold, and eager priority only for the actual LCP image. Do not put public media in the private `bazionweb-backups` bucket.

After staging is reachable, measure representative mobile and desktop pages with Lighthouse and field Web Vitals. Use the 75th percentile as the target: LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1. Analyze client bundles before adding dependencies. Cloudflare should cache immutable `/_next/static/*` assets and optimized public media, while bypassing cache for login, account, cart, checkout, `/api`, `/v1`, and any tenant-personalized response. Do not apply a broad “cache everything” rule to tenant HTML.

The public storefront is tenant-host-driven and dynamically rendered. Keep that design until measurements justify a safer tenant-keyed static/partial rendering strategy; static generation without an explicit tenant hostname key could serve one church's content to another. The Next.js production checklist recommends checking dynamic rendering and data-cache choices intentionally, using the Image component for layout stability and modern formats, and measuring with Lighthouse plus field Core Web Vitals. Cloudflare documents responsive image transformations and warns against caching authenticated or personalized HTML.

References: [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist), [Next.js fetch API](https://nextjs.org/docs/app/api-reference/functions/fetch), [Docker cache optimization](https://docs.docker.com/build/cache/optimize/), [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), [Cloudflare image transformations](https://developers.cloudflare.com/images/optimization/transformations/overview/), [Cloudflare responsive images](https://developers.cloudflare.com/images/optimization/make-responsive-images/), [Cloudflare cache guidance for login and dynamic content](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/), [Core Web Vitals thresholds](https://web.dev/articles/vitals).

## Dokploy service wiring

Create an isolated staging project/environment. The API, admin, storefront and staging database must communicate over private service networking. Do not publish PostgreSQL or the Dokploy management port on the public interface. Route the storefront to `https://staging.bazionweb.com` and the platform admin to `https://platform-staging.bazionweb.com` through Traefik-managed HTTPS.

The Next.js API rewrites are set at image build time. Set `API_BASE_URL` to an internal service address reachable from both Next.js containers (the examples use `http://api:4000`). Keep the API off the public network unless an explicitly reviewed integration requires a public callback endpoint.

Use staging-only Better Auth secrets, trusted origins, callback URLs, SMTP credentials, and database roles. Generate fresh values in the deployment secret store. Keep `COMMERCIAL_PROVISIONING_PILOT_MODE=staging_pilot`, `COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED=false`, and `NODE_ENV=production` for the isolated staging service. Do not enable canary or production offer intake from this guide.

The first staging offer remains `website-launch@1.0.0` with shared-managed delivery. Use a newly created, empty staging tenant. Do not copy production church member data into it.

## Database backups

The existing VPS Restic timer uploads selected system and Dokploy configuration plus monitoring data to the private R2 bucket. It currently does not create PostgreSQL dumps. Before staging databases contain useful data, add consistent per-database `pg_dump` artifacts to the Restic staging directory and confirm that the resulting backup is visible in R2. Restore each dump into an isolated recovery database and run the Platform database preflight before treating it as a verified recovery path. Keep the R2 repository password and access keys only in the root-owned secret configuration on the VPS.

## Current release limits

- Bazionweb production remains on Render until staging acceptance and a rollback rehearsal are complete.
- Production offer bindings remain closed while the church-ministry product release is partial.
- The Dokploy API adapter does not create projects/environments, provision databases, configure DNS/TLS, or orchestrate rollback. Those tasks remain operator-controlled.
- This repo's Docker targets cover Platform API/admin/storefront only. Bazionweb needs its own container build and staging database configuration in the Bazionweb repository before both systems can move together.
