# VPS staging deployment

This guide prepares the Platform monorepo for staging on the single-node Dokploy VPS. It does not move the live Bazionweb site from Render or enable production customer intake.

## Image targets

Build from the repository root so the Docker build includes the pnpm workspace and its local packages:

```bash
docker build --target api -t bazion-platform-api:staging .
docker build --target admin -t bazion-platform-admin:staging \
  --build-arg API_BASE_URL=http://api:4000 \
  --build-arg PUBLIC_STOREFRONT_URL=https://church-staging.bazionweb.com .
docker build --target storefront -t bazion-platform-storefront:staging \
  --build-arg API_BASE_URL=http://api:4000 .
docker build --target migrate -t bazion-platform-migrate:staging .
docker build --target database -t bazion-platform-db:staging .
docker build --target notification-worker -t bazion-platform-notification-worker:staging .
docker build --target platform-bootstrap -t bazion-platform-bootstrap:staging .
```

The API target deploys production workspace dependencies only and runs as the unprivileged `node` user. The admin and storefront targets use Next.js standalone output. Migration and platform-owner bootstrap are one-shot targets; the Compose stack orders them after database readiness and keeps bootstrap disabled unless its operator profile is explicitly enabled. Never bake database URLs or application secrets into image build arguments.

## Build and delivery performance

The main-branch CI workflow publishes seven targets to GitHub Container Registry only after the full validation job passes: API, admin, storefront, migration, database bootstrap, notification worker, and platform-owner bootstrap. Images receive a commit-addressed `sha-<commit>` tag and the default branch also updates a `staging` tag. The package names are `ghcr.io/bazionweb/bazionwebs-platform-api`, `...-admin`, `...-storefront`, `...-migrate`, `...-db`, `...-notification-worker`, and `...-bootstrap`. The workflow builds for `linux/amd64`, limits parallel image builds, uses a separate BuildKit cache per image, and includes provenance and an SBOM. This moves CPU and memory intensive image compilation to GitHub-hosted runners instead of Dokploy's 3-core VPS. The workflow does not deploy or change live services. If GitHub Actions minutes are exhausted, local image builds only validate the targets; they do not publish images to GHCR. Do not deploy until every required image for the selected commit is present in GHCR. Before pulling on the VPS, verify `uname -m` reports `x86_64`; for an ARM host, adjust the workflow architecture first.

For a release, configure Dokploy to pull the same `sha-<commit>` image tag for every service so the API, admin, storefront, workers, database, bootstrap, and migration images correspond to the same validated commit. Use the `staging` tag only when deliberately testing the latest successful main build. GHCR packages are private by default; configure a read-only package pull credential in Dokploy's registry settings. CI publishing uses the repository-scoped `GITHUB_TOKEN` and does not require a long-lived registry token.

The Dockerfile copies workspace manifests and the lockfile before application source, so ordinary source edits reuse the dependency installation layer. A BuildKit cache mount retains pnpm downloads. Runtime Next.js images use standalone output, and app containers run as the unprivileged `node` user. Typography uses local system font stacks; builds and page views do not contact Google Fonts or ship font binaries. Build telemetry is disabled.

The storefront's server-side public tenant metadata fetch is revalidated every 30 seconds. The resolved host and tenant selector are forwarded in the fetch request, and are included in Next.js's fetch-cache key to keep cached public data separated by tenant. This allows repeated metadata reads to reuse recent results; edits to that server-rendered metadata may take up to 30 seconds to appear. Authenticated and tenant-private data should remain uncached unless it receives an explicit tenant-aware cache design.

## Measured state and next performance work

On the development Docker host, the local image listing reported approximately 957 MB for the API, 405 MB for admin, and 408 MB for storefront. Docker's displayed image size is a virtual, uncompressed size; it is not the registry transfer size or the container's RAM use, and the images share their Node base layers. These figures are a baseline, not performance claims. The API image still contains large optional auth peer dependencies; do not remove them until API runtime tests prove the smaller artifact supports every enabled auth path.

The API normalizes newly uploaded tenant media into a single WebP source (quality 84, maximum edge 2560px, maximum input 40 megapixels) only when the result is smaller. If conversion would increase storage, the original is retained regardless of its dimensions; Cloudflare still resizes it for delivery. Animated WebP/AVIF images are preserved without resizing. Metadata is removed from images that are re-encoded. Upload processing is limited to two images at once, uses one libvips thread per image, and queues only eight additional jobs to protect the API container; uploads are also rate-limited. Original source bytes are not retained when a smaller WebP is stored. This normalizer handles files uploaded through the tenant media API; URLs pasted from external hosts, legacy R2 objects, and repository static images remain outside this upload path.

The shared `ResponsiveImage` component can emit Cloudflare width variants (`srcset`/`sizes`, `format=auto`, `quality=80`) for public uploads on the exact configured media origin and path. Cloudflare generates each requested width and browser format on the first edge request, then caches it; these delivery variants are not written back to R2. `format=auto` lets Cloudflare negotiate AVIF/WebP support and falls back for older browsers. It does not fetch or transform arbitrary external URLs, signed URLs, local development media, or paths outside that public base. Transformations are opt-in with `MEDIA_IMAGE_TRANSFORMS_ENABLED=true`; leave that flag false until the media domain is proxied through the configured Cloudflare zone and verified. Images remain regular HTML `<img>` elements, so there is no Next image proxy request or extra runtime dependency; below-fold images are lazy and hero images are eager. Layouts with fixed media containers keep their dimensions stable. The storefront runtime (including its ministry admin pages) needs the non-secret `MEDIA_STORAGE_PUBLIC_BASE_URL` and explicit transform flag.

Bundled storefront assets under `/images/*` can also use responsive Cloudflare delivery, independently of the media-bucket flag. Set `SITE_IMAGE_TRANSFORMS_ENABLED=true` only when the storefront hostname is proxied through Cloudflare and Images > Transformations is enabled on that hostname's zone. Only safe raster files beneath `/images/` are transformed; the browser receives width candidates and Cloudflare negotiates AVIF/WebP. Cloudflare caches generated variants at the edge, so this adds no image processing or transformed-image cache to the VPS. Keep the flag false for unproxied/custom tenant domains; those assets continue to load directly. This reduces transfer size, not the original files stored in Git or the deployment image.

For production, keep public ministry uploads in a dedicated media bucket with a Cloudflare-proxied custom domain, separate from the private `bazionweb-backups` bucket. In Cloudflare, enable Images > Transformations on that media domain's zone and restrict allowed source origins to the exact media domain. Keep the R2 bucket credentials only in the API secret store. Verify that one image request returns the expected AVIF/WebP format and that each `srcset` URL serves the expected width before setting `MEDIA_IMAGE_TRANSFORMS_ENABLED=true`. If the media zone is not configured, leave the flag false so images load directly. Existing R2 objects are not rewritten by the new-upload normalizer and require a separately backed-up, report-only-first migration before any in-place conversion.

Staging Lighthouse and field Web Vitals are still an operational measurement gate because staging is not reachable from this worktree. Once deployed, test at least the home page, event listing, gallery, sermon listing, shop listing, and a product page on mobile and desktop. Use the 75th percentile targets: LCP ≤ 2.5 seconds, INP ≤ 200 ms, and CLS ≤ 0.1. In Chrome DevTools, run Lighthouse in mobile and desktop modes and retain the JSON/HTML reports with the release evidence. For field data, connect a real-user monitoring source (or the Cloudflare Web Analytics/Core Web Vitals integration) and wait for representative traffic; Lighthouse is lab data and cannot stand in for field INP. Analyze client bundles before adding dependencies. Cloudflare should cache immutable `/_next/static/*` assets and optimized public media, while bypassing cache for login, account, cart, checkout, `/api`, `/v1`, and any tenant-personalized response. Do not apply a broad “cache everything” rule to tenant HTML.

The public storefront is tenant-host-driven and dynamically rendered. Keep that design until measurements justify a safer tenant-keyed static/partial rendering strategy; static generation without an explicit tenant hostname key could serve one church's content to another. The Next.js production checklist recommends checking dynamic rendering and data-cache choices intentionally, using the Image component for layout stability and modern formats, and measuring with Lighthouse plus field Core Web Vitals. Cloudflare documents responsive image transformations and warns against caching authenticated or personalized HTML.

References: [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist), [Next.js fetch API](https://nextjs.org/docs/app/api-reference/functions/fetch), [Docker cache optimization](https://docs.docker.com/build/cache/optimize/), [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), [Cloudflare image transformations](https://developers.cloudflare.com/images/optimization/transformations/overview/), [Cloudflare responsive images](https://developers.cloudflare.com/images/optimization/make-responsive-images/), [Cloudflare cache guidance for login and dynamic content](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/), [Core Web Vitals thresholds](https://web.dev/articles/vitals).

## Guided Dokploy setup

The release Compose file is [`deploy/dokploy/platform-staging.compose.yml`](../../deploy/dokploy/platform-staging.compose.yml). It deploys Platform PostgreSQL, a migration job, API, admin, storefront, commercial status worker, and notification worker. The one-shot migration target applies both the application schema and the Better Auth schema using the same least-privilege migrator role; the Better Auth CLI is pinned in the workspace lockfile, so deployment does not download tools at runtime. Images are pulled from GHCR; the VPS does not build images. The Platform database is private to the migration/API/workers network, while the UI services cannot resolve or connect to the database. No container port is published on the VPS.

### 1. Confirm the staging names

The Cloudflare screenshot confirms these proxied A records already point to `102.208.217.249`: `staging.bazionweb.com`, `staging-api.bazionweb.com`, `platform-staging.bazionweb.com`, `platform-api-staging.bazionweb.com`, and `church-staging.bazionweb.com`. Keep the apex `bazionweb.com`, `www`, and `media.bazionweb.com` records unchanged. The first two names are reserved for Bazionweb; the other three are for Platform admin, API and tenant storefront respectively.

After Dokploy issues origin certificates, set the `bazionweb.com` Cloudflare zone SSL/TLS mode to **Full (strict)**. Do not use Flexible mode.

### 2. Create the Platform staging project

In Dokploy, create a project named **Bazion Staging** and an environment named **staging**. Create a Docker Compose service using the Platform GitHub repository, branch `main`, and Compose path `deploy/dokploy/platform-staging.compose.yml`. Select normal **Docker Compose**, not Docker Stack: the migration job must complete successfully before the API starts. Leave Dokploy's additional Isolated Deployments toggle off; the checked-in Compose file creates a dedicated application network and a separate `internal: true` data network, and only the three public services receive Dokploy/Traefik domain routing.

Configure GHCR as a private registry in Dokploy and select it for the Compose service. GHCR supports PAT (classic) authentication for external pulls. Use a dedicated token with only `read:packages`, grant that GitHub identity access to these packages, set an expiry and rotate it. Do not use the broader `repo`, `workflow`, `write:packages`, or `delete:packages` permissions listed in some older Dokploy examples. The GitHub App used by CI for repository contents is not the GHCR pull credential.

The Platform workflow publishes immutable `sha-<commit>` images only after validation on `main`. Wait for the validated main-branch publish job, then set `PLATFORM_IMAGE_TAG` to that exact SHA tag. Do not use `latest` or a mutable `staging` tag for a release.

### 3. Find the exact trusted proxy range

The API accepts forwarded client IP information only from a configured proxy CIDR. Before the first deployment, run this non-secret command in the VPS SSH session:

```bash
sudo docker network inspect dokploy-network --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

Use the returned subnet exactly for `TRUSTED_PROXY_ADDRESSES` in Dokploy. Do not put a broad range such as `172.16.0.0/12` there. If the network does not exist, add the domains in step 5, save the Compose app, then run the command again; do not start the API with an empty or guessed trusted-proxy value.

### 4. Add environment variables in Dokploy

Open the Compose service's **Environment** tab and add these as staging environment variables. Use a password manager to generate a different 32-byte random hexadecimal value for each `BAZION_*_PASSWORD` and the PostgreSQL admin password; hex avoids special-character escaping in the PostgreSQL URLs. Never send values in chat, screenshots, or Git. Dokploy writes Compose variables to its deployment `.env`; restrict Dokploy access to trusted operators and plan an external secrets-provider integration before production customer data is placed here.

Required variables (the file rejects missing values before starting):

- Image and network: `PLATFORM_IMAGE_TAG`, `TRUSTED_PROXY_ADDRESSES`.
- PostgreSQL: `POSTGRES_ADMIN_PASSWORD`, `BAZION_APP_PASSWORD`, `BAZION_MIGRATOR_PASSWORD`, `BAZION_AUTH_PASSWORD`, `BAZION_TENANT_RESOLVER_PASSWORD`, `BAZION_TENANT_PROVISIONER_PASSWORD`, `BAZION_NOTIFICATION_ENQUEUER_PASSWORD`, `BAZION_NOTIFICATION_WORKER_PASSWORD`, `BAZION_HOSTING_RECONCILER_PASSWORD`, `BAZION_PRODUCT_PROVISIONER_PASSWORD`, `BAZION_TENANT_BACKUP_PASSWORD`.
- Platform auth: `PLATFORM_BETTER_AUTH_SECRET`, `OIDC_BFF_CLIENT_SECRET`, `OIDC_SIGNING_PRIVATE_KEY_PEM`.
- Mock staging payments only: `STAGING_MOCK_PAYMENT_SECRET`. `APP_ENV=staging` permits the mock provider while `NODE_ENV=production` keeps secure cookies, HTTPS, and the production hardening checks active. This must never be used for production.
- R2: `R2_S3_ENDPOINT` (format `https://<Cloudflare-account-id>.r2.cloudflarestorage.com`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Use the token scoped to **Object Read & Write for the `bazionweb-public-media` bucket only**. The API gets these credentials; the admin and storefront get only the public `https://media.bazionweb.com` URL. The media transformation flag is enabled because you confirmed the custom domain and transformations are active. Site-asset transformations remain off until verified for the `bazionweb.com` zone.
- Encrypted email queue: `NOTIFICATION_ENCRYPTION_KEY` (random canonical Base64 encoding of exactly 32 bytes), `NOTIFICATION_SMTP_HOST`, `NOTIFICATION_SMTP_USER`, `NOTIFICATION_SMTP_PASSWORD`, `NOTIFICATION_EMAIL_FROM`. Optional settings default to port 465 and implicit TLS; use `NOTIFICATION_SMTP_PORT=587` and `NOTIFICATION_SMTP_SECURE=false` only when your provider requires STARTTLS. Staging signup requires verified-email delivery.
- Callback authentication: `PLATFORM_CALLBACK_SIGNING_SECRET`, `PLATFORM_CALLBACK_BEARER_SECRET`. Generate unique high-entropy staging values and use the corresponding Bazionweb callback-secret settings in the Bazionweb staging API later.

To create the OIDC private key locally, use OpenSSL (for example from Git for Windows):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out platform-staging-oidc.pem
```

Paste its PEM into the Dokploy variable as one line, replacing each line break with the two characters `\n`. The Platform API converts those separators back to newlines at runtime. Do not commit the key or paste it into this chat.

### 5. Add the three Platform domains

In the Compose service's **Domains** tab, add domains with HTTPS/Let's Encrypt enabled and the service port below. Use Dokploy's native Domains UI, not handwritten labels:

| Hostname | Compose service | Container port |
| --- | --- | ---: |
| `platform-api-staging.bazionweb.com` | `api` | 4000 |
| `platform-staging.bazionweb.com` | `admin` | 3001 |
| `church-staging.bazionweb.com` | `storefront` | 3000 |

Do not add public domains to `db`, `migrate`, `status-worker`, or `notification-worker`. Save the service and use Dokploy's Compose preview to check these routes and the private networks before deploying.

### 6. Deploy and bootstrap

Deploy the selected commit-addressed SHA with `COMPOSE_PROFILES` unset. The first deployment initializes the named Postgres volume and applies the application and Better Auth migrations once. The API and workers start after both migration steps succeed, and the UIs start after the API health check passes. Wait for all long-running services to show healthy/running; a failed `migrate` service blocks API startup by design. Use Dokploy service logs to diagnose it; never publish database port 5432 to troubleshoot.

The first release intentionally keeps `COMMERCIAL_PROVISIONING_ENABLED=false`, the saga worker disabled, and Dokploy hosting mutations disabled. Create an account through the admin sign-up flow and verify its email. In the Dokploy Environment tab, temporarily set `COMPOSE_PROFILES=operator-bootstrap`, `PLATFORM_ADMIN_EMAIL`, and `PLATFORM_ADMIN_CONFIRM_EMAIL` to that same verified address, then redeploy. Confirm the `platform-owner-bootstrap` one-shot service exits successfully in its logs. Immediately remove `COMPOSE_PROFILES` and both email variables, then redeploy to leave the bootstrap service inactive. This command only grants the role to an existing verified account; it does not create or change a password. Create a new empty staging tenant, bind `church-staging.bazionweb.com` to it, and run the website-launch pilot only after Bazionweb staging is deployed and the signed callback round-trip is tested. Do not copy live church member data into staging.

### 7. Add Bazionweb as a separate Dokploy service

The staging stack is implemented in the separate [`bazionweb` repository](https://github.com/bazionwebs/bazionweb), at `docker-compose.dokploy.staging.yml`; its operator guide is `docs/operations/vps-staging-deployment.md`. It has its own PostgreSQL database and Redis, no published database/cache ports, one-shot migrations, health-gated API/web startup, bounded resources, and staging-only hostnames. Keep the production Compose app and database separate. Never use `docker-compose.dokploy.yml` for this staging service.

Create a second Dokploy Compose application from the Bazionweb repository and select `docker-compose.dokploy.staging.yml`. Attach it to the existing `dokploy-network`; the Compose file supplies Traefik routers for `staging.bazionweb.com` and `staging-api.bazionweb.com` on HTTPS. The Cloudflare A records for both names should remain proxied to the VPS address, and Cloudflare SSL/TLS should use **Full (strict)**. Follow the Bazionweb guide for its required environment variables, registry credential, and first-deploy health checks. The Platform storefront remains `church-staging.bazionweb.com`; do not point it at `staging.bazionweb.com`.

The Bazionweb staging Compose file sets the `com.bazion.backup-target=bazionweb-staging` label on its database. Both stacks must use the same staging-only callback signing and bearer secrets on the corresponding API settings before signed callback tests. Keep commercial provisioning, the saga worker, and Dokploy hosting mutations disabled until the callback round trip, staging database backups/restore, pilot tenant, and release approval are verified. The Bazionweb feature branch currently has no GHCR release image; GitHub Actions monthly quota exhaustion prevents image publication. A locally built image is not available to Dokploy. Wait until validated CI can publish the commit-addressed GHCR images before deploying either stack.

### Resource budget

Platform staging hard limits in its Compose file total about 2.5 GiB RAM and 2 CPU cores, including one-shot services. Bazionweb staging totals about 2.3 GiB and 1.75 CPU while its migration runs; after migration it is about 1.9 GiB and 1.4 CPU. The combined peak ceilings are therefore about 4.8 GiB and 3.75 CPU, before Dokploy, monitoring, the operating system, and transient startup/build work. The VPS has 6 GiB RAM and 3 CPU cores. These ceilings are not reserved memory, but they are too close to the host's capacity to assume both stacks can peak safely. Build images off-host, deploy the stacks in sequence, inspect `docker stats` and host memory/CPU under representative traffic, and lower the Compose limits or upgrade the VPS if the host approaches memory pressure or sustained CPU throttling. Do not load real customer/member data until health, backup, and restore gates pass.

## Database backups

The existing VPS Restic timer uploads selected system and Dokploy configuration plus monitoring data to the private R2 bucket. It currently does not create PostgreSQL dumps. The Platform repository provides [`bazion-docker-postgres-dump.sh`](../../deploy/systemd/bazion-docker-postgres-dump.sh), which selects exactly one running DB by an explicit Docker label, writes a mode-0600 custom-format dump, and validates its archive table of contents. The Platform DB label is `com.bazion.backup-target=platform-staging`; the Bazionweb staging DB label is `com.bazion.backup-target=bazionweb-staging`.

After the Platform stack is deployed, copy this helper to `/usr/local/sbin` on the VPS and add this line in `/usr/local/sbin/bazion-restic-backup.sh` after `STAGE` is created and before `restic backup` runs:

```bash
/usr/local/sbin/bazion-docker-postgres-dump.sh platform-staging bazion_platform bazion_admin "$STAGE/postgres"
/usr/local/sbin/bazion-docker-postgres-dump.sh bazionweb-staging bazionweb_staging bazion_admin "$STAGE/postgres"
```

Install the helper as root-owned executable at `/usr/local/sbin/bazion-docker-postgres-dump.sh`. Add both invocations after the Restic script creates `$STAGE` and before `restic backup` runs. Do not put these dumps inside either database volume. Then run the existing backup service once and confirm the Restic log succeeds, both dump files are present in the staged backup, and a new snapshot exists in the private `bazionweb-backups` R2 bucket. A backup is not recovery proof: restore each dump into a separate recovery database and verify migrations/preflight there before staging holds customer or member data. Keep the R2 repository password and access keys only in the root-owned secret configuration on the VPS.

## Current release limits

- Bazionweb production remains on Render until staging acceptance and a rollback rehearsal are complete.
- Production offer bindings remain closed while the church-ministry product release is partial.
- The Dokploy API adapter does not create projects/environments, provision databases, configure DNS/TLS, or orchestrate rollback. Those tasks remain operator-controlled.
- Dokploy deployment, GHCR image publication, callback verification, PostgreSQL dump automation, and restore drills remain external release gates; the two codebases are separate and one stack's CI/deployment does not automatically configure the other.
