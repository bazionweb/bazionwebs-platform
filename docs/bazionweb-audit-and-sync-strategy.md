# Technical Audit and Synchronization Strategy Report: BazionWeb & BazionWebs Platform

**Document Version**: 1.0.0  
**Date**: November 11, 2026  
**Status**: Authoritative Architectural Strategy & Implementation Blueprint  
**Authors**: Teamwork Engineering Architecture & Review Squad  
**Repositories Covered**:
- `D:\bazionweb` (Commercial Agency Web Platform, Single-Tenant Billing & Operations Portal)
- `d:\bazionweb-platform\bazionwebs-platform` (Multi-Tenant SaaS Foundation, Turborepo Monorepo & Application Control Plane)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Comprehensive Technical Audit of `D:\bazionweb`](#2-comprehensive-technical-audit-of-dbazionweb)
   - [2.1 Architecture, Tech Stack, & Monorepo Structure](#21-architecture-tech-stack--monorepo-structure)
   - [2.2 Public Customer-Facing Experience & Service Catalog](#22-public-customer-facing-experience--service-catalog)
   - [2.3 Advertised Packages & Commercial Multi-Market Pricing Engine](#23-advertised-packages--commercial-multi-market-pricing-engine)
   - [2.4 Checkout Workflows & Billing Architecture](#24-checkout-workflows--billing-architecture)
   - [2.5 Client Provisioning & Tenancy Isolation](#25-client-provisioning--tenancy-isolation)
   - [2.6 Client Self-Service Dashboards (9 Modules)](#26-client-self-service-dashboards-9-modules)
   - [2.7 Super Admin Operations Center & Troubleshooting Suite](#27-super-admin-operations-center--troubleshooting-suite)
   - [2.8 Database Schema & Entity Relationships (Prisma 5.22)](#28-database-schema--entity-relationships-prisma-522)
   - [2.9 API Surface & Security Middleware](#29-api-surface--security-middleware)
3. [Architectural Audit of `bazionwebs-platform`](#3-architectural-audit-of-bazionwebs-platform)
   - [3.1 Tech Stack, Monorepo Structure & Build Orchestration](#31-tech-stack-monorepo-structure--build-orchestration)
   - [3.2 Applications and Shared Packages Breakdown](#32-applications-and-shared-packages-breakdown)
   - [3.3 Multi-Tenant Provisioning & Database Strategy](#33-multi-tenant-provisioning--database-strategy)
   - [3.4 Custom Domain Routing & DNS Verification](#34-custom-domain-routing--dns-verification)
   - [3.5 Administrative Dashboards Architecture (Platform vs. Tenant)](#35-administrative-dashboards-architecture-platform-vs-tenant)
   - [3.6 Data Schema & Migrations (Drizzle ORM)](#36-data-schema--migrations-drizzle-orm)
   - [3.7 Background Workers & Transactional Outbox](#37-background-workers--transactional-outbox)
4. [Comparative Overlap Analysis](#4-comparative-overlap-analysis)
   - [4.1 Overlapping Capabilities Inventory & Matrix](#41-overlapping-capabilities-inventory--matrix)
   - [4.2 Data Entity Mapping & Alignment Table](#42-data-entity-mapping--alignment-table)
   - [4.3 Provisioning Workflow Divergences](#43-provisioning-workflow-divergences)
   - [4.4 Administrative Dashboards Comparison](#44-administrative-dashboards-comparison)
5. [In-Depth Evaluation of 5 Synchronization Strategies](#5-in-depth-evaluation-of-5-synchronization-strategies)
   - [5.1 Strategy 1: Event-Driven Sync & Webhooks (Transactional Outbox)](#51-strategy-1-event-driven-sync--webhooks-transactional-outbox)
   - [5.2 Strategy 2: Direct API Integration & Gateway (Synchronous REST/BFF)](#52-strategy-2-direct-api-integration--gateway-synchronous-restbff)
   - [5.3 Strategy 3: Single Sign-On (SSO) and Federated Identity (Better-Auth OIDC)](#53-strategy-3-single-sign-on-sso-and-federated-identity-better-auth-oidc)
   - [5.4 Strategy 4: Shared vs. Separate Data Stores](#54-strategy-4-shared-vs-separate-data-stores)
   - [5.5 Strategy 5: System Consolidation / Strangler Fig Pattern](#55-strategy-5-system-consolidation--strangler-fig-pattern)
   - [5.6 Comprehensive Trade-Off Evaluation Matrix](#56-comprehensive-trade-off-evaluation-matrix)
6. [Recommended Target Architecture](#6-recommended-target-architecture)
   - [6.1 Architectural Rationale](#61-architectural-rationale)
   - [6.2 System Architecture Diagram](#62-system-architecture-diagram)
   - [6.3 Component Roles & Boundaries](#63-component-roles--boundaries)
   - [6.4 Event Contract Specifications](#64-event-contract-specifications)
7. [Phased Implementation Roadmap](#7-phased-implementation-roadmap)
   - [Phase 1: Operational Interoperability & Identity Bridge (Weeks 1–3)](#phase-1-operational-interoperability--identity-bridge-weeks-13)
   - [Phase 2: Hosting & Domain Lifecycle Convergence (Weeks 4–6)](#phase-2-hosting--domain-lifecycle-convergence-weeks-46)
   - [Phase 3: Domain Module Migration into Monorepo (Weeks 7–10)](#phase-3-domain-module-migration-into-monorepo-weeks-710)
   - [Phase 4: Full Consolidation & Monorepo Retirement (Weeks 11–12)](#phase-4-full-consolidation--monorepo-retirement-weeks-1112)
8. [Risk Analysis, Mitigations & Operational Invariants](#8-risk-analysis-mitigations--operational-invariants)
   - [8.1 Critical Pre-Sync Blockers & Code Defect Catalog](#81-critical-pre-sync-blockers--code-defect-catalog)
   - [8.2 Architectural Hardening & Resilience Invariants](#82-architectural-hardening--resilience-invariants)
   - [8.3 Operational Invariants & Data Integrity Guards](#83-operational-invariants--data-integrity-guards)
9. [Independent Verification Guide](#9-independent-verification-guide)

---

## 1. Executive Summary

Bazion operates across two critical codebases that currently fulfill complementary halves of an enterprise technology operation:

1. **`D:\bazionweb`** is the established commercial front-office, multi-market pricing engine, client delivery tracking system, and agency billing manager. Built with Next.js 15, NestJS 10, Prisma 5.22, and PostgreSQL, it excels at marketing services, building custom quotes, processing Daraja M-Pesa and Paystack card payments, issuing commercial invoices (with Kenya Revenue Authority [KRA] tax compliance available when `COMPANY_VAT_REGISTERED` is toggled), provisioning project delivery roadmaps, and managing support ticketing. Notably, BazionWeb's billing engine defaults `COMPANY_VAT_REGISTERED` to `false` (commit `defd14ea` stripped VAT notices from invoices and client portals unless explicitly enabled).
2. **`d:\bazionweb-platform\bazionwebs-platform`** is the modern multi-tenant SaaS application engine. Built as a Turborepo monorepo with Next.js 16, Fastify 5, Drizzle ORM 0.45, Better-Auth 1.7, and PostgreSQL, it provides robust software multi-tenancy with forced Row-Level Security (RLS), fail-closed dedicated database connection routing, DNS TXT challenge domain verification, containerized Dokploy deployment reconciliation, and composable vertical solutions (such as Church Ministry and E-Commerce).

Neither repository can unilaterally replace the other today without extensive disruption:
- `D:\bazionweb` lacks SaaS multi-tenant isolation, composable tenant module runtime engines, and automated dynamic domain verification.
- `bazionwebs-platform` lacks commercial sales pages, multi-currency price books, guest pay-first checkout flows, KRA tax compliance options, client milestone management, customer credential vaults, and support desks.

This report delivers a comprehensive audit of both codebases, evaluates five distinct synchronization architectures, and defines an authoritative, phased **Hybrid Strangler Fig Strategy**. Under this strategy:
- **Phase 1** bridges identity via **Better-Auth OpenID Connect (OIDC)** and connects tenant provisioning asynchronously via a **Transactional Outbox Event Sync**.
- **Phase 2** unifies Dokploy container orchestration and dynamic domain routing under the platform control plane.
- **Phase 3** extracts agency commercial logic (`pricing`, `billing`, `support`, `vault`, `projects`) into reusable monorepo packages (`@bazion/*`).
- **Phase 4** unifies the public storefront and client portal within the monorepo, retiring `D:\bazionweb` cleanly with zero customer disruption.

---

## 2. Comprehensive Technical Audit of `D:\bazionweb`

### 2.1 Architecture, Tech Stack, & Monorepo Structure

`D:\bazionweb` is structured as a two-tier full-stack application managed via **npm workspaces** (`package.json:1-23`):

```
D:\bazionweb/
├── apps/
│   ├── web/                    # Next.js 15.5.29 App Router Frontend
│   │   ├── src/app/(public)    # Public Marketing, Catalog & Quote Builder
│   │   ├── src/app/portal      # Authenticated Client Self-Service Portal
│   │   ├── src/app/admin       # Super Admin Operations Console
│   │   └── src/app/api/v1      # Same-origin proxy to NestJS backend
│   └── api/                    # NestJS 10.3.0 REST Backend
│       ├── src/modules/        # Domain modules (auth, billing, clients, etc.)
│       └── prisma/             # Prisma ORM Schema & Migrations
├── infrastructure/docker/      # Local development compose (Postgres, Redis, MailHog)
├── docker-compose.dokploy.yml  # Dokploy + Traefik v3 Production Orchestration
└── services and prices.md      # Commercial pricing documentation
```

#### Core Dependencies & Runtime Versions
- **Web Frontend (`apps/web`)**: Next.js 15.5.29, React 18.3.0, Tailwind CSS 3.4.0 (`@tailwindcss/typography`), TanStack React Query 5.104.5, Zustand 5.0.16 (cart and client state), Axios 1.7.0, Lucide React 0.383.0, Recharts 2.12.0, Zod 4.6.7, date-fns 4.4.0.
  - *Frontend Dependency Lockfile Note*: In `D:\bazionweb` commit `af533ec8` (Nov 11, 2026), `apps/web/package-lock.json` was deleted and must be regenerated (`npm install --package-lock-only` in `apps/web`) prior to executing web builds or CI/CD frontend validation.
- **API Backend (`apps/api`)**: NestJS 10.3.0, TypeScript 5.5.0, Prisma ORM 5.22.0 (`@prisma/client`), PostgreSQL 16 (Neon managed database), Redis 7 (Alpine), Keycloak 23 (OIDC/JWKS integration via `jwks-rsa` 3.1.0) with local HS256 JWT fallback (`jsonwebtoken` 9.0.2), Nodemailer 10.1.7, Helmet 7.1.0, Throttler 5.1.0, Terminus 10.2.0, Swagger 7.3.0.

#### Production Deployment & Traefik Routing
Production deployment is governed by `docker-compose.dokploy.yml` (lines 1–188) managed through Dokploy:
- **`bazionweb-web`**: Next.js container listening on port 3000. Traefik routes public traffic and proxies `/api/v1/*` to the backend.
- **`bazionweb-api`**: NestJS container listening on port 4000. Configured with dual database connection strings:
  - `DATABASE_URL`: Connection-pooled URL via PgBouncer for transaction workloads.
  - `DATABASE_URL_UNPOOLED`: Direct PostgreSQL connection URL for Prisma schema migrations and advisory locks.
- **`redis`**: Redis 7 Alpine with password authentication, append-only file persistence (`--appendonly yes --appendfsync everysec`), and 1536MB memory cap with LRU eviction (`allkeys-lru`).
- Traefik v3 handles automatic TLS certificate issuance via Let's Encrypt with automated HTTP-01 challenge completion.

---

### 2.2 Public Customer-Facing Experience & Service Catalog

The customer-facing application is organized under `apps/web/src/app/(public)`:

1. **Homepage (`/`)**: Features hero value propositions, interactive product showcases, customer proof points, testimonials, FAQ, and footer navigation.
2. **Service Catalog Pages (`/services/*` — 11 Subpages)**:
   - `/services/websites`: Corporate and business website development.
   - `/services/ecommerce`: E-commerce stores with mobile money & card checkout.
   - `/services/custom-systems`: Web portals, SaaS MVPs, and operations dashboards.
   - `/services/development`: Bespoke full-stack software, mobile-ready web apps, and API engineering.
   - `/services/hosting`: Managed cloud hosting infrastructure.
   - `/services/maintenance`: Retainers, security updates, and SLA uptime management.
   - `/services/managed-technology`: Dedicated fractional CTO and managed IT engineering.
   - `/services/performance`: Core Web Vitals optimization and database query acceleration.
   - `/services/security`: Hardening, vulnerability auditing, and penetration prevention.
   - `/services/support`: 24/7 technical helpdesk and SLA incident response.
   - `/services/specialized-services`: Architectural advisory, legacy refactoring, and third-party integrations.
3. **Solutions Hub (`/solutions` & `/solutions/[slug]`)**: Governed by `apps/web/src/lib/solutionsData.ts`, which defines **6 distinct industry verticals**:
   - `smes`: Small & Medium Enterprises seeking streamlined digital operations and customer capture.
   - `churches`: Churches and faith ministries needing sermon libraries, tithing/giving, and event management.
   - `education`: Schools, training academies, and edtech platforms needing student portals and course catalogs.
   - `ngos`: Non-profit organizations, charities, and donor-funded foundations needing impact storytelling and transparent donations.
   - `startups`: Tech startups and fast-growth ventures requiring rapid MVP development and scalable architectures.
   - `professional-services`: Law firms, consultancies, accounting practices, and agencies requiring client intake and document portals.
4. **Interactive Stack & Quote Builder (`/quote`)**: Multi-step client builder allowing prospective customers to select base packages, add-ons, extra pages, custom domains, hosting billing cycles, and care tiers with live instant cost computation backed by `POST /api/v1/pricing/quote`.
5. **E-Commerce Store & Cart (`/store` & `/cart`)**: Digital catalog browsing, item configuration, persistent cart state stored via Zustand (`useCartStore`), and checkout initiation.
6. **Content Marketing & Proof**:
   - `/case-studies` and `/case-studies/[slug]`: Project case studies with tech stack and metrics.
   - `/blog` and `/blog/[slug]`: Engineering, digital marketing, and tech articles.
   - `/about`, `/careers`, `/contact`, `/faq`, `/process`.
7. **Legal Compliance Pages (`/legal/*`)**: `/legal/terms`, `/legal/privacy`, `/legal/sla`, `/legal/cookies`, `/legal/dpa` (Data Protection Agreement).
8. **Public Document Authenticity Verifier (`/verify`)**: Public registry checking authenticity of invoices, payment receipts, and commercial proposals by document reference code or Code-128 barcode hash via `GET /api/v1/invoices/verify/:reference`.

---

### 2.3 Advertised Packages & Commercial Multi-Market Pricing Engine

The commercial pricing engine is governed by `apps/api/src/modules/pricing/canonical-catalog.ts`, `prisma/seed.ts`, and `services and prices.md`:

#### Dual-Market Multi-Currency Architecture & VAT Reality
- **Kenya (`KE`) Market**: Currency `KES` (Kenyan Shilling), prices configured with VAT metadata (`taxIncludedInPrice: true`), rounding rule `INTEGER`.
- **Global (`GLOBAL`) Market**: Currency `USD`, prices exclusive of VAT (`taxIncludedInPrice: false`, zero-rated digital export), positioned 40–60% below US/UK agency benchmarks.
- **KRA 16% VAT Enforcement Reality (`billing.service.ts:1879-1895`)**: In code, `COMPANY_VAT_REGISTERED` defaults to `false`. BazionWeb does **not** charge 16% KRA VAT or title documents as "Tax Invoice" unless explicitly enabled via environment configuration. Historical commit `defd14ea` explicitly stripped VAT notices from client invoices, payment receipts, and portal views. In standard operation, invoices are titled "Invoice" rather than "Tax Invoice", and tax amounts evaluate to zero.

#### Four Product Families

| Family | Package Slug | Kenya Price (KES) | Global Price (USD) | Scope / Deliverables | Delivery SLA |
|---|---|---|---|---|---|
| **Websites** | `website-launch` | KES 25,000 | USD $450 | Up to 5 pages, responsive, SSL, analytics, 1 revision round, 14-day post-launch support | 5–10 days |
| | `website-business` | KES 90,000 | USD $950 | Up to 10 pages, CMS, blog/news, lead forms, technical SEO, sitemap | 10–18 days |
| | `website-professional` | KES 160,000 | USD $1,750 | Up to 20 pages, custom UI/UX, advanced integrations, multi-language readiness | 20–30 days |
| | `website-enterprise` | From KES 320,000 | From USD $3,600 | High-concurrency architecture, bespoke design system, dedicated SLA | Custom |
| **E-Commerce** | `ecommerce-starter` | KES 90,000 | USD $890 | Up to 50 products, M-Pesa + card checkout, automated order emails | 10–15 days |
| | `ecommerce-business` | KES 175,000 | USD $1,650 | Up to 500 products, inventory tracking, coupon engine, shipping rules | 20–30 days |
| | `ecommerce-enterprise` | From KES 320,000 | From USD $3,600 | Unlimited catalog, ERP/CRM sync, custom multi-currency checkout | Custom |
| **Custom Systems** | `service-admin-hub-starter` | KES 45,000 | USD $490 | Retrofit standalone admin media hub | 5–7 days |
| | `service-admin-hub-corporate` | KES 85,000 | USD $890 | Multi-user corporate operations desk | 10–14 days |
| | `custom-tier-1` | From KES 180,000 | From USD $2,200 | Client portals & API gateways | 4–6 weeks |
| | `custom-tier-2` | From KES 350,000 | From USD $3,900 | SaaS MVP & internal workflow tools | 6–10 weeks |
| | `custom-tier-3` | From KES 750,000 | From USD $8,500 | Enterprise core platforms & microservices | 10–16 weeks |
| **Managed Hosting** | `host-essential` | KES 4,500/yr | USD $49/yr | 0.5 CPU, 256MB RAM, 10GB storage, 1 mailbox | Annual |
| | `host-business` | KES 8,500/yr | USD $99/yr | 1.0 CPU, 512MB RAM, 30GB storage, 5 mailboxes, dedicated DB credentials | Annual |
| | `host-pro` | KES 15,000/yr | USD $189/yr | 2.0 CPU, 1024MB RAM, 75GB storage, 10 mailboxes, Redis caching | Annual |
| | `host-cloud` | KES 30,000/yr | USD $300/yr | 4.0 CPU, 4096MB RAM, 200GB storage, unlimited mailboxes, dedicated cluster | Annual |
| **Care Plans** | `care-essential` | KES 5,000/mo | USD $75/mo | 99.9% uptime SLA, 1-hr P1 response, 30-day backups, core updates | Monthly/Annual |
| | `care-business` | KES 10,000/mo | USD $150/mo | 99.95% uptime SLA, 30-min P1 response, 60-day backups, security hardening | Monthly/Annual |
| | `care-professional` | KES 20,000/mo | USD $300/mo | 99.99% uptime SLA, 15-min P1 response, 90-day backups, unlimited updates | Monthly/Annual |
| | `care-enterprise` | KES 40,000/mo | USD $400/mo | 99.99% uptime SLA, 5-min P1 response, 365-day backups, dedicated manager | Monthly/Annual |

Hosting billing cycles feature graduated term discounts: Quarterly (-5%), Semi-Annual (-10%), Annual (-25%), Biennial (-32%), Triennial (-40%).

---

### 2.4 Checkout Workflows & Billing Architecture

Located in `apps/web/src/components/billing/SubscriptionCheckout.tsx`, `apps/api/src/modules/billing/billing.service.ts`, `payment-settlement.service.ts`, and `webhooks.controller.ts`:

#### Three Payment Tracks
1. **Track A — Card Checkout (Paystack)**:
   - Initiated via `POST /api/v1/invoices/guest/subscribe/paystack` (guest) or `POST /api/v1/invoices/subscribe/paystack` (authenticated).
   - Generates Paystack hosted checkout session with transaction reference `BZW-<timestamp>-<hash>`.
   - Records currency conversion rate when billing in USD or KES.
2. **Track B — Mobile Money STK Push (M-Pesa via Paystack / Safaricom Daraja)**:
   - Initiated via `POST /api/v1/invoices/guest/subscribe/mpesa` or `POST /api/v1/invoices/subscribe/mpesa`.
   - Phone numbers are validated and normalized to E.164 format (`2547XXXXXXXX`).
   - Dispatches an automated STK prompt directly to the customer's mobile device.
   - Frontend polls `GET /api/v1/invoices/payments/:trackingId/status` with exponential backoff.
3. **Track C — Corporate B2B Wire / Bank Transfer**:
   - Initiated via `POST /api/v1/invoices/guest/corporate-invoice/bank-transfer`.
   - Creates an `Invoice` with status `SENT` and assigns a unique `paymentReference`.
   - Emits Wise multi-currency bank wire instructions (USD, EUR, GBP) or local Kenyan bank details.
   - *Wise Integration Reality (`billing.service.ts:1137-1141`)*: `WiseReceivingAccount` records (e.g. `wiseAccountId: 'MANUAL-...'`) are used strictly as static database templates to display manual wire remittance instructions (IBAN, BIC/SWIFT, account numbers, branch codes) to customers. There is **no live Wise API integration** (no automated transaction polling, inbound webhook callbacks, or programmatic payouts). Invoices are manually cleared by staff via `PATCH /api/v1/invoices/:id/mark-paid`.

#### Webhook Settlement State Machine & Outbox Hook Point Analysis
- Webhooks arrive at `POST /api/v1/webhooks/paystack` (validated with HMAC-SHA512 `x-paystack-signature`) and `POST /api/v1/webhooks/daraja` (token secret verification).
- Idempotency guard: Transactions are logged in `PaymentLog` under idempotency key `PAYSTACK_<reference>`. Duplicate webhook events return HTTP 200 immediately without reprocessing.
- Amount verification: Compares callback amount against expected invoice balance.
- On successful settlement:
  1. `Invoice.status` transitions from `SENT`/`DRAFT` to `PAID` with `paidAt: new Date()`.
  2. `Subscription` is activated (`status: ACTIVE`, `currentPeriodStart: now`, `currentPeriodEnd` computed from cycle duration).
  3. `Client.status` transitions from `TRIAL` to `ACTIVE`.
  4. Proposal deposit payments trigger automated project roadmap creation.
- **Critical Outbox Hook Point Gap (`BillingService.markPaid` vs. `PaymentSettlementService`)**:
  - In `D:\bazionweb`, `BillingService.markPaid` (`billing.service.ts:1875`) explicitly emits the `invoice.paid` event.
  - However, automated payment settlement via Paystack webhooks, Safaricom Daraja STK callback, and subscription cron renewal executes directly inside `PaymentSettlementService` (`payment-settlement.service.ts`), which settles invoices directly via Prisma transactions *without* calling `BillingService.markPaid` or emitting `invoice.paid`.
  - *Architectural Directive*: When implementing the Transactional Outbox (`sync_outbox`) in Phase 1, outbox event insertions (`tenant.provision_requested`, `subscription.status_changed`) **must be written directly inside `PaymentSettlementService` Prisma transactions**. Relying on `BillingService.markPaid` or NestJS `invoice.paid` event listeners would fail to capture the vast majority of real-world automated payments.
- **No Auto-Dunning / Auto-Suspension Cron Yet**:
  - `D:\bazionweb`'s `markOverdueInvoices` scheduled task only sets invoice status to `OVERDUE` and creates administrative notification alerts.
  - It contains **no automated dunning progression, no grace-expiry calculation, and no automated tenant suspension logic**. Automated grace-expiry suspension must be built in `D:\bazionweb` before wiring renewal non-payment → platform tenant suspension.

---

### 2.5 Client Provisioning & Tenancy Isolation

Documented in `apps/api/src/modules/clients/clients.service.ts`, `apps/api/src/modules/projects/project-provisioning.util.ts`, and `apps/api/src/modules/hosting/`:

#### Guest-to-Client Account Claim Flow
To minimize friction and prevent cart abandonment, `D:\bazionweb` implements a guest pay-first onboarding architecture:
1. Unauthenticated buyer selects a service and enters minimal contact details.
2. `resolveGuestIdentity` creates an unpaid `User` (`passwordHash: null`, `role: CLIENT`) and a linked `Client` record (`status: TRIAL`).
3. Upon payment settlement, `PaymentSettlementService` mints a single-use 72-hour cryptographic claim token (`claim_<base64url>`, hashed via SHA-256 into the `RefreshToken` table).
4. The client receives an email link to `/portal/claim?token=<token>&email=<email>`.
5. At `POST /api/v1/auth/claim-account`, the client submits their new password. The API verifies the token, hashes the password via `scrypt`, issues JWT tokens, and flips client status to `ACTIVE`.

#### Administrative Manual Provisioning
- Staff endpoint `POST /api/v1/clients/manual-provision` atomically creates client organization, user account, initial project workspace, active subscription, and immediate 72-hour claim link for offline contracts.
- Endpoint `POST /api/v1/clients/:id/resend-invite` revokes previous tokens and generates a fresh 72-hour claim link.

#### Automated 5-Milestone Project Delivery Roadmap
When an invoice for a proposal deposit (`BZ-*`) settles, `provisionProjectFromProposalInvoice` parses line items and creates a `Project` with 5 standardized `ProjectTask` sprint milestones:
1. *Kickoff Deposit & Architecture Discovery* (marked `DONE`, 20% progress).
2. *Information Architecture & UI/UX Wireframes* (`IN_PROGRESS`).
3. *Full Frontend Implementation & CMS Integration* (`TODO`).
4. *Staging QA, Performance Benchmarking & Security Hardening* (`TODO`).
5. *Production Domain Cutover, SSL Handshake & Go-Live* (`TODO`).

#### Tenancy Isolation Architecture
- **Compute Isolation**: Dokploy provider (`dokploy.provider.ts`) provisions Docker containers (`bazion-<hostingId>`) inside client project groups (`client-<clientId>`) enforcing Linux cgroups resource limits:
  - CPUs limit & reservation.
  - Memory limit, memory reservation, swap cap, and process count limit (`pidsLimit`).
- **Server Capacity Headroom Enforcement**: `server-topologies.config.ts` prevents provisioning on control plane nodes, validating tenant density thresholds and RAM headroom prior to container launch.
- **Database Tenancy & DDL In-Memory Limitation**: `DatabaseTenancyHelper` (`apps/api/src/modules/hosting/database/database-tenancy.helper.ts`) generates SQL scripts in memory (returning string SQL representations for creating user roles, databases, and permissions) rather than executing remote PostgreSQL DDL over active database connections.
- **Hosting Account & Dokploy Workload ID Gap**: `HostingAccount` does not persist Dokploy workload IDs (`applicationId` or `composeId`). In `diagnostics.service.ts:378-389`, the fleet remediation routine calls `dokploy.bindDomain` without an `applicationId` and swallows errors in a generic try-catch block, meaning container-to-domain bindings cannot be automatically reconciled without manual operator lookup.
- **Cache Isolation**: `redis-tenancy.helper.ts` isolates Redis instances using key prefixes (`tenant:<domain>:*`) and Redis 6+ ACL permissions (`ACL SETUSER ... ON >password ~tenant:<domain>:* +@all`).
- **Email Routing & DNS**: `email-routing.helper.ts` generates Cloudflare Email Routing or Google Workspace DNS records (MX, SPF, DKIM, DMARC) enforced against plan inbox limits.
- **Domain & SSL**: Automated Let's Encrypt TLS issuance via Traefik. Daily 04:00 UTC cron task performs socket handshakes (`tls.connect`) to detect certificate expiration within 30 days.

---

### 2.6 Client Self-Service Dashboards (9 Modules)

The client self-service portal is organized under `apps/web/src/app/portal/*` and backed by `usePortalData.ts`:

1. **Workspace Overview (`/portal`)**: Hero welcome banner, active project completion gauge, service standing indicator, real-time SLA response countdown, and interactive onboarding checklist (`ClientOnboardingChecklist`).
2. **Delivery Roadmap & Milestones (`/portal/milestones`)**: Task progression tracking, sprint deliverables, staging URL inspection, and client sign-off action (`POST /api/v1/projects/:id/tasks/:taskId/sign-off`).
3. **Sovereign Digital Assets (`/portal/assets`)**: Server node details, IP addresses, PHP versions, disk storage meter (MB), bandwidth consumption meter (GB), and backup download triggers.
4. **Support Operations (`/portal/support`)**: Ticket submission with urgency selection (P1 Critical to P4 Low), threaded communication history (`/api/v1/tickets/:id/comments`), and SLA breach countdowns.
5. **Billing & Financials (`/portal/invoices`)**: Invoice ledger, payment status badges (`PAID`, `SENT`, `OVERDUE`), instant settlement via M-Pesa or Card, and on-demand official KRA PDF invoice download (`GET /api/v1/invoices/:id/pdf/download`).
6. **Packages & Services (`/portal/packages`)**: Current subscription details, billing cycle renewal dates, and plan tier upgrade selector.
7. **Encrypted Credential Vault (`/portal/vault`)**: Client-side credential repository allowing clients to securely deposit sensitive infrastructure keys (domain registrars, SSH access, CMS admin logins, payment gateway credentials, database passwords). Encrypted using **AES-256-GCM** with masked hints; audit-logged decrypt-and-reveal action (`POST /api/v1/vault/:id/reveal`).
8. **Account & Security Settings (`/portal/account`)**: Profile details, business tax PIN (KRA), password rotation, and active session management.
9. **Onboarding & Verification (`/portal/claim` & `/portal/onboard`)**: Single-use token claim interface and profile completion.

---

### 2.7 Super Admin Operations Center & Troubleshooting Suite

The agency operations console is located in `apps/web/src/app/admin/*` and backed by `useAdminData.ts` and `diagnostics.service.ts`:

#### Core Administration Modules
- **Executive Operations Center (`/admin`)**: Active client count, Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), critical P1/P2 tickets count, fleet uptime percentage, SLA breach alerts table, and real-time audit stream.
- **Client CRM (`/admin/clients`)**: Directory with status filtering (`ACTIVE`, `TRIAL`, `SUSPENDED`, `CANCELLED`), manual onboarding modal, claim link re-issuance, and subscription links.
- **Hosting Fleet Manager (`/admin/hosting`)**: Container inventory, server allocation, SSL certificate expiration dates, and automated backup logs.
- **Financial & Subscription Management (`/admin/invoices`)**: Invoice search, manual invoice generation, payment audit logs, and manual bank wire clearance (`markPaid`).
- **Commercial Multi-Market Manager (`/admin/markets`)**: Dynamic price book management (`KE-2026-v1`, `GLOBAL-2026-v1`), currency exchange rates, tax rules, and coupon adjustments.
- **Support Ticket Triage Desk (`/admin/tickets`)**: Ticket queue, staff assignment, priority elevation, internal staff-only notes (`isInternal: true`), and SLA tracking.
- **Security & Compliance Audit (`/admin/security`)**: Append-only audit trail recording user actions, IP addresses, user agents, and resource modifications.

#### Troubleshooting Suite & View-As Impersonation Sandbox (`/admin/troubleshooting`)
- **View-As Client Impersonation Sandbox & Mutation Vulnerability**:
  - Staff selects a client and requests impersonation.
  - Backend issues a scoped 15-minute JWT token with `isSandbox: true` and `impersonatedBy: staffUser.email`.
  - Opens the client portal in an isolated tab. The portal stores this token strictly in `sessionStorage` (preventing cross-tab `localStorage` event contamination) and renders an audited yellow sandbox warning banner with an immediate termination button.
  - *Critical View-As Sandbox Mutation Gap*: `isSandbox` JWTs lack server-side NestJS HTTP mutation blocking (`POST`/`PUT`/`PATCH`/`DELETE`). Although the frontend UI presents a sandbox banner and limits navigation, any direct API request or automated script with this JWT can mutate production data. These tokens must be hardened with server-side read-only guards in NestJS and must **never** be forwarded across SSO to `bazionwebs-platform`.
- **Six One-Click Transactional Remediation Workstations**:
  1. *Orphan & Unapplied Payments*: Scans for received payments without linked invoices; provides `LINK_AND_SETTLE` or `CREDIT_CLIENT`.
  2. *Fleet DNS & SSL Misconfigurations*: Scans domain DNS records and TLS handshakes; provides `REFRESH_SSL` and `REISSUE_SSL`.
  3. *Failed Webhook Retries*: Surfaces unhandled payment logs; provides batch replay (`/remediate/webhooks/retry-all`).
  4. *Unsynced Invoice Totals*: Detects line-item vs. total discrepancies; provides `SYNC_FROM_PAYMENTS` and `RECALCULATE_FROM_ITEMS`.
  5. *Client Credential & Access Lockouts*: Identifies suspended clients and passwordless lockouts; provides `UNLOCK_ACCOUNT` and `GENERATE_RESET_LINK`.
  6. *Suspended Domain States*: Identifies stuck provisioning states; provides `UNSUSPEND` and `NORMALIZE_STATUS`.
- **Proactive Intelligence Scanner**:
  - Backend endpoint `GET /api/v1/admin/diagnostics/proactive-scan` continuously evaluates 4 anomaly rules:
    1. `SSL_EXPIRING_7D`: Certificates expiring within 7 days.
    2. `WEBHOOK_BURST`: $\ge 3$ webhook failures within 60 minutes.
    3. `UNAPPLIED_PAYMENT`: Orphan payments awaiting allocation.
    4. `EXPIRED_QUOTE_DEPOSIT`: Pending deposit invoices for expired quotes.
  - Surfaces actionable anomaly cards with direct one-click remediation buttons in the admin UI.

---

### 2.8 Database Schema & Entity Relationships (Prisma 5.22)

The data model is defined in `prisma/schema.prisma` (lines 1–837). All primary keys use UUIDs (`@default(uuid()) @db.Uuid`), all models maintain `createdAt`/`updatedAt` timestamps, and core operational entities support soft deletion (`deletedAt`).

#### Catalog of 26 Models and 20 Enums

The schema contains 26 models and **20 Prisma enums** (`UserRole`, `ClientStatus`, `PlanTier`, `BillingCycle`, `SubscriptionStatus`, `PaymentProvider`, `PaymentMethodType`, `PaymentStatus`, `ProjectStatus`, `TaskStatus`, `TaskPriority`, `HostingStatus`, `TicketPriority`, `TicketStatus`, `TicketCategory`, `InvoiceStatus`, `BackupType`, `BackupStatus`, `NotificationType`, `VaultCategory`):

```
                                  +-------------------+
                                  |       User        |
                                  |  (password, MFA)  |
                                  +---------+---------+
                                            | 1:1
                                            v
                                  +-------------------+       +-------------------+
                                  |      Client       |------>|       Plan        |
                                  | (taxPin, status)  |       | (SLAs, features)  |
                                  +----+----+----+----+       +-------------------+
                                       |    |    |
                   +-------------------+    |    +-------------------+
                   | 1:N                    | 1:N                    | 1:N
                   v                        v                        v
         +-------------------+    +-------------------+    +-------------------+
         |   Subscription    |    |      Project      |    |  HostingAccount   |
         | (renewal dates)   |    | (completion rate) |    | (cgroups, quotas) |
         +---------+---------+    +---------+---------+    +---------+---------+
                   |                        |                        |
                   v 1:N                    v 1:N                    v 1:N
         +-------------------+    +-------------------+    +-------------------+
         |      Invoice      |    |    ProjectTask    |    |      Backup       |
         | (KRA tax, PDF)    |    |  (5 sprint steps) |    |  (daily/weekly)   |
         +---------+---------+    +-------------------+    +-------------------+
                   |
                   v 1:N
         +-------------------+
         |    PaymentLog     |
         | (idempotency key) |
         +-------------------+
```

1. **Authentication & Identity**:
   - `User`: User profile, credentials (`passwordHash` with scrypt, `keycloakId`), role enum (`SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `CLIENT`), MFA flag (`mfaEnabled`), login timestamps.
   - `RefreshToken`: Rotating hashed refresh tokens (`tokenHash` SHA-256) and temporary 72h claim tokens.
2. **Client Organization & Commercial Accounts**:
   - `Client`: Business name, contact name, email, phone, physical address, KRA tax PIN, status (`ACTIVE`, `SUSPENDED`, `CANCELLED`, `TRIAL`), `onboardedAt`, foreign key to `Plan`.
   - `Plan`: Tier definition (`STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`), USD and KES pricing, SLA response minutes (P1/P2/P3), feature toggles.
   - `Subscription`: Subscription state (`ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`, `TRIAL`), provider, billing cycle (`MONTHLY`, `QUARTERLY`, `SEMI_ANNUALLY`, `ANNUAL`, `BIENNIAL`, `TRIENNIAL`), renewal dates, dunning counters.
3. **Billing, Payments & Banking**:
   - `Invoice`: Invoice number (`INV-KE-*`, `INV-USD-*`), amount, currency, status (`DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`), due date, paid date, line items JSON, PDF URL.
   - `PaymentLog`: Idempotency key, provider (`INTASEND`, `PAYSTACK`, `WISE`, `MANUAL_BANK_TRANSFER`, `DARAJA`), method (`MPESA`, `CARD`, `BANK_TRANSFER`), amount (Decimal 12,2), currency, raw payload JSON.
   - `WiseReceivingAccount`: Multi-currency manual remittance template accounts (USD, EUR, GBP) storing static bank details (`wiseAccountId: 'MANUAL-...'`) for B2B bank wire instructions; no live Wise API integration exists.
4. **Project Workspaces & Milestones**:
   - `Project`: Project name, client link, status (`PLANNING`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`, `ON_HOLD`), completion percentage, staging and production URLs.
   - `ProjectTask`: Milestone tasks, assignee, status (`TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`), priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), sort order, completion timestamps.
5. **Infrastructure & Hosting**:
   - `HostingAccount`: Domain, server node, plan tier, status (`ACTIVE`, `SUSPENDED`, `PROVISIONING`, `MIGRATING`, `DECOMMISSIONED`), SSL expiry, disk usage, bandwidth, IP address, PHP version.
   - `Backup`: Automated backups linked to hosting accounts (`DAILY_INCREMENTAL`, `WEEKLY_FULL`, `MONTHLY_ARCHIVE`, `MANUAL`), status, size, storage path, checksum.
6. **Operations & Security**:
   - `Ticket`: Client support tickets, priority (`P1` to `P4`), status (`OPEN`, `IN_PROGRESS`, `PENDING_CLIENT`, `RESOLVED`, `CLOSED`), category, assignee, SLA breached flag.
   - `TicketComment`: Threaded discussion, author, staff internal flag (`isInternal`).
   - `VaultSecret`: Client secrets encrypted with AES-256-GCM (`encryptedValue`, `iv`, `authTag`, `maskedHint`), category (`DOMAIN_REGISTRAR`, `HOSTING_SSH`, `API_KEY`, etc.).
   - `AuditLog`: Append-only audit trail (`userId`, `action`, `resourceType`, `resourceId`, `oldValue`, `newValue`, `ipAddress`, `userAgent`).
   - `Notification`: System alerts, read status, notification type (`SSL_EXPIRY`, `BACKUP_FAILURE`, `INVOICE_DUE`, etc.).
7. **Commercial Multi-Market Pricing Engine (SSOT)**:
   - `Currency`: ISO codes, names, symbols, base currency flag, exchange rates to base.
   - `Market`: Market code (`KE`, `GLOBAL`, `EA`), active flag, VAT rate, tax included in price flag, rounding rule.
   - `TaxRule`: Market-specific tax regulations (e.g. KRA 16% VAT, zero-rated exports).
   - `PriceBook`: Versioned catalog (`KE-2026-v1`, `GLOBAL-2026-v1`), effective date range, status.
   - `Price`: Product SKUs mapped to PriceBooks with amounts, billing periods, and min/max boundaries.
   - `MarketAdjustment`: Promotional rules, percentage/fixed discounts, coupon codes.
   - `Proposal`: Cryptographically locked proposals (`BZ-*`), client email, line items JSON, total amount, status (`LOCKED`, `ACCEPTED`, `EXPIRED`).
   - `Lead`: Marketing inquiries and quote builder captures.
   - `PricingAuditLog`: Append-only audit trail for pricing catalog modifications.

---

### 2.9 API Surface & Security Middleware

NestJS endpoints are versioned under `/api/v1` and proxied by Next.js at `apps/web/src/app/api/v1/[...path]/route.ts`:

- **API Routes**:
  - `/api/v1/auth`: `login`, `logout`, `refresh`, `claim-link`, `claim-account`, `magic-link`, `magic-link/verify`, `change-password`, `forgot-password`, `reset-password`, `admin/set-password`.
  - `/api/v1/invoices`: List, find by ID, `guest/subscribe/paystack`, `guest/subscribe/mpesa`, `guest/corporate-invoice/bank-transfer`, `subscribe/paystack`, `subscribe/mpesa`, `corporate-invoice/bank-transfer`, `payments/:ref/status`, `:id/pay/mpesa`, `:id/pay/card`, `generate`, `:id/mark-paid`, `:id/pdf`, `:id/pdf/download`, `verify/:reference`, `proposals/:code`, `proposals/:code/accept`, `proposals/:code/pay/card`, `proposals/:code/pay/mpesa`.
  - `/api/v1/webhooks`: `paystack`, `daraja`.
  - `/api/v1/clients`: CRUD, `me`, `me/onboard`, `manual-provision`, `:id/resend-invite`, `:id/sync-onboarding`.
  - `/api/v1/hosting`: CRUD, `me`.
  - `/api/v1/projects`: CRUD, `me`, `:id/tasks/:taskId/sign-off`.
  - `/api/v1/tickets`: CRUD, `:id/comments`.
  - `/api/v1/vault`: CRUD, `:id/reveal`.
  - `/api/v1/pricing`: `markets`, `catalog`, `quote`, `audit`, `admin/price`, `admin/price-book`, `admin/tax-rule`, `admin/adjustment`.
  - `/api/v1/quotes`: `submit`, `calculate`.
  - `/api/v1/reports`: `me`, `client/:clientId`, `mrr`, `uptime`, `sla`.
  - `/api/v1/notifications`: Paginated list, `stream` (Server-Sent Events), `unread-count`, `:id/read`, `mark-all-read`.
  - `/api/v1/admin/diagnostics`: 18 endpoints covering suite overview, DNS/SSL inspection, webhook replay, invoice reconciliation, client access remediation, domain unsuspension, and proactive scan.
- **Security Middleware & Guards**:
  - `JwtAuthGuard`: Verifies HS256 tokens (`iss: bazionweb`) or RS256 JWKS tokens from Keycloak. Extracts user context and impersonation metadata (`impersonatedBy`, `isSandbox`).
  - `RolesGuard` (`@Roles(...)`): Enforces RBAC permissions across `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, and `CLIENT`.
  - `MfaGuard` (`@RequireMfa()`): Enforces two-factor authentication on financial mutations and pricing updates.
  - `SubscriptionGuard`: Protects client services (`/projects`, `/hosting`, `/tickets`, `/vault`), requiring an `ACTIVE` subscription or client status (automatically bypassed for staff impersonators).
  - Rate limiting via `@nestjs/throttler`: Hard throttles on payment endpoints (e.g. 5 requests/minute).

---

## 3. Architectural Audit of `bazionwebs-platform`

### 3.1 Tech Stack, Monorepo Structure & Build Orchestration

`bazionwebs-platform` is engineered as a modern **modular monorepo** governed by **Turborepo 2.5.8** and **pnpm 12.18.0** workspaces (`package.json:1-39`):

```
bazionwebs-platform/
├── apps/
│   ├── admin/          # Next.js 16.4.5 Platform Superadmin Application (Port 3001)
│   ├── api/            # Fastify 5.12.8 Central API & Hosting Worker (Port 4000/4100)
│   └── storefront/     # Next.js 16.4.5 Multi-Tenant Storefront & Tenant Admin (Port 3000/3100)
├── packages/           # 17 domain, contract, database, and infrastructure packages
├── modules/            # 9 manifest-backed functional modules
├── products/           # Canonical capability catalogs and commercial offerings
├── solutions/          # 9 industry solution blueprints
└── docs/               # System architecture and operational documentation
```

- **Runtime & Compilation**: Node.js 26 (`>=22.16.0`), TypeScript 5.9.3 with strict type checking and NodeNext module resolution.
- **Build Pipeline**: Turborepo manages `build`, `dev`, `typecheck`, `test`, and `lint` pipelines with deterministic remote-cache readiness.
- **Testing**: Vitest 5.1.0 for unit and integration suites; native Node.js test runner (`node --test`) for manifest and export verification scripts.

---

### 3.2 Applications and Shared Packages Breakdown

#### Applications
1. **`apps/admin` (Platform Control Plane)**: Next.js 16.4.5, React 19.2.0, port 3001. Dedicated platform operator control plane ("Bazion Superadmin Application"), strictly isolated from tenant domains.
2. **`apps/api` (Central Orchestrator)**: Fastify 5.12.8, port 4000 (or 4100 for GMFC profile). Houses REST endpoints, tenant database routing, Better-Auth handlers, and background hosting reconciler worker.
3. **`apps/storefront` (Multi-Tenant Runtime & Tenant Admin)**: Next.js 16.4.5, React 19.2.0, port 3000 (or 3100). Resolves tenant context dynamically from subdomain or custom domain; renders church ministry or e-commerce shop, and mounts tenant workspace administration under `/admin`.

#### Shared Packages (`packages/`)
- `@bazion/platform-contracts`: Branded types (`TenantId`, `UserId`), DB binding interfaces, secret resolvers, hosting lifecycle types.
- `@bazion/api-contracts`: Zod validation schemas for commerce products, carts, checkout, orders.
- `@bazion/church-ministry-contracts` & `@bazion/church-ministry-domain`: Pure ministry domain rules, sermon categories, event registrations, giving campaigns, contact messages.
- `@bazion/commerce-domain`: Pure commerce domain calculation, inventory reservation guards, payment settlement planners (zero HTTP/DB dependencies).
- `@bazion/database`: PostgreSQL schema via **Drizzle ORM 0.45.4**, SQL migration registry (17 numbered migrations), least-privilege role initialization scripts.
- `@bazion/auth`: Better Auth 1.7.17 integration, session management, organization plugins, RBAC permissions, tenant context resolution, security policies.
- `@bazion/platform-identity`: Tenant provisioning reconciliation port and reconciliation engine.
- `@bazion/deployment-dokploy`: Thin, secret-safe Dokploy Compose client implementing `TenantHostingProvider`.
- `@bazion/notifications`: Encrypted PostgreSQL notification outbox (AES-256-GCM), atomic leases, retries, dead letters, and supervised SMTP worker using Nodemailer.
- `@bazion/payments`: Safaricom Daraja M-Pesa STK Push client with phone number normalization, token verification, and transaction status polling.
- `@bazion/storage`: Tenant-scoped S3-compatible and local filesystem storage adapters with image content-type verification and path traversal protection.
- `@bazion/audit`: Append-only platform audit logging contract and PostgreSQL writer (`PostgresAuditEventWriter`).
- `@bazion/booking`, `@bazion/analytics`, `@bazion/ui`, `@bazion/website-contracts`, `@bazion/sme-website-template`, `@bazion/forms`, `@bazion/product-installations`.

---

### 3.3 Multi-Tenant Provisioning & Database Strategy

#### Two-Phase Tenant Provisioning Workflow
- Triggered via Better Auth's organization plugin (`packages/auth/src/server.ts:130-208`).
- Authorization guard: `canCreateClientOrganization(platformMember?.role, user.emailVerified)` ensures only verified platform operators (`platform_owner` or `platform_admin`) can provision organizations.
- Two-phase lifecycle hooks:
  1. `beforeCreateOrganization`: Inserts a row into `public.tenants` with `status = 'provisioning'` and reserves the unique tenant slug.
  2. `afterCreateOrganization`: Updates `public.tenants` with `auth_organization_id = org.id`, sets `status = 'active'`, seeds baseline `ministry_profiles`, `ministry_settings`, enables `church-ministry` in `tenant_module_entitlements`, and inserts a local dev domain `${slug}.localhost` in `tenant_domains`.
- **Module Catalog Defaults & Vertical Seeding Reality**:
  - `apps/api/src/modules/admin/module-catalog.ts` hardcodes `defaultEnabled: true` for three modules: `commerce`, `analytics`, and `church-ministry`.
  - Consequently, `afterCreateOrganization` currently seeds church-ministry profile tables and domain defaults for all newly created organizations, regardless of whether the buyer selected an SME corporate website, an e-commerce shop, or a custom application.
  - *Synchronization Pre-condition*: The provisioning hook must be parameterized to inspect the inbound package type from `tenant.provision_requested` and selectively enable vertical modules (`church-ministry` vs `commerce` vs SME websites), avoiding unwanted church schema seeding for commercial agency clients.
- Reconciliation Guard: `reconcileTenantProvisioning` in `@bazion/platform-identity` automatically detects and heals stalled or orphaned provisioning states.

#### Database Tenancy & Data Isolation Model
- **Shared Tier (Default)**:
  - Single PostgreSQL database with **Forced Row Level Security (RLS)** (`0001_initial.sql:145-159`):
    ```sql
    ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
    ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON <table_name>
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    ```
  - `withTenantTransaction(tenantId, callback)` sets `SET LOCAL app.tenant_id = <tenantId>` on every transaction.
- **Dedicated Tier**:
  - Controlled by `public.tenant_database_bindings` table (`0013_tenant_database_routing.sql:3-30`).
  - Fields: `tenant_id`, `tier` (`'shared' | 'dedicated'`), `state` (`'shared' | 'provisioning' | 'ready' | 'failed' | 'draining'`), `runtime_secret_ref`, `migration_secret_ref`, `schema_version`.
  - Credentials are never stored in database rows; references are resolved dynamically via `TenantDatabaseSecretResolver` (`apps/api/src/lib/database.ts:40-63`).
  - **Fail-Closed Behavior**: If a dedicated tenant's binding is incomplete, not ready, or missing registered migrations, requests fail with HTTP 503 (`TENANT_DATABASE_BINDING_NOT_READY`); queries *never* fall back to the shared database.
- **PostgreSQL Least-Privilege Roles**:
  - `bazion_migrator` (DDL ownership, runs migrations), `bazion_app` (Runtime DML on business tables, subject to forced RLS `NOBYPASSRLS`), `bazion_auth_runtime` (DML on dedicated `auth` schema only), `bazion_tenant_resolver` (Read-only access to tenant routing), `bazion_tenant_provisioner` (Provisioning mutations), `bazion_notification_enqueuer`, `bazion_notification_worker`, `bazion_hosting_reconciler`.

---

### 3.4 Custom Domain Routing & DNS Verification

- **Tenant Resolution Chain (`apps/api/src/lib/tenant-resolution.ts:4-46`)**:
  1. Explicit header/cookie (`x-bazion-tenant` / `bazion_tenant`) or query param (`?tenant=`).
  2. Subdomain extraction (e.g. `<tenant>.bazionweb.com` or `<tenant>.localhost`).
  3. Custom domain lookup via `tenant_domain_directory` security-barrier view (`status = 'active'` AND `verified_at IS NOT NULL`).
  4. Local development fallback to `DEFAULT_TENANT_ID` (disabled in production).
  - *Critical Security Vulnerability — Production Tenant Spoofing Bug (`apps/api/src/lib/tenant-resolution.ts:11-16`)*:
    `resolveTenantId` evaluates `explicitTenantSlugOrId` *before* host-based resolution (`cleanHost`) with **zero environment checks** (`NODE_ENV === 'production'`) or resolution mode constraints (`TENANT_RESOLUTION_MODE`). In production deployments, any arbitrary caller can inject an `x-bazion-tenant: <victim-id>` header or `?tenant=<victim-id>` query parameter, causing the API to resolve the request in the victim's tenant context. This must be immediately hardened by restricting explicit tenant overrides strictly to local development or to authenticated platform operators (`platform_owner`/`platform_admin`).
- **Custom Domain Lifecycle**:
  1. Operator registers custom domain via `POST /admin/platform/tenants/:tenantId/domains`, generating a cryptographic verification token hash.
  2. The tenant configures a DNS TXT challenge record.
     - *Verified Challenge Hostname Reality (`apps/api/src/modules/admin/domain-verification.ts:15,54`)*: The exact DNS TXT hostname verified by `domain-verification.ts` is `_bazionweb-challenge.<hostname>` (e.g., `_bazionweb-challenge.portal.example.com`), **not** `_bazion-challenge.<domain>`. Any operational runbook or DNS guidance issued to clients must mandate `_bazionweb-challenge.<hostname>` to ensure successful automated DNS query validation.
  3. Operator triggers verification: `verifyTenantDomainTxt` in `apps/api/src/modules/admin/domain-verification.ts` queries DNS TXT records using `node:dns/promises`.
  4. Upon verification, domain status transitions to `active` with timestamp.

---

### 3.5 Administrative Dashboards Architecture (Platform vs. Tenant)

Unlike the single-tier agency admin console in `D:\bazionweb`, `bazionwebs-platform` implements a strict **two-tier administrative separation**:

```
+-----------------------------------------------------------------------------+
|                           TWO-TIER ADMIN SEPARATION                         |
+-----------------------------------------------------------------------------+
| TIER 1: PLATFORM CONTROL PLANE (`apps/admin`)                               |
| Origin: platform.bazionweb.com (Port 3001)                                  |
| Audience: Platform Owner, Platform Admins, Support Staff                    |
| Scope: Global cross-tenant operations                                       |
| - Tenant Directory & Lifecycle (Active, Suspend, Soft-Close)                |
| - Ownership Transfer & Member Discovery                                     |
| - Dynamic Module Entitlements (Toggle 37 modules per tenant)                |
| - Custom Domain DNS TXT Verification Challenges                             |
| - Dokploy Hosting Container Provisioning & Reconciler Logs                  |
| - Append-Only Platform Audit Log Viewer                                     |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| TIER 2: TENANT WORKSPACE ADMIN (`apps/storefront/app/admin`)                |
| Origin: <tenant>.bazionweb.com/admin (Port 3000/3100)                       |
| Audience: Tenant Organization Owners, Admins, Editors, Catalog Managers    |
| Scope: Strictly isolated to current tenant context                          |
| - Tenant Storefront Settings & Theme Customization                          |
| - Team Members & Invitation Management                                      |
| - Commerce Catalog (Products CRUD, Stock Inventory, Orders)                 |
| - Church Ministry (Sermons, Events, Giving Campaigns, Contact Messages)    |
+-----------------------------------------------------------------------------+
```

#### Administrative Access Control & Identified Code Defects
- **Strict Role Gating**: `apps/admin` gates administrative routes strictly via `requirePlatformOwner` on critical operations, requiring operator accounts to hold top-level platform ownership.
- **Pre-existing Code Defects in Platform Admin & Troubleshooting Routes**:
  1. *Admin Audit Query Syntax Bug (`apps/api/src/modules/admin/routes.ts:510,523`)*: Parameter interpolation omits `$` prefixes in raw SQL queries (`ILIKE ${values.length}`, `LIMIT ${pageValues.length - 1} OFFSET ${pageValues.length}`), causing a 100% failure rate (HTTP 500) whenever `GET /admin/platform/tenants/:tenantId/audit` is invoked.
  2. *Orphan Maintenance Setting (`apps/api/src/modules/admin/troubleshooting-routes.ts:1007-1013`)*: Writes a `maintenance_mode` toggle to `ministry_settings`, but there are zero consumers or readers of this setting in the API or storefront runtime.
  3. *Rate Limit Reset Silent No-Op / False Positive (`apps/api/src/modules/admin/troubleshooting-routes.ts:1381-1392`)*: It checks `typeof (app as any).rateLimit?.resetKey === "function"`, so instead of throwing an unhandled crash, it silently no-ops while returning `success: true` (a deceptive false positive that does not actually reset the rate-limit bucket).

---

### 3.6 Data Schema & Migrations (Drizzle ORM)

Data persistence is managed via **Drizzle ORM 0.45.4** across 17 numbered migrations:
- Control Plane tables: `tenants`, `tenant_domains`, `tenant_database_bindings`, `tenant_module_entitlements`, `tenant_platform_settings`, `platform_members`, `platform_audit_events`, `notification_outbox`.
- Commerce tables (Forced RLS): `products`, `commerce_store_settings`, `carts`, `cart_items`, `orders`, `order_items`, `payment_attempts`, `webhook_events`, `idempotency_records`.
- Church Ministry tables (Forced RLS): `ministry_profiles`, `ministry_settings`, `leadership_profiles`, `sermon_categories`, `sermons`, `church_events`, `church_event_registrations`, `donation_campaigns`, `church_donations`, `church_payment_transactions`, `church_contact_messages`, `church_prayer_requests`, `church_newsletter_subscribers`.
- Hosting tables: `tenant_hosting_deployments`, `tenant_hosting_deployment_events`.
- Better-Auth tables (`auth` schema): `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`.

#### Git Branch Divergence & Migration Collision Risk
- Four shared packages (`@bazion/website-contracts`, `@bazion/sme-website-template`, `@bazion/forms`, and `@bazion/product-installations`) currently reside on the diverged branch `feature/church-ministry-platform`.
- On this branch, migration files are numbered `0016`–`0021`.
- However, migrations `0016`–`0017` have already been merged into trunk / `feat/provider-neutral-deployment-contract` (`0016_tenant_hosting_deployments.sql` and `0017_hosting_reconciliation_schedule.sql`).
- *Collision Blocker*: Merging or rebasing `feature/church-ministry-platform` without renumbering will cause fatal migration registry collisions; migrations `0016`–`0021` on the feature branch must be renumbered to `0018`–`0023` upon rebase.

---

### 3.7 Background Workers & Transactional Outbox

`bazionwebs-platform` eliminates external message broker dependencies (such as Redis BullMQ or RabbitMQ) in favor of database-native patterns:
- **Transactional PostgreSQL Notification Outbox (`packages/notifications`)**:
  - Enqueued in the same database transaction as the triggering business event.
  - Payloads encrypted with **AES-256-GCM** (`createOutboxPayloadCodec`).
  - Worker claims leases using `SELECT ... FOR UPDATE SKIP LOCKED` (`packages/notifications/src/outbox.ts`).
  - Supervised SMTP worker delivers emails with enforced TLS, tracking retry attempts, dead letters, and backoff.
- **Dokploy Hosting Deployment Reconciler (`apps/api/src/hosting-worker.ts`) & Swarm Secret Blocker**:
  - Dedicated background worker (`TenantHostingDeploymentReconciler`).
  - Manages container lifecycles via distributed lease locks (`PostgresHostingProvisioningStore`), polling Dokploy until container status reaches `running`.
  - *Swarm Secret & Dokploy Compose Constraints*: `DockerSecretTenantHostingSecretResolver` (`apps/api/src/modules/hosting/secrets.ts:45-99`) requires pre-mounted `/run/secrets/bazion-hosting-{tenantId}-{template}` files on the API container file system. Furthermore, `DokployComposeProvider` rejects non-`https://` URLs and currently lacks HTTP endpoints for `stop` or `remove`.
  - *Phase 1 Hosting Strategy*: Because dynamic Docker Swarm secret provisioning is not yet built, Phase 1 automated checkout provisioning must target **shared multi-tenant runtime tenants** (with Row-Level Security) rather than unattended per-tenant Dokploy standalone stacks until dynamic secret creation and lifecycle teardown APIs are developed.

---

## 4. Comparative Overlap Analysis

### 4.1 Overlapping Capabilities Inventory & Matrix

| # | Capability Domain | `D:\bazionweb` Implementation | `bazionwebs-platform` Implementation | Overlap Status | Architectural Assessment |
|---|---|---|---|---|---|
| 1 | **Public Marketing & Sales** | Full (`apps/web/src/app/(public)`: homepage, services, solutions, quote builder, store, case studies, blog) | None (Storefront runtime only; no agency marketing or quote builder) | Unique to `D:\bazionweb` | Must be retained on `D:\bazionweb` until Phase 4 frontend consolidation. |
| 2 | **Multi-Market Pricing Engine** | Full (`canonical-catalog.ts`, `priceBooks.ts`, `prisma/schema.prisma:636-836`: KE KES 16% VAT vs Global USD) | Catalog references only (`products/commercial-offerings.json:3-5` delegates to `D:\bazionweb`) | Unique to `D:\bazionweb` (SSOT) | `D:\bazionweb` remains canonical SSOT; extract into `@bazion/pricing` in Phase 3. |
| 3 | **Checkout & Payments** | Full (Daraja M-Pesa STK, Paystack Card/STK, Wise wire, guest checkout, KRA invoices) | Partial (Daraja M-Pesa STK push for church donations & commerce orders, mock provider) | Shared overlap (Daraja STK) | `D:\bazionweb` handles commercial B2B checkout; `bazionwebs-platform` handles tenant-level B2C payments. |
| 4 | **SaaS Multi-Tenancy** | None (Single-tenant agency model; 1 User to 1 Client mapping) | Full (PostgreSQL Forced RLS `app.tenant_id`, dedicated DB bindings, domain resolution) | Unique to `bazionwebs-platform` | `bazionwebs-platform` is the foundational multi-tenant runtime. |
| 5 | **Hosting Provisioning** | Dokploy API client (`dokploy.provider.ts`) storing state in `HostingAccount` table | Dokploy API client (`@bazion/deployment-dokploy`) with distributed lease locks & reconciler | Direct overlap (divergent state machines) | Converge on `bazionwebs-platform`'s reconciler in Phase 2; retire legacy client. |
| 6 | **Authentication & RBAC** | Local scrypt password hash + JWT; monolithic roles (`SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `CLIENT`) | Better-Auth with two-tier hierarchy: `platform_members` + Organization roles (`owner`, `admin`, etc.) | Divergent models | Unify on Better-Auth OIDC Single Sign-On in Phase 1. |
| 7 | **Project Delivery Roadmap** | Full (5-milestone auto-provisioned delivery roadmap, `Project`, `ProjectTask`) | None (marked as planned in `docs/product-architecture.md`) | Unique to `D:\bazionweb` | Retain on `D:\bazionweb`; port into `@bazion/projects` in Phase 3. |
| 8 | **Customer Credential Vault** | Full (AES-256-GCM encrypted client secret storage with reveal audit logs) | None (marked as planned) | Unique to `D:\bazionweb` | Retain on `D:\bazionweb`; port into `@bazion/vault` in Phase 3. |
| 9 | **Support Ticketing & SLA** | Full (P1–P4 tickets, SLA breach detection, internal comments) | None (marked as planned) | Unique to `D:\bazionweb` | Retain on `D:\bazionweb`; port into `@bazion/support` in Phase 3. |
| 10 | **Invoicing & Official Tax** | Full (Official KRA PIN, PDF generator, QR code verification) | None (marked as planned in `docs/product-architecture.md:50`) | Unique to `D:\bazionweb` | Retain on `D:\bazionweb`; port into `@bazion/billing` in Phase 3. |
| 11 | **Domain Ownership & TLS** | Static domain string on `HostingAccount` | Dynamic DNS verification with TXT challenge token hash (`tenant_domains`) | Unique to `bazionwebs-platform` | Standardize on `bazionwebs-platform`'s verification engine in Phase 2. |
| 12 | **Transactional Outbox** | None in core; direct event emission | Full encrypted notification outbox (`notification_outbox`) with AES-256 ciphertext | Unique to `bazionwebs-platform` | Adopt outbox pattern in `D:\bazionweb` for cross-platform event dispatch in Phase 1. |
| 13 | **Composable Solutions** | None (Monolithic web application) | Full (`church-ministry`, `commerce`, `solutions/`, `modules/`) | Unique to `bazionwebs-platform` | Platform runtime engine for tenant applications. |

---

### 4.2 Data Entity Mapping & Alignment Table

The following table details the schema-level mappings, field correspondences, and data type discrepancies between both systems:

| `D:\bazionweb` Entity (Prisma) | `bazionwebs-platform` Entity (Drizzle) | Structural & Field Alignment | Type Discrepancies & Conflict Analysis | Resolution Strategy |
|---|---|---|---|---|
| `User`<br>(id: UUID, email: string, passwordHash: string, role: `UserRole`) | `auth.user`<br>(id: text, email: string, name: string) + `public.platform_members` (userId, role: `PlatformRole`) | `D:\bazionweb` mixes agency staff and client users in one table with a single enum role. `bazionwebs-platform` decouples global identity (`auth.user`) from platform administration (`platform_members`). | PK format mismatch (UUID vs text varchar). Single enum vs dual-tier RBAC. | Federated OIDC IdP. Map `SUPER_ADMIN` to `platform_owner`, `CLIENT` to organization `owner`. |
| `Client`<br>(id: UUID, userId: UUID [1:1], businessName: string, status: `ClientStatus`, planId: UUID) | `public.tenants`<br>(id: UUID, slug: string, name: string, status: `TenantStatus`, auth_organization_id: text) | `Client` represents an agency billing account strictly tied to 1 user. `tenants` represents an isolated multi-user workspace container linked to an organization. | `Client` has no slug or multi-user concept. `tenants` has no tax PIN or direct billing fields. | Sync outbox event creates `tenant` record; store `external_client_id` in tenant platform settings. |
| `Subscription`<br>(id: UUID, clientId: UUID, planId: UUID, billingCycle: `BillingCycle`, status: `SubscriptionStatus`) | *(Planned: `products/catalog.json:198-206` delegates subscription billing to external source)* | `D:\bazionweb` manages active subscriptions, renewal dates, and dunning cycles. `bazionwebs-platform` currently has no subscription model. | Gap in `bazionwebs-platform`. | Keep subscription engine in `D:\bazionweb`. Platform checks subscription validity via sync webhooks. |
| `Plan`<br>(id: UUID, tier: `PlanTier`, priceMonthly: Decimal, priceAnnual: Decimal, slas: JSON) | `products/commercial-offerings.json`<br>(JSON declarations of bundles, tiers, moduleIds) | `commercial-offerings.json` explicitly references `D:\bazionweb`'s `priceBooks.ts` as canonical source. | Database-backed dynamic table vs static versioned JSON manifest. | Extract `priceBooks.ts` into shared package `@bazion/pricing` in Phase 3. |
| `HostingAccount`<br>(domain: string, server: string, plan: string, sslExpiry: Date, status: `HostingStatus`) | `public.tenant_hosting_deployments`<br>(id: UUID, tenantId: UUID, template: string, state: string, leaseToken: string) | `HostingAccount` stores static infrastructure specs. `tenant_hosting_deployments` tracks containerized workloads with distributed lease locks. | Static metadata vs distributed state machine with leasing and reconciler. | Point `HostingAccount` to platform deployment ID; sync state via webhooks in Phase 2. |
| `PaymentLog`<br>(idempotencyKey: string, provider: string, amount: Decimal(12,2), status: string) | `public.payment_attempts`<br>(id: UUID, tenantId: UUID, orderId: UUID, amountMinor: bigint, idempotencyKey: string) | Both track financial transactions with provider references and idempotency keys. | **Critical Incompatibility**: `D:\bazionweb` uses `Decimal(12,2)` floating number. `bazionwebs-platform` uses `bigint` (integer minor units / cents). | Event serialization contract must explicitly convert `amount * 100` to integer minor units. |
| `AuditLog`<br>(userId: UUID, action: string, resourceType: string, resourceId: string, timestamp: Date) | `public.platform_audit_events`<br>(id: UUID, tenantId: UUID, actorUserId: text, action: string, metadata: JSON) | Both implement append-only JSON audit logs. | Minor field naming differences. | Map directly in event handlers. |

---

### 4.3 Provisioning Workflow Divergences

```
+---------------------------------------------------------------------------------------------------+
|                            PROVISIONING WORKFLOW COMPARISON                                       |
+---------------------------------------------------------------------------------------------------+
| D:\bazionweb: Payment-First Guest Checkout Flow                                                   |
|                                                                                                   |
| [Unauthenticated Guest]                                                                           |
|          |                                                                                        |
|          v                                                                                        |
| [Selects Package / Quote] -> [Enters Email & Phone]                                               |
|          |                                                                                        |
|          v                                                                                        |
| [Daraja STK / Paystack Card Settlement]                                                           |
|          |                                                                                        |
|          v (HMAC Webhook Callback)                                                                |
| [PaymentSettlementService] -> Atomically creates:                                                 |
|    1. `User` (role: CLIENT, passwordHash: null)                                                   |
|    2. `Client` (status: ACTIVE, linked to Plan)                                                   |
|    3. `Subscription` (cycle: Annual, status: ACTIVE)                                              |
|    4. `Invoice` (marked PAID, generates KRA PDF)                                                  |
|    5. `Project` (5 ProjectTask milestones: Discovery, Wireframes, Dev, QA, Go-Live)                |
|    6. Mints 72-hour cryptographic claim token (`claim_<hash>`)                                    |
|          |                                                                                        |
|          v                                                                                        |
| [Client receives email] -> Visits `/portal/claim` -> Sets password -> Accesses Portal             |
+---------------------------------------------------------------------------------------------------+
                                                  vs
+---------------------------------------------------------------------------------------------------+
| bazionwebs-platform: Operator-First Multi-Tenant Lifecycle                                        |
|                                                                                                   |
| [Platform Operator / Admin]                                                                       |
|          |                                                                                        |
|          v                                                                                        |
| [POST /api/auth/organization/create] (Requires `platform_owner` or `platform_admin`)              |
|          |                                                                                        |
|          +--> `beforeCreateOrganization` hook:                                                    |
|          |    - Reserves tenant slug in `public.tenants` (`status: provisioning`)                 |
|          |                                                                                        |
|          +--> Better-Auth creates `auth.organization` & assigns Owner membership                  |
|          |                                                                                        |
|          +--> `afterCreateOrganization` hook:                                                     |
|               - Flips `public.tenants` to `status: active`                                        |
|               - Seeds `ministry_profiles` & `ministry_settings`                                   |
|               - Enables `church-ministry` in `tenant_module_entitlements`                         |
|               - Inserts local dev domain `${slug}.localhost` in `tenant_domains`                  |
|          |                                                                                        |
|          v                                                                                        |
| [Tenant Hosting Trigger]:                                                                         |
|    1. Takes 300s PostgreSQL distributed lease lock (`PostgresHostingProvisioningStore`)          |
|    2. Dispatches template to Dokploy (`wordpress`, `node-nextjs`, `ecommerce`)                    |
|    3. Background `HostingReconciler` polls Dokploy until status reaches `running`                 |
|    4. Domain TXT challenge verified via `verifyTenantDomainTxt` (`node:dns/promises`)            |
+---------------------------------------------------------------------------------------------------+
```

---

### 4.4 Administrative Dashboards Comparison

| Aspect | `D:\bazionweb` Super Admin | `bazionwebs-platform` Admin Architecture |
|---|---|---|
| **Mount Point** | `apps/web/src/app/admin` (same origin as public site and portal) | `apps/admin` (port 3001) for Platform Admin;<br>`apps/storefront/app/admin` for Tenant Admin |
| **Audience** | Agency internal staff only | Two distinct tiers: Platform Operators vs Tenant Organization Members |
| **Authorization Guard** | `RolesGuard` checking `SUPER_ADMIN`, `ADMIN`, `SUPPORT` in `User.role` | `requirePlatformPermission` on `platform_members` table;<br>`requireActiveTenantPermission` on organization roles |
| **Tenant Lifecycle Control** | Single-tenant agency model; manages `Client.status` | Full SaaS lifecycle: `ACTIVE`, `SUSPENDED`, terminal `CLOSED` with audit log |
| **Hosting Management** | Inspects static `HostingAccount` records and server node IP list | Inspects container deployments, triggers template launches, and monitors reconciler leases |
| **Troubleshooting Suite** | 6 transactional remediation workstations + Proactive Scanner + View-As Impersonation | Database health checks, DNS TXT verification tester, and outbox queue inspection |
| **Impersonation Support** | Tab-isolated View-As Sandbox (15-min token stored in `sessionStorage` with yellow warning banner) | Planned; currently relies on platform operator permission elevation |
| **Pricing Management** | Full multi-market price book manager (`KE-2026-v1`, `GLOBAL-2026-v1`, VAT rules, coupons) | None; delegates pricing definitions to `D:\bazionweb` |

---

## 5. In-Depth Evaluation of 5 Synchronization Strategies

### 5.1 Strategy 1: Event-Driven Sync & Webhooks (Transactional Outbox)

#### Architecture & Mechanism
- When a state transition occurs in `D:\bazionweb` (such as payment settlement or client status change), the business mutation and an event envelope are written to a PostgreSQL table `sync_outbox` in the **same ACID transaction**.
- **Crucial Hook Point Requirement**: In `D:\bazionweb`, `BillingService.markPaid` (`billing.service.ts:1875`) emits `invoice.paid`, whereas `PaymentSettlementService` (`payment-settlement.service.ts`) settles Paystack, Daraja, and cron renewal payments directly via Prisma transactions *without* emitting `invoice.paid`. Therefore, `sync_outbox` rows **must be written directly inside `PaymentSettlementService` transactions**, guaranteeing zero dropped events during automated settlements.
- A lightweight background worker polls `sync_outbox` (using `SELECT ... FOR UPDATE SKIP LOCKED` or PostgreSQL `LISTEN/NOTIFY`) and dispatches signed HTTPS POST webhooks to `bazionwebs-platform`'s sync endpoint (`POST /api/v1/sync/events`).
- The payload is signed with an HMAC-SHA256 signature using a shared secret (`SYNC_SHARED_SECRET`).
- `bazionwebs-platform` validates the signature, records the idempotency key in its `webhook_events` table, and idempotently provisions the tenant, creates the Better-Auth organization, and assigns module entitlements.
- Bi-directional sync: When `bazionwebs-platform`'s hosting reconciler reaches `state: running` or a custom domain is verified, it writes an event to its own outbox to update `D:\bazionweb`'s `HostingAccount` record.

#### Ordering & Replay Protection: Fetch-On-Notify & Monotonic Versioning
Webhooks over public networks are inherently subject to jitter, network retries, and out-of-order delivery (e.g., an earlier `subscription.status_changed: SUSPENDED` arriving after a subsequent `subscription.status_changed: ACTIVE`). To prevent stale state overwrites:
1. **Monotonic Versioning**: Every event envelope contains an integer `version` or monotonic sequence number (`sequenceNumber: bigint`) tied to the entity's mutation counter in PostgreSQL.
2. **Fetch-On-Notify Architecture**: The webhook notification serves as a lightweight invalidation signal carrying `{ entityType, entityId, version }`. Upon receipt, the consumer fetches the authoritative current record from the producer's authenticated REST endpoint (`GET /api/v1/sync/tenants/:id`) before mutating local state. Alternatively, when processing payload data directly, the consumer verifies `incoming.version > existing.version`, dropping stale events idempotently.

#### Scheduled Cross-System Reconciliation Loop & Fail-Safe Invariant
To heal transient webhook drops or network partitions, a background reconciliation loop executes periodically (hourly/daily):
- **Drift Detection**: Compares `D:\bazionweb` active subscription and billing statuses against `bazionwebs-platform` tenant lifecycle states and module entitlements.
- **Fail-Safe Abort Invariant**: If upstream APIs experience partial failure, network timeout, rate-limiting, or paginated query degradation, the reconciliation job **must immediately abort** its execution. Under no circumstances may an automated reconciliation pass perform tenant suspension, entitlement stripping, or container deprovisioning based on an incomplete or failed sync dataset.

#### Schema Definition (`sync_outbox`)
```sql
CREATE TABLE sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload_json JSONB NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 8,
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_sync_outbox_queue ON sync_outbox (status, available_at) WHERE status = 'PENDING';
```

#### Failure Modes & Resilience
- **Platform Down / Network Partition**: `D:\bazionweb` client checkout proceeds uninterrupted. Events queue durably in PostgreSQL with exponential retry backoff ($2^n \times 5\text{ seconds}$).
- **Poison Pill Events**: Handled gracefully. If an event fails after 8 attempts, its status transitions to `DEAD_LETTER` and an alert is raised to the Super Admin Diagnostics desk. The queue is never blocked.

---

### 5.2 Strategy 2: Direct API Integration & Gateway (Synchronous REST/BFF)

#### Architecture & Mechanism
- An API Gateway (such as Cloudflare Workers, Kong, or Traefik reverse proxy) routes incoming HTTP traffic:
  - `bazion.com/` and `bazion.com/api/*` $\rightarrow$ `D:\bazionweb`
  - `*.bazion.com`, `admin.bazion.com`, and custom domains $\rightarrow$ `bazionwebs-platform`
- During checkout settlement in `D:\bazionweb`, `PaymentSettlementService` makes a direct synchronous REST call (`POST https://platform.bazion.internal/v1/admin/tenants/provision`) to create the tenant in `bazionwebs-platform` before returning the payment success response to the client.

#### Failure Modes & Resilience
- **Tight Temporal Coupling**: If `bazionwebs-platform` is experiencing latency, restarting, or executing a database migration, customer checkout in `D:\bazionweb` blocks and times out.
- **Dual-Write Partial Failure Problem**: If payment settles on Paystack/Daraja, but the subsequent synchronous API call to `bazionwebs-platform` fails with HTTP 500, the system enters an inconsistent state (customer money was deducted, but no software tenant was created). Resolving this requires complex two-phase commit sagas or manual staff intervention.

---

### 5.3 Strategy 3: Single Sign-On (SSO) and Federated Identity (Better-Auth OIDC)

#### Architecture & Mechanism
- Rather than maintaining duplicate user credential databases, authentication is federated under a single Identity Provider (IdP).
- `bazionwebs-platform`'s Better-Auth implementation is configured as an OpenID Connect (OIDC) / OAuth 2.0 provider (`packages/auth/src/server.ts`).
- `D:\bazionweb` acts as an OIDC Relying Party (client). When a user navigates to `D:\bazionweb/portal/login`, they authenticate against Better-Auth.
- Better-Auth issues signed JWT tokens (RS256) exposing standard claims (`sub`, `email`, `name`) and custom claims (`platform_role`, `tenant_memberships`).
- `D:\bazionweb`'s `JwtAuthGuard` validates the token using Better-Auth's public JWKS endpoint (`GET /api/auth/jwks`).

#### Mandatory OAuth 2.0 Backend-For-Frontend (BFF) Architecture (RFC 9700)
To prevent token theft, credential leaks, and cross-site scripting (XSS) vulnerabilities, the federated authentication pipeline must adhere strictly to **RFC 9700** (Best Current Practice for OAuth 2.0 in Browser-Based Applications):
- **BFF Cookie Discipline**: All session tokens and access tokens must be held in confidential backend sessions and surfaced to client browsers strictly via `__Host-Http-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookies with zero client-side JavaScript access.
- **PKCE Enforcement**: All authorization code exchanges must enforce Proof Key for Code Exchange (PKCE) utilizing `code_challenge_method: S256`.
- **RFC 8693 Token Exchange**: Downstream service-to-service communication and tenant context elevation must use standardized RFC 8693 OAuth 2.0 Token Exchange rather than passing raw master credentials.
- **Zero Tokens in URLs or Storage**: Tokens, authorization codes, and session identifiers must **never** appear in URL query parameters, fragment identifiers, or client-accessible storage (`localStorage` / `sessionStorage`), eliminating exposure to browser history, server access logs, and HTTP Referer leaks.
- **View-As Sandbox Isolation Boundary**:
  - `D:\bazionweb`'s `isSandbox` impersonation tokens must be hardened with server-side NestJS HTTP mutation blocking (`POST`/`PUT`/`PATCH`/`DELETE` returning HTTP 403 `FORBIDDEN_IN_SANDBOX`).
  - Under no circumstances may `isSandbox` tokens be forwarded across the federated SSO bridge to `bazionwebs-platform`. Better-Auth must reject any token exchange request originating from an impersonation session.

#### Unified Role Mapping Matrix

| `D:\bazionweb` Role | Better-Auth Platform Role | Better-Auth Organization Role | Effective Permissions |
|---|---|---|---|
| `SUPER_ADMIN` | `platform_owner` | *(Inherits global)* | Full platform operations, tenant lifecycle, billing, hosting reconciler |
| `ADMIN` | `platform_admin` | *(Inherits global)* | Client CRM, domain verification, tenant settings, ticket resolution |
| `SUPPORT` | `platform_support` | *(Inherits global)* | Read-only diagnostic inspection, ticket comments |
| `CLIENT` | *(None / regular user)* | `owner` | Full administration of their specific tenant workspace |

---

### 5.4 Strategy 4: Shared vs. Separate Data Stores

#### Option 4A: Shared Physical Database with Multi-Schema Isolation
- A single PostgreSQL 16 cluster hosts three distinct schemas:
  1. `agency` (or default `public`): Owned by `D:\bazionweb` Prisma.
  2. `platform`: Owned by `bazionwebs-platform` Drizzle.
  3. `auth`: Owned by Better-Auth.
- **Advantages**: Immediate SQL cross-schema joins; instant transactional consistency across agency clients and platform tenants.
- **Critical Risks**:
  - **Shared Fate**: A locking schema migration in Drizzle or a connection pool leak in NestJS brings down the entire business.
  - **Connection Pool Contention**: Both NestJS (Prisma) and Fastify (Drizzle) maintain connection pools. Exceeding max PostgreSQL connections causes widespread request timeouts.
  - **Migration Collisions**: Prisma migrations and Drizzle migrations execute different locking strategies and migration tracking tables (`_prisma_migrations` vs `__drizzle_migrations`).

#### Option 4B: Separate Federated Databases with Change Data Capture (CDC)
- `agency_db` (`D:\bazionweb`) and `platform_db` (`bazionwebs-platform`) operate as completely physically isolated PostgreSQL instances.
- A Change Data Capture engine (such as Debezium reading PostgreSQL Write-Ahead Logs [WAL]) streams database changes to an Apache Kafka or RabbitMQ event bus, which consumer workers apply to `platform_db`.
- **Advantages**: Total physical fault isolation; independent database upgrades and scaling.
- **Critical Risks**:
  - **Excessive Operational Complexity**: Requires managing Kafka brokers, ZooKeeper/KRaft, Debezium connector pods, schema registries, and replication lag monitoring.
  - **High Infrastructure Footprint**: Disproportionate overhead for the current deployment footprint.

---

### 5.5 Strategy 5: System Consolidation / Strangler Fig Pattern

#### Architecture & Mechanism
- The **Strangler Fig Pattern** (Martin Fowler) gradually replaces capabilities of `D:\bazionweb` with implementations in `bazionwebs-platform` until the legacy application can be cleanly retired.
- Target Architecture:
  1. Port `priceBooks.ts` and multi-market tax logic from `D:\bazionweb` into `@bazion/pricing`.
  2. Port official KRA PDF generation and subscription billing into `@bazion/billing`.
  3. Port client milestone tracking into `@bazion/projects`.
  4. Port support ticketing into `@bazion/support`.
  5. Port AES-256 client credentials into `@bazion/vault`.
  6. Migrate public marketing pages from `D:\bazionweb/apps/web` into a dedicated app `apps/marketing` or integrate directly into `apps/storefront`.
- **Advantages**: Eliminates permanent multi-system synchronization overhead; results in a single, cohesive, modern monorepo; zero sudden cutover risk.

---

### 5.6 Comprehensive Trade-Off Evaluation Matrix

| Evaluation Dimension | Strategy 1: Outbox Event Sync | Strategy 2: Direct REST API | Strategy 3: SSO / OIDC Federation | Strategy 4A: Shared Database | Strategy 4B: CDC (Debezium/Kafka) | Strategy 5: Strangler Fig Consolidation |
|---|---|---|---|---|---|---|
| **Consistency Model** | Eventual (200ms–2,000ms) | Immediate or Partial Failure | Immediate for session state | Immediate ACID | Eventual (<500ms) | Eventual during migration; Immediate ACID at end-state |
| **Latency Impact** | Zero impact on user transactions (async) | High (adds 200–800ms to checkout request) | Zero on data; standard OAuth redirect on login | Zero (local DB queries) | Zero on user transactions | Zero impact on critical paths |
| **Operational Complexity** | Low-Medium (standard PG table + worker) | Low (direct HTTP calls) | Medium (OIDC provider setup) | Medium (connection pool tuning, schema management) | Very High (Kafka, Debezium, schema registry, WAL retention) | Medium during transition; Lowest long-term |
| **Blast Radius / Risk** | Low (isolated; failures queue safely) | High (platform downtime breaks agency checkout) | Low-Medium (auth outage affects both systems) | Critical (single DB crash takes down entire business) | Medium-High (replication desync requires replay) | Low (phased, testable per-module migration) |
| **Development Effort** | 1.5–2 engineer-weeks | 1 engineer-week | 2 engineer-weeks | 1 engineer-week | 4–6 engineer-weeks | 6–8 engineer-weeks across 4 phases |
| **Fault Tolerance** | High (handles network partitions gracefully) | Poor (fragile during network hiccups) | High (cached tokens/JWKS allow offline verification) | Poor (shared fate for all components) | High (durable log replays) | High (modular boundaries with fallback) |

---

## 6. Recommended Target Architecture

### 6.1 Architectural Rationale

The analysis yields a definitive conclusion: **A Hybrid Architecture combining Strategy 1 (Transactional Outbox Event Sync), Strategy 3 (Better-Auth OIDC Single Sign-On), and Strategy 5 (Phased Strangler Fig Consolidation)** provides the optimal balance of immediate business continuity, high fault tolerance, and a clean path toward long-term consolidation.

1. **Immediate Stability (Weeks 1–3)**: Neither system undergoes high-risk rewrites. Checkout and payments continue working on `D:\bazionweb`.
2. **Zero Checkout Blockers**: Using an asynchronous Transactional Outbox ensures customer payments in `D:\bazionweb` never fail due to platform maintenance or network hiccups.
3. **Seamless Client Experience**: Better-Auth OIDC allows clients to log in once and navigate between the agency delivery portal and their tenant workspace without re-authenticating.
4. **Architectural Convergence**: Dokploy container management and dynamic domain verification are unified immediately under `bazionwebs-platform`. Agency capabilities are then extracted into clean monorepo packages, enabling the eventual graceful deprecation of `D:\bazionweb`.

---

### 6.2 System Architecture Diagram

```
+=======================================================================================================+
|                                    CLIENT BROWSER / PUBLIC WEB                                        |
+=======================================================================================================+
              |                                             |                             |
       (Agency Sales / Quote)                       (OIDC Auth / SSO)            (Tenant Storefronts)
              v                                             v                             v
+---------------------------+                    +--------------------+        +------------------------+
|       D:\bazionweb        |                    |   Better-Auth IdP  |        |  bazionwebs-platform   |
|   (Next.js 15 + NestJS 10)|<------------------>| (OAuth 2.0 / OIDC) |<------>| (Next.js 16 + Fastify) |
|                           |   [JWKS / Token]   |   Schema: `auth`   |        |                        |
| - Marketing & Solutions   |                    +--------------------+        | - Church Ministry Site |
| - Price Books (KES / USD) |                                                  | - E-Commerce Storefront|
| - Checkout (Daraja / Card)|                                                  | - Platform Admin Plane |
| - Invoices & KRA PDF Gen  |                                                  | - Tenant Workspace Adm |
| - Project Delivery Roadmap|                                                  +------------------------+
| - Support Tickets & Vault |                                                              ^
+---------------------------+                                                              |
              |                                                                            |
       (Atomic Insert)                                                              (Signed HTTPS Post)
              v                                                                            |
+---------------------------+               POST /api/v1/sync/events                       |
|    `sync_outbox` Table    |--------------------------------------------------------------+
|  (PostgreSQL: agency_db)  |          (HMAC-SHA256 Signature + Idempotency Key)           |
+---------------------------+                                                              |
              |                                                                            v
       [Outbox Worker]                                                         +------------------------+
                                                                               |   Fastify Sync Handler |
                                                                               | - Deduplicate Key      |
                                                                               | - Upsert Tenant Record |
                                                                               | - Assign Entitlements  |
                                                                               +------------------------+
                                                                                           |
                                                                                           v
                                                                               +------------------------+
                                                                               | Hosting Provisioner    |
                                                                               | - Postgres Lease Lock  |
                                                                               | - Dokploy Container    |
                                                                               | - Reconciler Worker    |
                                                                               +------------------------+
```

---

### 6.3 Component Roles & Boundaries

1. **Commercial Frontend & Engine (`D:\bazionweb`)**:
   - Primary entry point for marketing, package comparison, and proposal acceptance.
   - Manages official KRA tax invoicing, Daraja/Paystack payment capture, and client project roadmap generation.
2. **Transactional Outbox Engine (`sync_outbox` in `D:\bazionweb`)**:
   - Captures lifecycle events (`tenant.provision_requested`, `subscription.status_changed`, `client.status_changed`) in the same database transaction as payment settlement inside `PaymentSettlementService`.
   - Dispatches signed webhooks with monotonic versioning and exponential retry backoff.
3. **Unified Identity Provider (`Better-Auth` in `bazionwebs-platform`)**:
   - Central identity authority adhering to OAuth 2.0 BFF (RFC 9700).
   - Provides Single Sign-On across the agency client portal (`D:\bazionweb/portal`) and the tenant administration workspace (`bazionwebs-platform/apps/storefront/app/admin`).
4. **Tenant Execution Platform (`bazionwebs-platform`)**:
   - Consumes outbox events idempotently to create tenants, assign module entitlements, and generate verification DNS challenge records (`_bazionweb-challenge.<hostname>`).
   - Handles multi-tenant routing with forced Row-Level Security.
5. **Phase 1 Hosting Provisioning Strategy (Shared Multi-Tenant RLS vs. Dokploy Swarm)**:
   - *Dokploy Secret Blocker*: `DockerSecretTenantHostingSecretResolver` (`apps/api/src/modules/hosting/secrets.ts:45-99`) requires pre-mounted secret files (`/run/secrets/bazion-hosting-{tenantId}-{template}`) on the API container file system, while `DokployComposeProvider` rejects non-`https://` URLs and lacks container stop/remove endpoints.
   - *Phase 1 Strategy*: Automated checkout provisioning in Phase 1 targets **shared multi-tenant runtime tenants** (isolated via PostgreSQL Row-Level Security) rather than unattended per-tenant Dokploy standalone stacks until dynamic Swarm secret creation and lifecycle teardown APIs are developed.

---

### 6.4 Event Contract Specifications

All cross-platform events adhere to a standardized JSON envelope with cryptographic HMAC-SHA256 signatures and monotonic versioning:

#### 1. Tenant Provisioning Event (`tenant.provision_requested`)
```json
{
  "eventId": "evt_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "eventType": "tenant.provision_requested",
  "version": 1,
  "sequenceNumber": 1042,
  "timestamp": "2026-11-11T20:30:00.000Z",
  "producer": "bazionweb-agency",
  "idempotencyKey": "PROV_INV-KE-2026-0042",
  "data": {
    "clientId": "cln_4a1f8b3c-0e2d-4f1a-8c5e-7a9b1c3d5e7f",
    "tenantSlug": "acme-enterprises",
    "businessName": "Acme Enterprises Ltd",
    "contactEmail": "billing@acme.co.ke",
    "contactPhone": "+254712345678",
    "currency": "KES",
    "selectedPackage": "ecommerce-business",
    "modules": [
      "commerce",
      "notifications",
      "analytics"
    ],
    "hosting": {
      "mode": "shared_multi_tenant",
      "template": "ecommerce",
      "cpuQuota": 1.0,
      "memoryQuotaMb": 512,
      "storageQuotaGb": 30
    },
    "ownerUser": {
      "email": "director@acme.co.ke",
      "name": "Jane Muthoni",
      "claimToken": "claim_7b9e2f4a1c5d"
    }
  }
}
```
*(Note: `media-storage` is omitted from the `modules` array as it is not a registered module in `module-catalog.ts`; file and asset storage is managed directly by `@bazion/storage`. Additionally, `module-catalog.ts` defines `defaultEnabled: true` for `commerce`, `analytics`, and `church-ministry`.)*

#### 2. Subscription Status Event (`subscription.status_changed`)
```json
{
  "eventId": "evt_5c2e8a1d-7f4b-4c9e-9a2d-1b3c5e7f9a1b",
  "eventType": "subscription.status_changed",
  "version": 2,
  "sequenceNumber": 1043,
  "timestamp": "2026-11-11T20:30:00.000Z",
  "producer": "bazionweb-agency",
  "idempotencyKey": "SUB_STATUS_cln_4a1f8b3c_ACTIVE",
  "data": {
    "clientId": "cln_4a1f8b3c-0e2d-4f1a-8c5e-7a9b1c3d5e7f",
    "tenantSlug": "acme-enterprises",
    "status": "ACTIVE",
    "billingCycle": "ANNUAL",
    "currentPeriodEnd": "2027-11-11T20:30:00.000Z"
  }
}
```

#### 3. Hosting Deployment Completed Event (`hosting.deployment_updated`)
```json
{
  "eventId": "evt_1a3f5c7e-9b2d-4e8f-8c1a-3e5f7a9b1c3d",
  "eventType": "hosting.deployment_updated",
  "version": 1,
  "sequenceNumber": 1044,
  "timestamp": "2026-11-11T20:32:15.000Z",
  "producer": "bazionwebs-platform",
  "idempotencyKey": "HOSTING_DEP_dep_8b2d4e1a_RUNNING",
  "data": {
    "tenantSlug": "acme-enterprises",
    "deploymentId": "dep_8b2d4e1a-4c9f-4a1b-9e2d-3c5e7f9a1b3c",
    "state": "running",
    "primaryDomain": "shop.acme.co.ke",
    "sslExpiryDate": "2027-02-11T00:00:00.000Z",
    "ipAddress": "197.248.54.12",
    "containerName": "bazion-acme-enterprises-prod"
  }
}
```

---

## 7. Phased Implementation Roadmap

```
+====================================================================================================+
|                                    PHASED IMPLEMENTATION TIMELINE                                  |
+====================================================================================================+
| WEEKS 1–3: Phase 1 — Operational Interoperability & Identity Bridge                                |
|  - Better-Auth OIDC Provider setup & JWKS verification in D:\bazionweb                              |
|  - Transactional Outbox in D:\bazionweb (`sync_outbox`) & Fastify `/api/v1/sync/events` endpoint   |
|  - Idempotent tenant provisioning & entitlement synchronization                                    |
+----------------------------------------------------------------------------------------------------+
| WEEKS 4–6: Phase 2 — Hosting & Domain Lifecycle Convergence                                        |
|  - Deprecate D:\bazionweb direct Dokploy calls; route hosting to platform reconciler worker        |
|  - Unify DNS TXT domain verification challenges under platform control plane                       |
|  - Bidirectional deployment status sync back to D:\bazionweb `HostingAccount`                      |
+----------------------------------------------------------------------------------------------------+
| WEEKS 7–10: Phase 3 — Domain Module Migration into Monorepo                                        |
|  - Port `priceBooks.ts` into `@bazion/pricing`                                                     |
|  - Port KRA tax PDF invoicing & subscriptions into `@bazion/billing`                               |
|  - Port customer credentials into `@bazion/vault` & tickets into `@bazion/support`                 |
|  - Port sprint delivery roadmap into `@bazion/projects`                                            |
+----------------------------------------------------------------------------------------------------+
| WEEKS 11–12: Phase 4 — Full Consolidation & Monorepo Retirement                                    |
|  - Migrate public marketing & quote builder into `apps/storefront` or `apps/marketing`            |
|  - Cut over primary DNS (`bazion.com`) to unified monorepo deployment                              |
|  - Archive standalone D:\bazionweb repository                                                      |
+====================================================================================================+
```

### Phase 1: Operational Interoperability & Identity Bridge (Weeks 1–3)
- **Milestone 1.1: Federated Authentication (SSO & RFC 9700 BFF Architecture)**
  - Enable Better-Auth's OAuth 2.0 / OpenID Connect plugin in `bazionwebs-platform/packages/auth`.
  - Mandate **OAuth 2.0 Backend-For-Frontend (BFF)** pattern per **RFC 9700**:
    - Session state maintained via `__Host-Http-` cookies (`HttpOnly`, `Secure`, `SameSite=Lax`).
    - PKCE authorization code exchange utilizing `code_challenge_method: S256`.
    - Downstream service token delegation via RFC 8693 Token Exchange.
    - Zero tokens, session keys, or claim codes exposed in URL queries or client-accessible web storage.
  - Update `D:\bazionweb/apps/api/src/modules/auth` to validate JWTs against `bazionwebs-platform`'s JWKS endpoint (`GET /api/auth/jwks`).
  - Implement role mapping: `SUPER_ADMIN` $\rightarrow$ `platform_owner`; `CLIENT` $\rightarrow$ organization `owner`.
  - *Impersonation Isolation Guard*: Block `isSandbox` impersonation tokens from ever being forwarded across the SSO bridge; implement NestJS mutation guards rejecting non-GET methods on sandboxed sessions.
- **Milestone 1.2: Transactional Outbox Provisioning Sync & Blocker Remediation**
  - Create `sync_outbox` table and worker in `D:\bazionweb/apps/api/src/modules/billing`.
  - *Outbox Hook Point Remediation*: Embed `sync_outbox` write operations directly inside `PaymentSettlementService` Prisma `$transaction` blocks (capturing automated Paystack, Daraja, and cron settlements).
  - Implement signed webhook handler `POST /api/v1/sync/events` in `bazionwebs-platform/apps/api/src/modules/admin` enforcing Fetch-On-Notify and monotonic sequence numbers (`sequenceNumber`, `version`).
  - *Tenant Provisioning Target*: Target **shared multi-tenant runtime tenants** (with Forced Row-Level Security) rather than unattended per-tenant Dokploy stacks, circumventing the Docker Swarm pre-mounted secret file requirement (`DockerSecretTenantHostingSecretResolver`) until dynamic secret APIs are built.
  - *Production Tenant Spoofing Remediation*: Patch `apps/api/src/lib/tenant-resolution.ts:11-16` so `explicitTenantSlugOrId` (`x-bazion-tenant` / `?tenant=`) is strictly disabled in production unless authenticated as `platform_owner` or `platform_admin`.
  - *Admin Query & Route Bug Fixes*:
    - Patch `apps/api/src/modules/admin/routes.ts:510,523` to include missing `$` parameter prefixes (`ILIKE $${values.length}`, `LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`), restoring `GET /admin/platform/tenants/:tenantId/audit`.
    - Fix rate-limit reset in `troubleshooting-routes.ts:1381-1392` (it checks `typeof (app as any).rateLimit?.resetKey === "function"`, silently no-opping and returning `success: true` without resetting the actual rate-limit bucket).
  - *Git Branch & Migration Sequence Alignment*:
    - Rebase diverged branch `feature/church-ministry-platform` over `feat/provider-neutral-deployment-contract`.
    - Renumber migrations `0016`–`0021` on the feature branch to `0018`–`0023` to avoid collision with trunk migrations `0016_tenant_hosting_deployments.sql` and `0017_hosting_reconciliation_schedule.sql`.
  - *Frontend Dependency Lockfile Restoration*:
    - Regenerate `apps/web/package-lock.json` in `D:\bazionweb` (deleted in commit `af533ec8`) via `npm install --package-lock-only`.
- **Milestone 1.3: Integration Validation**
  - Execute end-to-end sandbox test: Guest checkout in `D:\bazionweb` via M-Pesa $\rightarrow$ `PaymentSettlementService` outbox row write $\rightarrow$ Signed outbox dispatch with monotonic sequence $\rightarrow$ Shared multi-tenant tenant provisioned in `bazionwebs-platform` with RLS $\rightarrow$ Claim link login via Better-Auth RFC 9700 BFF SSO.

### Phase 2: Hosting & Domain Lifecycle Convergence (Weeks 4–6)
- **Milestone 2.1: Automated Dunning, Auto-Suspension & Unified Orchestration**
  - Build automated grace-expiry dunning and auto-suspension cron in `D:\bazionweb` (`markOverdueInvoices` currently only sets `OVERDUE` without suspension), enabling reliable suspension event emission upon grace period expiration.
  - Deprecate legacy direct Dokploy API calls in `D:\bazionweb/apps/api/src/modules/hosting/providers/dokploy.provider.ts`.
  - Route container provisioning through `bazionwebs-platform`'s hardened `@bazion/deployment-dokploy` and background `HostingReconciler`.
- **Milestone 2.2: Dynamic Domain Verification Integration**
  - Connect custom domains registered in `D:\bazionweb`'s portal to `bazionwebs-platform`'s DNS TXT verification challenge engine (`verifyTenantDomainTxt`), enforcing verified challenge hostname `_bazionweb-challenge.<hostname>`.
- **Milestone 2.3: Bidirectional Status Sync & Scheduled Reconciliation Loop**
  - When container status transitions to `running` or TLS certificates renew in Dokploy, emit `hosting.deployment_updated` back to `D:\bazionweb` to update `HostingAccount.status = ACTIVE`.
  - Implement a scheduled background reconciliation loop (hourly) to heal drift between `D:\bazionweb` subscriptions and `bazionwebs-platform` tenant states.
  - *Fail-Safe Invariant*: Ensure the reconciliation loop immediately aborts its pass if upstream APIs experience partial failure, query timeouts, or paginated degradation, preventing erroneous tenant suspension or container deprovisioning.

### Phase 3: Domain Module Migration into Monorepo (Weeks 7–10)
- **Milestone 3.1: Pricing Catalog Extraction**
  - Extract `D:\bazionweb`'s `priceBooks.ts`, canonical catalog, and KES/USD tax rules into a pure package: `@bazion/pricing`.
  - Update `products/commercial-offerings.json` to import directly from `@bazion/pricing`.
- **Milestone 3.2: Invoicing & Billing Package**
  - Port `InvoicePdfGenerator`, KRA PIN tax calculation, and recurring subscription state machines into `@bazion/billing`.
  - Integrate with `@bazion/database` to persist invoice ledgers with integer minor units.
- **Milestone 3.3: Operations & Support Packages**
  - Port support tickets, internal comments, and SLA countdowns into `@bazion/support`.
  - Port AES-256-GCM encrypted client secret management into `@bazion/vault`.
- **Milestone 3.4: Project Delivery Milestones**
  - Port the 5-milestone sprint roadmap into `@bazion/projects`, linking delivery milestones directly to tenant organizations.

### Phase 4: Full Consolidation & Monorepo Retirement (Weeks 11–12)
- **Milestone 4.1: Public Marketing & Quote Builder Migration**
  - Migrate Next.js marketing pages, service catalogs, quote builder, and case studies into `apps/storefront` (or a dedicated `apps/marketing` application).
- **Milestone 4.2: Final DNS Cutover & Traffic Migration**
  - Update Traefik routing rules and DNS records for `bazion.com` to point directly to the unified monorepo.
  - Execute end-to-end data integrity validation across all active clients and subscriptions.
- **Milestone 4.3: Legacy Repository Decommissioning**
  - Tag, archive, and set `D:\bazionweb` to read-only in version control.
  - Decommission legacy Docker containers and standalone database instances.

---

## 8. Risk Analysis, Mitigations & Operational Invariants

### 8.1 Critical Pre-Sync Blockers & Code Defect Catalog

A rigorous code audit of both `D:\bazionweb` and `bazionwebs-platform` identified nine critical blockers and implementation defects that must be surfaced and resolved prior to executing cross-system synchronization:

1. **Transactional Outbox Hook Point Gap (`D:\bazionweb`)**:
   - *Observation*: In `D:\bazionweb/apps/api/src/modules/billing/billing.service.ts:1875`, `BillingService.markPaid` emits the `invoice.paid` event. However, automated payment capture via Paystack webhooks (`webhooks.controller.ts`), Safaricom Daraja STK push callbacks, and scheduled subscription renewal cron runs are handled by `PaymentSettlementService` (`payment-settlement.service.ts`). `PaymentSettlementService` updates invoice and subscription rows directly using Prisma transactions *without* invoking `BillingService.markPaid` or emitting `invoice.paid`.
   - *Impact*: Listening to `invoice.paid` or hooking into `BillingService.markPaid` would capture only manual staff mark-paid actions, missing 100% of automated real-time customer settlements.
   - *Resolution*: Outbox insertion statements (`sync_outbox`) must be written directly inside `PaymentSettlementService` Prisma `$transaction` blocks alongside the `Invoice` and `Subscription` updates.

2. **Absence of Auto-Dunning & Auto-Suspension Cron (`D:\bazionweb`)**:
   - *Observation*: In `D:\bazionweb`, the scheduled dunning task `markOverdueInvoices` only transitions unpaid invoices past their due date to `status: OVERDUE` and generates an administrative notification alert. It contains no logic to count grace days, compute grace-period expiry, or automatically flip `Subscription.status` or `Client.status` to `SUSPENDED`.
   - *Impact*: Subscription renewal failure events (`subscription.status_changed: SUSPENDED`) would never be automatically generated for overdue accounts, leaving unpaid client tenants active indefinitely unless manually suspended by staff.
   - *Resolution*: Build an automated grace-period expiry scheduler in `D:\bazionweb` (e.g., 7-day post-due grace) that transitions subscription state to `SUSPENDED` and writes the corresponding outbox event.

3. **View-As Sandbox Impersonation Mutation Gap (`D:\bazionweb`)**:
   - *Observation*: The View-As Client impersonation feature in `apps/api/src/modules/diagnostics/diagnostics.service.ts` issues a 15-minute JWT token with claims `isSandbox: true` and `impersonatedBy`. While the client portal displays a yellow sandbox banner and isolates the token in `sessionStorage`, backend NestJS API controllers lack HTTP method mutation blocking (`POST`/`PUT`/`PATCH`/`DELETE`).
   - *Impact*: Any mutating HTTP call issued using an impersonation token executes directly against live production records with no restriction. Furthermore, forwarding this token across an SSO bridge to `bazionwebs-platform` would permit unauthorized operator mutations in tenant workspaces.
   - *Resolution*: Add a NestJS `SandboxGuard` rejecting all mutating HTTP verbs on `isSandbox` sessions with HTTP 403 `FORBIDDEN_IN_SANDBOX`. Strictly prohibit `isSandbox` tokens from being exchanged across Better-Auth SSO.

4. **Production Tenant Spoofing Vulnerability (`bazionwebs-platform`)**:
   - *Observation*: In `apps/api/src/lib/tenant-resolution.ts:11-16`, `resolveTenantId` evaluates `explicitTenantSlugOrId` (from request header `x-bazion-tenant` or query parameter `?tenant=`) *before* resolving host-based routing (`cleanHost`), with **no environment check** (`NODE_ENV === 'production'`) or resolution mode check.
   - *Impact*: In production, an attacker can spoof any tenant context and access or mutate another tenant's data simply by sending an `x-bazion-tenant` header.
   - *Resolution*: Guard explicit tenant resolution so it is disabled in production unless the caller is authenticated as a platform operator (`platform_owner`/`platform_admin`). Restrict tenant resolution to verified subdomain or custom domain hostnames.

5. **DNS TXT Challenge Hostname Mismatch (`bazionwebs-platform`)**:
   - *Observation*: Code inspection of `apps/api/src/modules/admin/domain-verification.ts:15,54` reveals that the DNS TXT query is performed against `_bazionweb-challenge.<hostname>` (e.g. `_bazionweb-challenge.shop.example.com`), **not** `_bazion-challenge.<domain>`.
   - *Impact*: Instructions advising tenants to configure `_bazion-challenge.<domain>` will fail DNS challenge verification 100% of the time.
   - *Resolution*: Standardize documentation, API responses, and client portal guidance on `_bazionweb-challenge.<hostname>`.

6. **Admin & Troubleshooting Route Code Defects (`bazionwebs-platform`)**:
   - *Observation*:
     a. `apps/api/src/modules/admin/routes.ts:510,523` omits `$` prefixes in raw SQL parameter interpolation (`ILIKE ${values.length}`, `LIMIT ${pageValues.length - 1} OFFSET ${pageValues.length}`), causing PostgreSQL syntax errors and a 100% failure rate for `GET /admin/platform/tenants/:tenantId/audit`.
     b. `troubleshooting-routes.ts:1007-1013` writes a `maintenance_mode` toggle into `ministry_settings`, but no code in the API or storefront reads or enforces this flag.
     c. `troubleshooting-routes.ts:1381-1392` checks `typeof (app as any).rateLimit?.resetKey === "function"`; since `resetKey` does not exist on Fastify's rate-limit instance, instead of throwing an unhandled crash, it silently no-ops while returning `success: true` (a deceptive false positive that does not actually reset the rate-limit bucket).
     d. `apps/admin` gates privileged administrative endpoints strictly via `requirePlatformOwner`.
   - *Resolution*: Add `$` prefixes to parameter interpolation in `routes.ts`, deprecate or wire readers to `maintenance_mode`, and replace the no-op `resetKey` check with valid Fastify rate-limiter store calls.

7. **Module Defaults, Vertical Seeding & Dokploy Swarm Secret Blocker (`bazionwebs-platform`)**:
   - *Observation*:
     a. `apps/api/src/modules/admin/module-catalog.ts` sets `defaultEnabled: true` on `commerce`, `analytics`, and `church-ministry`, and `afterCreateOrganization` hardcodes church profile seeding and `${slug}.localhost` domain creation.
     b. `media-storage` is not a registered module in `module-catalog.ts` (storage is managed by `@bazion/storage`).
     c. `DockerSecretTenantHostingSecretResolver` (`apps/api/src/modules/hosting/secrets.ts:45-99`) requires pre-mounted secret files (`/run/secrets/bazion-hosting-{tenantId}-{template}`) on the API container file system. Furthermore, `DokployComposeProvider` rejects non-`https://` URLs and lacks container stop/remove endpoints.
   - *Impact*: Unattended per-tenant Dokploy stack deployment cannot succeed without manual filesystem secret mounting.
   - *Resolution*: Parameterize `afterCreateOrganization` to seed vertical modules based on purchased package type, and target **shared multi-tenant runtime tenants** (with Row-Level Security) for Phase 1 automated checkout provisioning until dynamic secret creation APIs are developed.

8. **Git Branch Divergence & Migration Sequence Collision (`bazionwebs-platform`)**:
   - *Observation*: Packages `@bazion/website-contracts`, `@bazion/sme-website-template`, `@bazion/forms`, and `@bazion/product-installations` reside on the diverged branch `feature/church-ministry-platform`. On this branch, migration files are numbered `0016`–`0021`. However, migrations `0016_tenant_hosting_deployments.sql` and `0017_hosting_reconciliation_schedule.sql` were merged on trunk / `feat/provider-neutral-deployment-contract`.
   - *Impact*: Merging or rebasing without renumbering will overwrite or collide with existing migrations in `__drizzle_migrations`.
   - *Resolution*: Renumber migrations `0016`–`0021` on `feature/church-ministry-platform` to `0018`–`0023` prior to merging into trunk.

9. **Frontend Lockfile Deletion (`D:\bazionweb`)**:
   - *Observation*: In `D:\bazionweb` commit `af533ec8` (Nov 11, 2026), `apps/web/package-lock.json` was deleted.
   - *Impact*: Web frontend builds and CI verification in `D:\bazionweb` will fail or produce non-deterministic dependency trees.
   - *Resolution*: Regenerate `apps/web/package-lock.json` using `npm install --package-lock-only` in `apps/web`.

---

### 8.2 Architectural Hardening & Resilience Invariants

To achieve enterprise-grade reliability and zero data loss across both repositories, the synchronization architecture enforces three mandatory hardening specifications:

#### 1. OAuth 2.0 Backend-For-Frontend (BFF) Architecture (RFC 9700)
- Browser single sign-on across `D:\bazionweb/portal` and `bazionwebs-platform` tenant admin workspaces must conform strictly to **RFC 9700** (OAuth 2.0 for Browser-Based Apps):
  - **No Tokens in Storage**: Access and refresh tokens are stored exclusively in secure, confidential server-side session stores. Browsers receive only `__Host-Http-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` session cookies.
  - **PKCE with S256**: All authorization code exchanges must enforce Proof Key for Code Exchange (PKCE) with `code_challenge_method: S256`.
  - **RFC 8693 Token Exchange**: Backend services exchange user session tokens for tenant-scoped access tokens using the RFC 8693 specification.
  - **Zero Credentials in URLs**: Authorization codes, claim tokens, and session identifiers are strictly barred from URL query strings or fragment identifiers.

#### 2. Fetch-On-Notify Pattern & Monotonic Sequence Numbering
- Public webhooks are prone to network jitter, out-of-order delivery, and duplicate transmissions.
- Direct payload processing can cause a delayed `SUSPENDED` webhook to overwrite a subsequent `ACTIVE` webhook.
- **Enforced Invariant**:
  - Outbox events must carry a strictly increasing integer sequence number (`sequenceNumber: bigint`) and entity `version`.
  - Consumers enforce the **Fetch-On-Notify** pattern: Webhooks serve as invalidation triggers notifying the consumer of `{ entityType, entityId, version }`. The consumer retrieves the authoritative current record from the producer's authenticated REST endpoint before applying mutations.
  - If payload processing is used, consumers must verify `incoming.version > current.version` before mutating local state; stale events are acknowledged and discarded idempotently.

#### 3. Scheduled Cross-System Reconciliation Loop with Fail-Safe Abort
- A background reconciliation loop runs periodically (hourly/daily) to detect state drift between `D:\bazionweb` subscriptions and `bazionwebs-platform` tenant entitlements.
- **Fail-Safe Invariant**: If upstream APIs encounter partial failures, network timeouts, rate-limiting, or paginated query degradation, the reconciliation job **must immediately abort** its execution pass. Under no circumstances may an automated reconciliation sweep initiate tenant suspension, entitlement stripping, or container deprovisioning based on an incomplete or failed sync dataset.

---

### 8.3 Operational Invariants & Data Integrity Guards

#### 1. Currency Representation Discrepancy
- **Risk**: `D:\bazionweb` stores money as `Decimal(12,2)`, whereas `bazionwebs-platform` strictly enforces integer minor units (`amountMinor: bigint`, e.g. KES 25,000.00 is stored as `2500000n`). Unhandled conversions will cause 100x pricing errors.
- **Mitigation**: The event serialization contract in `sync_outbox` must execute explicit numeric transformation:
  ```typescript
  const amountMinor = BigInt(Math.round(decimalAmount.toNumber() * 100));
  ```
  All cross-platform schema validation schemas in `@bazion/api-contracts` enforce integer minor units.

#### 2. Port and Local Cookie Collisions
- **Risk**: In local development, running both Next.js applications on identical hostnames or ports causes browser cookie collisions across `auth_session` and `bw_cart` cookies.
- **Mitigation**: Strict port assignments enforced in local scripts:
  - `D:\bazionweb`: Web port 3000, API port 4000.
  - `bazionwebs-platform`: Storefront port 3100, Admin port 3001, API port 4100.
  - Local domain isolation via `hosts` file: `agency.localhost` vs `platform.localhost`.

#### 3. Database Migration Collision
- **Risk**: Merging databases prematurely or sharing database connections between Prisma and Drizzle causes migration lock deadlocks and conflicting advisory locks.
- **Mitigation**: Maintain complete database process and connection isolation across `agency_db` and `platform_db` throughout Phases 1 and 2. Migrations for each database execute independently via separate CI pipelines.

#### 4. Idempotency & Deduplication Invariant
- **Risk**: Network retries during outbox webhook delivery cause duplicate tenant provisioning or redundant container launches.
- **Mitigation**: All webhook consumers enforce mandatory idempotency keys (`idempotencyKey`) recorded in `public.webhook_events` within the same transaction as the provisioning mutation:
  ```typescript
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(webhookEvents).where(eq(webhookEvents.idempotencyKey, key));
    if (existing.length > 0) return { status: 'already_processed' };
    await tx.insert(webhookEvents).values({ idempotencyKey: key, eventType });
    // Execute provisioning action...
  });
  ```

---

## 9. Independent Verification Guide

To independently verify the observations, structural mappings, and code citations documented in this report:

### 1. Verify `D:\bazionweb` Architecture & Schemas
```powershell
# Inspect Prisma schema for 26 models and 20 enums
Get-Content -Path "D:\bazionweb\prisma\schema.prisma" | Select-String -Pattern "model User", "model Client", "model Subscription", "model PriceBook", "model HostingAccount"
Get-Content -Path "D:\bazionweb\prisma\schema.prisma" | Select-String -Pattern "enum "

# Inspect VAT registration default (defaults to false; commit defd14ea)
Get-Content -Path "D:\bazionweb\apps\api\src\modules\billing\billing.service.ts" | Select-String -Pattern "COMPANY_VAT_REGISTERED"

# Inspect Wise account manual remittance (no live API integration)
Get-Content -Path "D:\bazionweb\apps\api\src\modules\billing\billing.service.ts" | Select-String -Pattern "wiseAccountId", "MANUAL-"

# Inspect in-memory DDL generation in DatabaseTenancyHelper
Get-Content -Path "D:\bazionweb\apps\api\src\modules\hosting\database\database-tenancy.helper.ts" -TotalCount 40

# Inspect canonical pricing catalog and dual-market rules
Get-Content -Path "D:\bazionweb\apps\api\src\modules\pricing\canonical-catalog.ts" -TotalCount 60

# Inspect guest checkout and 72-hour account claim token minting
Get-Content -Path "D:\bazionweb\apps\api\src\modules\billing\billing.service.ts" | Select-String -Pattern "resolveGuestIdentity", "claim_"

# Inspect automated 5-milestone project roadmap provisioning
Get-Content -Path "D:\bazionweb\apps\api\src\modules\billing\payment-settlement.service.ts" | Select-String -Pattern "provisionProjectFromProposalInvoice"

# Inspect Admin Diagnostics & View-As Impersonation Sandbox
Get-Content -Path "D:\bazionweb\apps\api\src\modules\diagnostics\diagnostics.service.ts" | Select-String -Pattern "impersonate", "proactiveScan"
```

### 2. Verify `bazionwebs-platform` Architecture & Contracts
```powershell
# Inspect Turborepo configuration and workspace apps
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\package.json"
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\turbo.json"

# Inspect tenant resolution explicit override behavior
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\apps\api\src\lib\tenant-resolution.ts" | Select-String -Pattern "explicitTenantSlugOrId"

# Inspect DNS TXT challenge hostname (_bazionweb-challenge.<hostname>)
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\apps\api\src\modules\admin\domain-verification.ts" | Select-String -Pattern "_bazionweb-challenge"

# Inspect admin audit SQL parameter interpolation in routes.ts
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\apps\api\src\modules\admin\routes.ts" | Select-String -Pattern "ILIKE", "OFFSET"

# Inspect Drizzle multi-tenant schema and Forced RLS
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\packages\database\migrations\0001_initial.sql" | Select-String -Pattern "FORCE ROW LEVEL SECURITY"

# Inspect Better-Auth organization provisioning hooks
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\packages\auth\src\server.ts" | Select-String -Pattern "beforeCreateOrganization", "afterCreateOrganization"

# Inspect fail-closed dedicated database connection router
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\apps\api\src\lib\database.ts" | Select-String -Pattern "TENANT_DATABASE_BINDING_NOT_READY"

# Inspect commercial offerings delegation to D:\bazionweb
Get-Content -Path "d:\bazionweb-platform\bazionwebs-platform\products\commercial-offerings.json" -TotalCount 20
```

### 3. Run Repository Health Test Suite
Execute the platform export resolution and manifest validation test suite to confirm zero regressions:
```powershell
cd d:\bazionweb-platform\bazionwebs-platform
node --test scripts/product-manifests.test.mjs scripts/runtime-module-catalog.test.mjs scripts/ci-test-env.test.mjs scripts/package-export-resolution.test.mjs
```
*Expected Result*: 12 tests pass, 0 fails, 0 skipped.
