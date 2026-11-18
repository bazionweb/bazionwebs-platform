# Template upgrades and bulk media: research and architecture recommendation

**Prepared:** 18 November 2026  
**Repository baseline:** `origin/main` at `6707bfc`  
**Scope:** reusable site templates, existing tenant websites, and admin image import across template families

## Recommendation

Make template changes once in the shared, versioned template source. Provisioned tenants should inherit that source and store only their own content and deliberate overrides. When a compatible template release is published, automatically rebase tenants whose fields still inherit the old template value; preserve tenant-edited fields and surface genuine conflicts for review. Do not blindly overwrite every live tenant as soon as a template file changes.

For images, provide one shared tenant media library with a **Select folder** and **Select files** flow, a queued batch-import/review screen, and a common picker used by every template editor. Extract reliable file facts automatically. Offer generated alt text/caption/tags only as editable suggestions, never publish them automatically.

This approach removes repeated code edits while protecting client-specific content and releases.

## What the repository does today

### Template and tenant lifecycle

- Product/template manifests in Git are already versioned. [ADR 0013](adr/0013-product-and-template-release-contracts.md) says published artifacts are immutable, compatibility changes need new versions, and product/template/configuration versions are independent.
- Product installations already record `template_id`, `template_version`, and configuration schema version; configuration snapshots have checksums and numbered history (`packages/database/src/schema/product-installations.ts`). The release/upgrade path still needs an operational adapter.
- Applying a website template uses `/admin/platform/tenants/:tenantId/website-onboarding/apply-template` (`apps/api/src/modules/admin/website-onboarding-routes.ts`). It generates white-labeled configuration and persists settings for that tenant. This is a **materialized copy**, not a live link to the template source with field-level inheritance.
- [ADR 0012](adr/0012-tenant-and-product-installation-boundary.md) describes installations as tenant-owned product compositions and says the current settings model is singular. The installation change service currently handles module changes/rollback while preserving the base composition; it is not yet a template-content rebase workflow.
- Shared storefront code already means a common code release can change behavior for all tenants using that runtime, subject to deployment. Tenant values written to settings do not automatically change just because the template source changes.

### Image upload and library

- `apps/storefront/app/admin/media-upload-field.tsx` reads only `files[0]`; the input does not offer `multiple` or folder selection. It uploads one file then assigns that URL to one field.
- `GET /v1/admin/church/media` lists at most 100 storage objects. The library does not show pagination or search, and the API response exposes storage facts rather than a persistent title/tag/usage catalog.
- `POST /v1/admin/church/media` accepts one raw image at a time, is limited to 8 MB, and is rate-limited to 10 requests per minute per IP. It verifies the file signature against the declared type, sanitizes the filename, uses a random tenant-scoped key, checks decoded pixel count, and passes the image through a bounded Sharp optimizer. These safeguards should be retained.
- The optimizer returns dimensions and byte savings. Gallery alt text and captions are entered manually in `site-settings-editor.tsx`; there is no automatic description/tagging workflow. The shared media field is currently used for church logos, hero images, leader portraits, sermon thumbnails, event posters, and individual gallery items.
- The adapter is already tenant-scoped. If one tenant later owns multiple brands/installations, asset sharing should be explicit rather than assuming every asset is visible to every installation.

## Recommended bulk image workflow

### 1. Select and review the batch

Offer three ways into the same import queue:

1. **Select folder** using a directory-capable file input (`webkitdirectory`, `multiple`) and show relative folders as import collections. Preserve the user's organization as metadata; never use an untrusted relative path directly as a storage key.
2. **Select files** using `multiple`, for browsers or users who do not want to send a folder.
3. **Drag and drop** a folder or a set of images into the upload surface where the browser supports it.

Before uploading, show the image count, total bytes, unsupported files, likely duplicates, and the destination collection. Let the user remove or retry individual files. Do not automatically attach every imported image to the public gallery; after processing, let the admin select a batch and choose “Add to gallery” or use the assets in other fields.

The browser exposes a chosen folder's files and relative paths through the directory input APIs. `webkitdirectory` works in current major browsers, but remains a prefixed API with older-device compatibility caveats, so retain the ordinary multi-file picker fallback. [MDN directory input](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory), [MDN file input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file)

### 2. Use a resumable job and per-file state

Treat a folder as many separate image objects. The UI should show `queued → uploading → processing → ready` or `failed`, per file, with retry and cancel. Use a bounded worker queue, not one giant request containing an entire folder. Make each item idempotent using an import ID plus content hash, so a browser retry cannot create duplicate assets.

At today's 8 MB image limit, S3/R2 **multipart upload is not the feature needed for a folder**: multipart splits one large object into parts. Small images should be independent `PUT` uploads in a bounded batch. Cloudflare R2 documents single `PUT` for small/medium objects and multipart for large/resumable objects; it supports short-lived presigned `PUT` URLs but not presigned HTML form `POST`. [R2 upload methods](https://developers.cloudflare.com/r2/objects/upload-objects/), [R2 presigned URL rules](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

The current per-image endpoint's 10-per-minute rate limit is too restrictive for an ordinary folder. For an initial bounded MVP, add a batch/import-job API with tenant quotas and bounded concurrency while continuing to send each image through server validation and optimization. For larger batches or higher traffic, add a private staging prefix and one short-lived, one-object presigned PUT per file; then finalize through a server-side worker. The server must still read and verify each object, enforce actual size/type/pixel limits, optimize it, move/write the canonical object, persist metadata, and only then mark it ready. Never expose storage credentials or make an unverified staging object publicly addressable. Presigned URLs are bearer capabilities and can be reused until expiry, so use a unique random staging key per import item, make finalization idempotent, verify the stored bytes/checksum server-side, and delete the staging object after success or expiry. Restrict URLs by operation/content type, keep them short-lived, and configure bucket CORS. For strict per-image size enforcement, keep the current bounded server-streaming path unless the selected storage gateway can enforce the limit before accepting the object; do not rely on the browser's reported size. [Cloudflare R2 presigned URL security](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [Cloudflare user-generated-content architecture](https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/)

### 3. Keep security checks in the server pipeline

Keep authentication and tenant authorization on job creation and completion. Enforce file-count, per-image and total-batch byte quotas; allow only required raster image types; check actual signatures and successful image decoding; bound dimensions/pixels and worker concurrency; use generated object keys; and clean up abandoned staging uploads/jobs. Do not trust the filename, extension, MIME header, folder path, or client-reported size. OWASP recommends defense in depth, allowlists, signature checks in addition to MIME checks, server-generated names, authorization, and size limits. [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

The existing Sharp pipeline strips metadata when it re-encodes an image by default. Keep this privacy-friendly default; do not reintroduce EXIF wholesale just to populate the library. If the service needs capture dates, extract only approved fields in a server-side processing step, and do not store/display precise GPS coordinates by default. [Sharp output metadata behavior](https://sharp.pixelplumbing.com/api-output/), [Sharp input metadata](https://sharp.pixelplumbing.com/api-input/)

### 4. Automatically capture facts; suggest editorial fields

Persist automatically verifiable facts: original name (restricted/internal), sanitized display name, format, original and optimized byte size, width/height, checksum, upload/import time, uploader, processing state, and collection. Use a server-generated `assetId` and a storage key unrelated to user-supplied paths.

Optional image-understanding can suggest a short title, contextual description, alt text, and tags. Keep these fields visibly marked **Suggested**, allow per-image editing and bulk approval, and leave public fields empty/unpublished until reviewed. Alt text is context-dependent: W3C says informative images need a text alternative conveying essential information, while decorative images should have an empty alternative. A model can describe visible content but cannot know the correct page purpose or the people/event context reliably. Avoid automatic identity/face recognition and sensitive-trait inference. [W3C Images Tutorial](https://www.w3.org/WAI/tutorials/images/)

For a first release, ship deterministic metadata only and manual descriptions. Add optional description suggestions later behind an explicit tenant/admin action, using a provider port that can be disabled and with generated text stored as a draft. Do not make an external AI provider a launch dependency for upload.

### 5. Make the media library reusable

Add a tenant-scoped media-asset catalog rather than trying to infer editorial metadata from object names. A starting record should include:

- `assetId`, `tenantId`, optional `installationId`/collection, random object key, status, uploader, import job and timestamps;
- original filename (not public), safe display name, content type, dimensions, byte sizes, SHA-256 checksum, and processing error/state;
- editable alt text, caption/title, and tags with a “suggested/reviewed” state;
- optional usage references (asset → website field, gallery item, event, sermon) so the UI can show where used and prevent accidental deletion of live assets.

Use current tenant RLS/object-key boundaries. `installationId` should be an association/visibility scope, not silently treated as an authorization boundary: ADR 0012 says installations are not a security boundary. Offer explicit “share across this tenant's sites” when appropriate, and keep assets private until assigned to a public content field.

Build a common `MediaLibrary` and `AssetPicker` in the shared admin/media module. All template editors should select from this same service. Template-specific forms decide which role/fields an asset fills (logo, hero, product image, portrait, gallery), but upload, batching, metadata review, retry, quota, and object lifecycle should not be reimplemented per template.

## Recommended template-to-tenant upgrade model

### Separate code, defaults, and tenant content

Use three distinct layers:

1. **Shared platform behavior and components:** maintain one implementation. Ship improvements through a tested immutable application release and staged deployment rings. Tenants on the shared runtime receive the release without per-tenant code edits; risky/behavioral changes use flags or staged rollout.
2. **Versioned template baseline:** keep immutable template releases in Git/manifests (`templateId`, semantic version, checksum, configuration schema version, release notes, compatibility/migration). New tenants start from a specific release.
3. **Tenant-owned values and overrides:** store the tenant's content, branding, selected assets, and changed fields separately from template defaults. The effective site is the template baseline plus tenant overrides. Do not treat a template application as permission to overwrite later tenant edits.

This follows the repository's existing ADR: published templates are immutable/versioned; tenant configuration is customer-owned; schema transforms must be explicit, validated, idempotent, preserve overrides, exclude secrets, and support recovery. The missing piece is an operational template rebase/rollout path.

### Template release and tenant update sequence

1. Edit shared template source once, bump its template version, validate the content/schema and compatibility, and publish an immutable release/checksum.
2. Generate a field-level release diff and identify affected installations using that template. Classify fields as **template-owned**, **tenant-overridable**, or **tenant-only**.
3. Apply compatible, non-overridden defaults automatically only to tenants with an `auto-compatible` policy. Preserve fields the tenant changed from the old baseline.
4. If both template and tenant changed the same field, report a conflict and keep the tenant's current value until an authorized reviewer resolves it. Never silently replace payment, contact, leadership, legal, or client-uploaded image content.
5. Stage the new effective configuration in a preview; verify schema transformation, template rendering, custom domain, image references and key workflows. Promote by rollout ring (internal → canary tenants → remaining eligible tenants) with pauses and error thresholds.
6. Record the old/new template version, config version/checksum, changes applied/skipped/conflicted, actor/policy, and result. Provide a rollback to the previous immutable template/config snapshot.

For a field-level rebase, compare **old baseline**, **current effective tenant value**, and **new baseline**. If current equals old baseline, adopt new baseline. If it differs, preserve it as a tenant override. If a migration changes its shape, run the schema-version transform and validate. Show conflicting template edits in the review UI.

### Automatic propagation policy

“Edit the template once and do not edit each tenant” is achievable with a safe distinction:

- A shared component/bug/security fix is authored once and reaches tenants through the shared application deployment after staging/canary. It does not require editing tenant content records.
- A new default/layout in a template is published as a template release. Tenants that inherit the touched fields can receive it automatically by a rollout policy; fields a client has customized remain theirs.
- Tenant content (names, addresses, photos, giving accounts, event schedules and copy) remains tenant-owned and is not replaced by a global template release.
- A tenant may pin a known-good template version or defer non-security upgrades. Per-tenant runtime pins only work if the deployment/ingress adapter actually routes to a separate artifact; a database version number alone is not proof of runtime isolation, as architecture docs already caution.

Avoid editing generated tenant copies and template source separately. Also avoid a “latest template always wins” runtime merge with no preview/history: it can alter every client's live site and can overwrite deliberate brand/content choices.

## Delivery roadmap

### Phase 1 — Usable batch import

- Add folder and multiple-file selection, drag/drop where supported, review list, bounded upload queue, per-file progress/retry/cancel, duplicate detection, and select-to-gallery.
- Replace the 100-item library ceiling with pagination/search and editable title/alt/caption/tags stored in a tenant-scoped catalog.
- Keep existing content/signature/pixel validation; expand rate limiting to support bounded, authorized batches while retaining per-tenant quotas.
- Use the same library/picker for all existing and future template image fields.

### Phase 2 — Durable media pipeline

- Add import-job/item records, idempotency/checksums, quotas, orphan cleanup, and resumable completion status.
- Add presigned staging uploads only when scale/latency justifies it; route processing through a durable worker and keep unverified objects non-public.
- Add optional reviewed metadata suggestions after the asset catalog, privacy controls, provider settings, and failure handling exist.

### Phase 3 — Safe template upgrades

- Add explicit release registry/events and installation rollout state, plus a template base revision/checksum attached to each configuration snapshot.
- Define field provenance and override behavior; build idempotent source→target transforms with conflict reports.
- Add admin bulk rollout controls for preview, canary, pause/resume, conflict review, and rollback.
- Prove the update workflow on a test tenant, a tenant with no overrides, and a tenant with brand/content/media overrides before enabling automatic rollout.

## Key sources

- [Repository ADR 0012: Tenant and product installation boundary](adr/0012-tenant-and-product-installation-boundary.md)
- [Repository ADR 0013: Product and template release contracts](adr/0013-product-and-template-release-contracts.md)
- [Cloudflare R2 upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare architecture: storing user-generated content](https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/)
- [MDN: directory input](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Sharp metadata behavior](https://sharp.pixelplumbing.com/api-output/)
- [W3C WAI Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
