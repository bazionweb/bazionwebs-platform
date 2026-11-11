# Platform-owner tenant hosting provisioning

The API exposes one guarded operation for the first controlled tenant deployment:

`POST /v1/admin/platform/tenants/{tenantId}/hosting/provision`

It is not a tenant self-service endpoint. Only an authenticated `platform_owner` may call it. The request body accepts only a template name, and the caller must provide an `Idempotency-Key` HTTP header. Client-supplied Compose YAML, environment values, secret references, provider IDs, or template versions are rejected.

## Runtime configuration

Hosting is disabled by default. To enable the Dokploy adapter on the API service, configure all of:

- `HOSTING_PROVIDER=dokploy`
- `DOKPLOY_BASE_URL=https://server.example.com`
- `DOKPLOY_API_KEY` (store this in the API platform's secret store, never in source control)
- `DOKPLOY_ENVIRONMENT_ID`
- Optional: `DOKPLOY_SERVER_ID`
- `HOSTING_SECRET_DIRECTORY=/run/secrets`
- `HOSTING_TEMPLATE_DIRECTORY=/app/deploy/client-templates` (use the actual path inside the deployed API image)

The Dokploy adapter rejects non-HTTPS URLs. The API image must include the three checked-in Compose files under the configured template directory. Template versions are recorded as a SHA-256 digest of the exact Compose file contents.

Do not enable the provider until the API process can read the required mounted Docker secrets and all referenced image tags have been tested.

## Tenant environment secrets

Environment data is never accepted through the provisioning API. The API derives a tenant- and template-specific reference:

`docker-secret://bazion-hosting-{tenant-uuid}-{template}`

At runtime, the resolver reads the corresponding read-only Docker Swarm secret file from `HOSTING_SECRET_DIRECTORY`. The secret file must contain one JSON object whose values are strings. It must be readable by the API process and must not be group- or world-writable. Symlinks are rejected. Maximum file size is 64 KiB.

Required values:

- `wordpress`: `WORDPRESS_IMAGE`, `MARIADB_IMAGE`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`
- `node-nextjs`: `APP_IMAGE`
- `ecommerce`: `APP_IMAGE`, `POSTGRES_IMAGE`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

Additional application environment keys are allowed, except process/Compose/Docker control variables. Values must be single-line strings. Image variables must use a version tag or immutable SHA-256 digest; `:latest` and example placeholders are rejected.

Example JSON structure (use real generated values only in a secure local file, never in Git):

```json
{
  "APP_IMAGE": "ghcr.io/your-org/client-app:1.4.2",
  "DATABASE_URL": "postgres://client_app:generated-password@db/client"
}
```

Create a Docker Swarm secret from a protected file; do not put JSON values directly in shell history:

```bash
docker secret create bazion-hosting-<tenant-uuid>-node-nextjs /secure/path/tenant-env.json
```

Mount that secret into the API Swarm service at the exact target filename in `/run/secrets`. For versioned rotation, create a new immutable Swarm secret (for example with a `-v2` suffix) and mount it using the stable target filename expected by the resolver. Do not grant the API service access to unrelated tenant secrets.

## Request

```http
POST /v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/hosting/provision
Idempotency-Key: tenant-11111111-node-nextjs-v1
Content-Type: application/json

{
  "template": "node-nextjs"
}
```

Successful requests return HTTP 202 and a deployment reference/state. A `deploying` state means Dokploy accepted the deploy request but has not yet confirmed the workload is running. Only a positive provider inspection records the `running` state.

The API records an append-only platform audit event before calling Dokploy. If the intent event cannot be written, provisioning does not start. Provider errors and secret values are never included in API responses or audit metadata.

## Operational limits

- The provider adapter creates one Dokploy Compose resource per tenant/template naming convention and preserves persistent volumes when deleting a resource.
- An ambiguous create result without a saved provider resource ID is held for reconciliation; the API does not blindly create a second resource.
- This endpoint is synchronous through the Dokploy create/deploy request. The Superadmin tenant detail page shows deployment records and recent events. A separate inspect-only background status reconciler is documented in [hosting-reconciler.md](../hosting-reconciler.md). A rollback workflow and safe discovery of ambiguous create results without a persisted resource ID remain future work.
- Enabling the API route does not deploy existing tenants or contact Dokploy until a platform owner explicitly calls the endpoint.
