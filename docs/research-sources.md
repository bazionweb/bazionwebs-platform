# Research sources and verification notes

Research baseline: **5 November 2026**. Versions change; re-check release and support pages before upgrades or production deployment.

## Runtime and frameworks

- [Node.js release schedule](https://github.com/nodejs/Release): Node 26 entered Active LTS on 28 October 2026. The README pins the recommended current 26.x line while retaining a broader engine range for local compatibility.
- [Node.js releases and support](https://nodejs.org/en/about/previous-releases): use an Active LTS or Maintenance LTS release for production.
- [Next.js support policy](https://nextjs.org/support-policy): Next.js 16 is the Active LTS major at the research baseline.
- [pnpm installation](https://pnpm.io/installation): pnpm 12 supports Node.js 26; install the pinned package manager with npm. [Corepack installation notes](https://github.com/nodejs/corepack#how-to-install) document that Corepack is no longer bundled beginning with Node.js 25.
- [pnpm workspaces](https://pnpm.io/workspaces): native workspace support for the monorepo.
- [Turborepo repository structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository): task orchestration and package boundaries for monorepos.
- [Turborepo environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables) and [configuration reference](https://turborepo.dev/docs/reference/configuration): strict mode filters undeclared variables; this starter declares server settings in `globalPassThroughEnv` and build-affecting API URL in `globalEnv`.
- [Fastify documentation](https://fastify.dev/docs/latest/): API framework and plugin architecture.
- [Fastify CORS plugin](https://www.npmjs.com/package/@fastify/cors): 11.x is compatible with Fastify 5.
- [Fastify Helmet plugin](https://www.npmjs.com/package/@fastify/helmet): 13.x is compatible with Fastify 5.
- [Fastify rate-limit plugin](https://www.npmjs.com/package/@fastify/rate-limit): 11.x is compatible with Fastify 5.
- [node-postgres](https://www.npmjs.com/package/pg): PostgreSQL client and connection pooling.
- [Drizzle ORM transactions](https://orm.drizzle.team/docs/transactions): use database transactions for checkout state transitions.
- [Zod documentation](https://zod.dev/): runtime schemas and shared input contracts.
- [Vitest documentation](https://vitest.dev/): unit and integration test runner.

## Database and isolation

- [PostgreSQL 18 row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html): RLS policy behavior, `USING` and `WITH CHECK`, and the need to account for table-owner and privileged roles.
- [PostgreSQL 18 CREATE POLICY](https://www.postgresql.org/docs/18/sql-createpolicy.html): policy expressions and command-specific access checks.

## Payments and checkout

- [OWASP Third-Party Payment Gateway Integration Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html): server-side amount verification, callback validation, state handling and secure integration patterns.
- [Stripe webhooks](https://docs.stripe.com/webhooks): asynchronous payment state notifications and server-side fulfillment.
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature): verify signatures against the raw request body and endpoint secret.
- [Safaricom Daraja developer portal](https://developer.safaricom.co.ke/): official M-Pesa API reference and sandbox for validating the implemented STK Push adapter.

## AI integration

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk): use the current SDK for an optional MCP adapter after the application API and permission model are stable.

## Design decisions from the research

1. Start with a modular monorepo and modular monolith; extract a service only when independent deployment, ownership or scaling justifies the added operational cost.
2. Reuse application packages and APIs in ordinary websites. MCP is an optional AI-facing adapter, not the runtime implementation of the shopping cart.
3. Use integer minor units for money, recalculate totals on the server, and reserve stock under database locks during checkout.
4. Treat payment redirects as user experience only. A verified provider notification and reconciliation process must establish the authoritative payment state.
5. Use tenant-scoped predicates, composite tenant-aware foreign keys, transaction-local tenant context and PostgreSQL RLS together. RLS is defense in depth, not a substitute for identity or authorization.
6. Keep the initial repository private unless Bazion deliberately selects and documents an open-source license for its own source code. Open-source dependencies do not automatically make Bazion's source code open source.

## Hosting and free-tier verification

- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/): Cloudflare's guide recommends vinext for new Next.js deployments and currently labels it beta.
- [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/): existing adapter support and migration guidance.
- [Cloudflare Pages and Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/): Pages is for static exports; full-stack Next.js uses Workers.
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Free plan usage limits and paid plan model.
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase): Free plan project count and resource quotas.
- [Supabase free project pausing](https://supabase.com/kb/faqs/platform/free-project-pausing): pause behavior after inactivity.
- [Render free services](https://render.com/docs/free): spin-down, ephemeral filesystem and free Postgres expiry caveats.
- [Railway free trial and plan](https://docs.railway.com/pricing/free-trial): the trial and ongoing free-credit model.
- [GitHub Actions billing and allowances](https://docs.github.com/en/billing/reference/product-usage-included): plan-dependent included minutes and storage.
