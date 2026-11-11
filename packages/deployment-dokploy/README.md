# Dokploy deployment adapter

This package is the first hosting-provider adapter for Bazion. The platform depends on the provider-neutral `TenantHostingProvider` port in `@bazion/platform-contracts`; Dokploy-specific HTTP details stay here.

## Current scope

- Creates an isolated Dokploy Compose resource in a pre-provisioned environment.
- Resolves environment variables just in time from `TenantHostingSecretResolver`, then saves them through Dokploy's protected API.
- Deploys, inspects, stops and removes a Compose resource.
- Returns provider-reported Compose name and environment ID from `compose.one` as non-secret identity metadata, allowing the control plane to verify tenant/template ownership during recovery. Missing identity fields remain absent and must fail closed in recovery workflows.
- Never returns environment values or raw provider payloads.
- Resource removal preserves volumes (`deleteVolumes: false`); data deletion must be a separate, explicitly approved workflow.

## Configuration

Provide the Dokploy HTTPS base URL, API key and environment ID through the deployment worker's secret/configuration system. The API key must be generated for a dedicated automation identity with the minimum supported permissions. Do not expose Dokploy's API or port 3000 publicly; route API calls over the private management network or a trusted HTTPS endpoint.

## Provisioning sequence

1. Platform authorizes the tenant and selects a versioned client template.
2. A trusted worker loads the Compose file and resolves the tenant's environment secret reference.
3. This adapter creates the Dokploy Compose resource and writes environment variables.
4. The caller persists the returned provider/resource reference against the tenant deployment record.
5. The caller starts deployment and records the resulting state and audit event.

The adapter does not create projects/environments, generate secrets, attach domains, configure DNS/TLS, run health checks, or provide rollback yet. Those are separate slices. Do not enable customer self-service deployment until authorization, durable reference storage, audit coverage, retry/idempotency and restore procedures are wired.

## Dokploy API

The adapter uses the documented `compose.create`, `compose.saveEnvironment`, `compose.deploy`, `compose.one`, `compose.stop` and `compose.delete` endpoints. Dokploy API reference: https://docs.dokploy.com/docs/api/compose
