# Contributing to Bazion Web Platform

## Development standards

- Use TypeScript with strict compiler settings.
- Keep domain packages independent of HTTP frameworks, databases and payment-vendor SDKs.
- Put provider-specific code behind explicit adapters and shared contracts.
- Validate external input at boundaries and keep tenant context server-derived.
- Use integer minor units for all money calculations.
- Add unit tests for domain behavior and integration tests for database, RLS and payment state transitions.
- Update documentation and an ADR when a change alters an architectural boundary.

## Workflow

1. Create a short-lived feature branch.
2. Make one focused change and add tests.
3. Run `pnpm typecheck`, `pnpm test` and `pnpm build`.
4. Open a pull request with purpose, testing performed, migration impact and security impact.
5. Do not merge until CI passes and required reviews are complete.

## Package release rule

Keep packages private to the workspace until another repository genuinely needs them. When publishing, use semantic versioning, changelogs, compatibility notes and a documented deprecation path.
