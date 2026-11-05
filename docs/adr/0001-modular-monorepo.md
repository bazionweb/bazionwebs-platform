# ADR 0001: Modular monorepo, modular monolith first

- Status: Accepted for initial platform
- Date: 2026-11-05

## Context

Bazion needs shared software blocks across many client apps, while retaining ownership, cost control and the option to deploy clients independently.

## Decision

Use pnpm workspaces + Turborepo in a TypeScript monorepo. Keep domain logic in independent packages, use a modular Fastify API and PostgreSQL, and create independent app deployments when client requirements need them. Do not introduce microservices until operational evidence supports extraction.

## Consequences

Fewer repositories and simpler refactoring initially; package boundaries and release discipline are required. A shared source repository does not require shared runtime data or shared deployments.
