# Bootstrap the first Bazion platform owner

The Better Auth Organization plugin is configured so ordinary users cannot create client organizations. Only active `platform_owner` and `platform_admin` records in `public.platform_members` can provision organizations.

This prevents any newly registered customer from creating arbitrary client tenants.

## Local bootstrap

1. Start the local API and PostgreSQL database.
2. Visit `http://localhost:3000/login`, create your Bazion operator account and verify the email. When SMTP is blank in local development, the verification link is printed in the API console.
3. Sign in and request `GET http://localhost:4000/v1/auth/me` with the browser's session cookie. The response contains the signed-in `user.id`, `user.email` and `user.emailVerified`.
4. Confirm `emailVerified` is `true`. Then connect using the migration/admin database credentials and insert the platform member.

Example SQL (replace both placeholders with the values returned by your authenticated `/v1/auth/me` response):

```sql
INSERT INTO public.platform_members (user_id, email, role, status)
VALUES ('BETTER_AUTH_USER_ID', 'verified-operator@example.com', 'platform_owner', 'active')
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    role = 'platform_owner',
    status = 'active',
    updated_at = now();
```

The migration role owns the table created by migration `0002_auth_tenant_registry.sql`. Never give the platform owner role to an unverified or unknown account.

## Production bootstrap

Perform the same process through an audited administrative deployment procedure. Do not expose a public endpoint that lets a user assign themselves a platform role. Keep the bootstrap SQL out of client-facing code and record who authorized the initial owner.

## Adding more platform operators

Use an audited administrative operation (to be implemented with the platform admin area) to add or suspend platform members. Until that interface exists, use a reviewed database change and retain the change record. A suspended platform member immediately loses platform-admin checks on the next request; their ordinary client-organization memberships are separate.

## Client owner assignment and organization creator role

A Bazion platform operator who creates a new client organization receives the tenant-scoped `admin` role, not `owner`. After verifying the client authorization, a platform owner/admin can invite the nominated client owner with the `owner` role. The Better Auth organization hooks deny owner invitations and owner-role changes by users who are not active Bazion platform owners/admins. Normal client admins may invite staff into narrower roles.

