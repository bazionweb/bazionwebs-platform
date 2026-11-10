# Bootstrap the first Bazion platform owner

The Better Auth Organization plugin limits client-organization creation to active `platform_owner` and `platform_admin` accounts. Platform roles are separate from tenant organization roles.

## Initial bootstrap

1. Create an operator account through the normal sign-up flow and verify its email.
2. In a protected operator shell, set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_CONFIRM_EMAIL` to the same verified account address.
3. Run `pnpm platform:create-admin` with `MIGRATION_DATABASE_URL` available.

The command only links an existing verified account. It refuses an existing platform membership, records an append-only audit event, and never creates or changes a password. Do not put the one-time account variables in a shared `.env` file.

## Production bootstrap

Use a reviewed deployment procedure with an authorized operator present. Do not expose a public endpoint that lets a user assign themselves a platform role. Retain the separate approval/change record identifying who authorized the initial owner.

## Adding more platform operators

Use the audited administrative operation to add or suspend platform members. A suspended platform member immediately loses platform checks on the next request; their ordinary client-organization memberships remain separate.

## Client owner assignment

A platform operator who creates a client organization receives the tenant-scoped `admin` role, not `owner`. After confirming the client authorization, a platform owner/admin can assign the nominated client owner through the audited ownership-transfer workflow. Better Auth hooks deny ordinary owner invitations and role changes.
