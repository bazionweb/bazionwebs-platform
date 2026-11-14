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

The Dockerfile copies workspace manifests and the lockfile before application source, so ordinary source edits reuse the dependency installation layer. A BuildKit cache mount retains pnpm downloads. Runtime Next.js images use standalone output, and app containers run as the unprivileged `node` user. Typography uses local system font stacks; builds and page views do not contact Google Fonts or ship font binaries. Build telemetry is disabled.

The storefront's server-side public tenant metadata fetch is revalidated every 30 seconds. The resolved host and tenant selector are forwarded in the fetch request, and are included in Next.js's fetch-cache key to keep cached public data separated by tenant. This allows repeated metadata reads to reuse recent results; edits to that server-rendered metadata may take up to 30 seconds to appear. Authenticated and tenant-private data should remain uncached unless it receives an explicit tenant-aware cache design.

## Measured state and next performance work

On the development Docker host, the local image listing reported approximately 957 MB for the API, 405 MB for admin, and 408 MB for storefront. Docker's displayed image size is a virtual, uncompressed size; it is not the registry transfer size or the container's RAM use, and the images share their Node base layers. These figures are a baseline, not performance claims. The API image still contains large optional auth peer dependencies; do not remove them until API runtime tests prove the smaller artifact supports every enabled auth path.

The API normalizes newly uploaded tenant media into a single WebP source (quality 84, maximum edge 2560px, maximum input 40 megapixels) only when the result is smaller. If conversion would increase storage, the original is retained regardless of its dimensions; Cloudflare still resizes it for delivery. Animated WebP/AVIF images are preserved without resizing. Metadata is removed from images that are re-encoded. Upload processing is limited to two images at once, uses one libvips thread per image, and queues only eight additional jobs to protect the API container; uploads are also rate-limited. Original source bytes are not retained when a smaller WebP is stored. This normalizer handles files uploaded through the tenant media API; URLs pasted from external hosts, legacy R2 objects, and repository static images remain outside this upload path.

The shared `ResponsiveImage` component can emit Cloudflare width variants (`srcset`/`sizes`, `format=auto`, `quality=80`) for public uploads on the exact configured media origin and path. Cloudflare generates each requested width and browser format on the first edge request, then caches it; these delivery variants are not written back to R2. `format=auto` lets Cloudflare negotiate AVIF/WebP support and falls back for older browsers. It does not fetch or transform arbitrary external URLs, signed URLs, local development media, or paths outside that public base. Transformations are opt-in with `MEDIA_IMAGE_TRANSFORMS_ENABLED=true`; leave that flag false until the media domain is proxied through the configured Cloudflare zone and verified. Images remain regular HTML `<img>` elements, so there is no Next image proxy request or extra runtime dependency; below-fold images are lazy and hero images are eager. Layouts with fixed media containers keep their dimensions stable. The storefront runtime (including its ministry admin pages) needs the non-secret `MEDIA_STORAGE_PUBLIC_BASE_URL` and explicit transform flag.

For production, keep public ministry uploads in a dedicated media bucket with a Cloudflare-proxied custom domain, separate from the private `bazionweb-backups` bucket. In Cloudflare, enable Images > Transformations on that media domain's zone and restrict allowed source origins to the exact media domain. Keep the R2 bucket credentials only in the API secret store. Verify that one image request returns the expected AVIF/WebP format and that each `srcset` URL serves the expected width before setting `MEDIA_IMAGE_TRANSFORMS_ENABLED=true`. If the media zone is not configured, leave the flag false so images load directly. Existing R2 objects are not rewritten by the new-upload normalizer and require a separately backed-up, report-only-first migration before any in-place conversion.

Staging Lighthouse and field Web Vitals are still an operational measurement gate because staging is not reachable from this worktree. Once deployed, test at least the home page, event listing, gallery, sermon listing, shop listing, and a product page on mobile and desktop. Use the 75th percentile targets: LCP ≤ 2.5 seconds, INP ≤ 200 ms, and CLS ≤ 0.1. In Chrome DevTools, run Lighthouse in mobile and desktop modes and retain the JSON/HTML reports with the release evidence. For field data, connect a real-user monitoring source (or the Cloudflare Web Analytics/Core Web Vitals integration) and wait for representative traffic; Lighthouse is lab data and cannot stand in for field INP. Analyze client bundles before adding dependencies. Cloudflare should cache immutable `/_next/static/*` assets and optimized public media, while bypassing cache for login, account, cart, checkout, `/api`, `/v1`, and any tenant-personalized response. Do not apply a broad “cache everything” rule to tenant HTML.

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
