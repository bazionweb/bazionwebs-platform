# Church and ministry module

## Current status

The church module is **partial**. It provides tenant-scoped public ministry websites, profile and site settings, published sermons, events and registrations, giving campaigns and donation attempts, contact enquiries, prayer requests, and newsletter opt-ins. It is a reusable website template and starter content editor, not a complete church-management product. The research and public feature map are in [church-ministry-website-research.md](church-ministry-website-research.md).

The storefront reads a tenant profile and validated `public_site` settings from `ministry_settings`. The signed-in editor can configure identity, logo, contact/social links, palette, hero, visitor information, service times, locations, online stream link, ministries, FAQs, leaders, gallery URLs, values, faith statement, giving instructions and search description. Public service, location and gallery content stays empty until a ministry publishes it. Site colors require a 4.5:1 contrast ratio against white. The profile editor writes profile columns and validated public settings in the same tenant-scoped transaction.

## Implemented routes

Public routes are mounted under `/v1/public/church`:

- `GET /site` returns the tenant profile and active leaders.
- `GET /sermons` and `GET /sermons/:slug` return published messages.
- `GET /events` and `GET /events/:slug` return non-cancelled events.
- `POST /events/:eventId/register` creates a tenant-bound registration, checking event state and capacity under a row lock and recording consent time.
- `GET /campaigns` lists active campaigns.
- `POST /donations/mpesa-stk` initiates a Daraja STK Push when credentials are configured. Without them, the endpoint returns unavailable; the storefront displays manual Paybill instructions only when those details are configured for its reference template, otherwise it asks donors to contact the ministry.
- `POST /donations/mpesa-callback` verifies the per-attempt callback token, provider references, amount and phone before marking a donation verified.
- `GET /donations/status` returns attempt state to the holder of a random client status token.
- Contact, prayer-request and newsletter intake routes persist tenant-scoped submissions. Contact, prayer, event registration, donation and newsletter forms require a privacy acknowledgement; contact and prayer records store its time.

The storefront event and sermon detail pages use these APIs. Their server-rendered titles, descriptions and social previews use published content, while tenant metadata and sitemap/robots origins follow the incoming verified domain. Registration references are shown only after the API records a registration. Giving campaign progress is increased only after a provider-confirmed donation.

Protected routes are under `/v1/admin/church`. The signed-in ministry UI reads overview, website settings, sermons, events, campaigns, registrations, donations, enquiries, prayer requests and email opt-ins. It can save drafts or publish sermons, update event and campaign status, create events/campaigns, and remove private enquiries, registrations, prayer requests and email opt-ins. Donor, attendee, enquiry, prayer-request and subscriber records require `churchprivate`, granted to `owner` and `admin`. There is no separate finance or pastoral role yet. Newsletter opt-ins are stored with consent time, but scheduled delivery and user-facing unsubscribe links are not connected. Gallery entries point at existing HTTPS or site-relative images; media upload/storage is not implemented.

## M-Pesa configuration and release state

Set `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_BUSINESS_SHORT_CODE`, `MPESA_PASSKEY` and `MPESA_CALLBACK_URL` together. The callback base URL must be publicly reachable; the API derives these callback paths from its origin:

- `/v1/public/church/donations/mpesa-callback`
- `/v1/public/commerce/payments/mpesa-callback`

For commerce checkout, set `PAYMENT_PROVIDER=mpesa`. The checkout supports KES amounts in whole shillings. It reserves inventory before requesting the STK Push, holds the order as unpaid until the callback, and releases the reservation when Safaricom reports failure. Callback and status tokens are stored as hashes. API request URLs and payment-status headers are redacted from application logs; ingress and reverse-proxy access logs must also redact callback query strings. Provider credentials are process-wide environment settings rather than tenant-specific encrypted accounts, so separate tenant settlement accounts are not supported yet.

Production startup rejects the mock provider, sandbox credentials and non-HTTPS callback URLs. The Daraja integration has not been exercised against the ministry's live merchant account in this repository. Complete a sandbox end-to-end cycle and production merchant callback validation before accepting real payments. Missing callbacks still need an operator reconciliation path; refunds and payment reversals are not implemented.

## Database and tenancy

Migration `0008_church_ministry_domain.sql` adds the church data tables. `0009_church_integrity_and_payment_callbacks.sql` adds tenant-aware relationship constraints and donation callback/idempotency fields. `0010_commerce_mpesa_callbacks.sql` adds durable commerce callback and status-token fields. `0011_church_site_and_privacy.sql` adds consent timestamps to new event, donation, contact and prayer submissions. The migrations stop when existing relationships are missing or cross-tenant rather than silently rewriting data. Church and commerce records use forced PostgreSQL RLS and tenant-scoped transactions.

## Remaining work

- Store provider credentials per tenant and route payment requests to that tenant's merchant account before onboarding ministries with separate settlement accounts.
- Add newsletter delivery, preference center and secure user-facing unsubscribe.
- Add media uploads/storage, sermon editing/scheduling, category management and a fuller page builder.
- Build member, household, attendance and volunteer workflows.
- Add fine-grained finance and pastoral roles, data-retention automation and audit coverage for ministry administration.
- Add callback-loss reconciliation, payment reversal/refund handling and operational alerts.
- Validate Daraja sandbox and live merchant behavior, inventory races and callback retries in a staged environment.
