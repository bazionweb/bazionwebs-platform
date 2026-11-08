# Church & Ministry Management Platform

> **Reusable Ministry Template Specification for Bazion Web**
> **Tenant Implementation:** Global Mission for Christ International (`global-mission.config.ts`)

---

## 1. Executive Architecture Summary

This implementation reconstructs the Global Mission for Christ International website into a production-grade, multi-tenant digital ministry platform powered by **Bazion Web**.

Instead of a disconnected, one-off codebase, this architecture establishes a **reusable Church & Ministry Solution Template** within Bazion's modular monolith:
- **Framework & Frontend:** Next.js 16 (Turbopack, App Router, React 19).
- **Design Tokens & Theme:** Dedicated `@bazion/ui/church.css` featuring Deep Navy (`#0a192f`), Royal Blue (`#1d4ed8`), Warm Gold (`#d97706`), and accessible contrast tokens.
- **Backend API:** Fastify 5 with strict rate limiting, CORS origin isolation, and security headers.
- **Database & Multitenancy:** PostgreSQL with Drizzle ORM and **forced Row-Level Security (RLS)** (`tenant_isolation` policy enforcing `app.tenant_id`).
- **Authentication & RBAC:** Better Auth 1.7 integrated with Bazion tenant workspace roles (`owner`, `admin`, `contentEditor`, `viewer`).
- **Payment Processing:** Integrated M-Pesa STK Push simulation and Equity Paybill instructions for donations, campaigns, and tithes.

---

## 2. Public Information Architecture (7 Core Pages + Dynamic Routes)

The public storefront (`apps/storefront`) delivers the full 7-page ministry experience:

| Route | Purpose | Key Interactive Features |
|---|---|---|
| `/` | **Home Page** | 12-section blueprint: Full-width hero, verified statistics counter, ministry intro, core mission activities, featured sermon with YouTube embed modal, upcoming events spotlight, photo gallery, testimonies carousel, giving CTA banner, and newsletter subscription. |
| `/about` | **About the Ministry** | Ministry founding history, separate Vision & Mission statements, 5 Biblical Core Values, structured Statement of Faith, Director's Message (Rev. Anthony Githui), Leadership Team grid, and partnership invitation. |
| `/gallery` | **Ministry in Action** | Category filtering (All, Crusades, Conferences, Medical Outreach, Prayer Meetings, Community Outreach), responsive photograph grid, full-screen lightbox modal with captioning, and video showcase. |
| `/sermons` | **Sermons & Word** | Search input, category filter tabs, YouTube player modal, scripture citations, speaker biographies, and sermon archive. |
| `/sermons/[slug]` | **Sermon Detail** | Dedicated page with embedded 16:9 YouTube video player, scripture passage callout, downloadable study notes, and related messages. |
| `/events` | **Conferences & Outreach** | Interactive filter (All / Upcoming / Past), countdown date badges, venue/location info, and **in-modal registration form** generating unique reference numbers (`GMFC-REG-XXXXXX`). |
| `/events/[slug]` | **Event Detail** | Event schedule breakdown, venue Google Maps link, capacity tracker, and direct attendee registration. |
| `/contact` | **Contact & Enquiries** | Verified telephone hotlines, direct email links, physical address in Nyeri, WhatsApp action button, and a dual-purpose form for general enquiries and confidential prayer requests. |
| `/give` | **Partnership & Giving** | M-Pesa Equity Paybill instructions (Business: 247247, Account: 0710600123), preset amount chips (KES 500, 1000, 2500, 5000), custom amount input, STK Push trigger, and active fundraising campaign progress meters. |
| `/privacy` | **Privacy Policy** | Kenya Data Protection Act 2019 compliance, prayer request confidentiality pledge, and donor record privacy. |
| `/terms` | **Terms & Conditions** | Ministry website usage terms, donation guidelines, and intellectual property. |
| `/sitemap.xml` | **SEO Sitemap** | Automatically prerendered XML sitemap indexing all public pages, sermons, and events. |
| `/robots.txt` | **Search Crawlers** | Search engine indexing rules with disallows for internal admin routes. |

---

## 3. Administration Portal (`/admin`)

The administration portal provides church administrators with a complete 10-tab command center:

1. **Overview KPIs:** Real-time metrics tracking published sermons, active events, attendee registrations, total donations, pending prayer requests, and unread enquiries.
2. **Sermons Manager:** Publish new messages, set YouTube video IDs, scripture references, audio notes, and remove outdated sermons.
3. **Events Manager:** Create conferences, revival meetings, or medical camps with venue details, capacity limits, and registration toggles.
4. **Attendee Registrations:** Review confirmed attendee lists with unique reference codes, email addresses, and contact numbers.
5. **M-Pesa Donations:** View verified transactions, reconciliation receipts, donor phone numbers, and designated giving categories.
6. **Prayer Requests:** Triage incoming prayer needs, maintain pastoral confidentiality, and mark requests as "Prayed For".
7. **Contact Enquiries:** Review incoming messages, assign pastoral follow-ups, and update ticket statuses (`new`, `reviewed`, `archived`).
8. **Media & Gallery:** Upload photos to Cloudinary / Vercel Blob and organize into category albums.
9. **Ministry Settings:** Update church contact details, bank/Paybill accounts, social links, and branding without modifying code.
10. **Audit Trail:** Tenant-scoped security log recording administrative actions for accountability.

---

## 4. Database Schema & Multi-Tenant Entities

Thirteen tenant-isolated tables are defined in `@bazion/database` and protected by migration `0008_church_ministry_domain.sql`:

1. `ministry_profiles` — Legal name, logo, vision, mission, addresses, telephone contacts, social links.
2. `ministry_settings` — Key-value configuration for payment instructions and site features.
3. `leadership_profiles` — Pastoral and executive team members with display order.
4. `sermon_categories` — Thematic sermon tags (Revival, Faith, Healing, Missions).
5. `sermons` — Messages with YouTube video IDs, scripture references, notes JSON.
6. `church_events` — Conferences and crusades with start/end timestamps and capacity.
7. `church_event_registrations` — Attendee tickets with unique confirmation references.
8. `donation_campaigns` — Targeted fundraisers with target and raised amounts in minor currency units.
9. `church_donations` — Verified donations with donor contact details and payment statuses.
10. `church_payment_transactions` — Gateway transaction receipts (checkout and merchant request IDs).
11. `church_contact_messages` — Public contact submissions categorized by department.
12. `church_prayer_requests` — Confidential prayer petitions triaged by the pastoral intercessory team.
13. `church_newsletter_subscribers` — Email subscriber list with consent timestamps.

---

## 5. Fastify API Route Reference

Mounted under prefix `/v1` in `apps/api`:

### Public Endpoints
- `GET /v1/public/church/site` — Fetch tenant ministry profile, branding, and active leadership.
- `GET /v1/public/church/sermons` — Paginated list of sermons (supports `search`, `category`, `limit`, `offset`).
- `GET /v1/public/church/sermons/:slug` — Individual sermon details and related messages.
- `GET /v1/public/church/events` — Church calendar events (`filter=all|upcoming|past`).
- `GET /v1/public/church/events/:slug` — Event details and registration status.
- `POST /v1/public/church/events/:eventId/register` — Free attendee registration generating `GMFC-REG-XXXXXX`.
- `GET /v1/public/church/campaigns` — Active fundraising campaigns.
- `POST /v1/public/church/donations/mpesa-stk` — Initiates M-Pesa STK push for donations.
- `POST /v1/public/church/contact` — Submits general enquiry.
- `POST /v1/public/church/prayer-requests` — Submits confidential prayer petition.
- `POST /v1/public/church/newsletter` — Subscribes email to devotional newsletter.

### Admin Endpoints (Protected by Active Tenant RBAC)
- `GET /v1/admin/church/overview` — Aggregated counts and financial totals.
- `GET /v1/admin/church/sermons` & `POST /v1/admin/church/sermons` & `DELETE /v1/admin/church/sermons/:id`.
- `GET /v1/admin/church/events` & `POST /v1/admin/church/events` & `DELETE /v1/admin/church/events/:id`.
- `GET /v1/admin/church/registrations` — List of event attendees.
- `GET /v1/admin/church/donations` — List of donations and transaction receipts.
- `GET /v1/admin/church/messages` & `PATCH /v1/admin/church/messages/:id/status`.
- `GET /v1/admin/church/prayers` & `PATCH /v1/admin/church/prayers/:id/status`.

---

## 6. How to Run & Verify Locally

1. **Install Dependencies:**
   ```bash
   pnpm install
   ```
2. **Typecheck Entire Workspace (15 Packages):**
   ```bash
   pnpm turbo run typecheck
   ```
3. **Execute Vitest Suites:**
   ```bash
   pnpm test
   ```
4. **Validate Catalog & Entitlements:**
   ```bash
   pnpm catalog:validate
   ```
5. **Run Development Server:**
   ```bash
   pnpm dev
   ```
   Open `http://localhost:3000` to browse the Global Mission FC site, or `http://localhost:3000/admin` to access the administration portal.
