# Staging tenant preview domains

New tenant workspaces use a stable preview URL derived from their URL slug:

```text
<tenant-slug>.preview.bazionweb.com
```

For example, the slug `st-jude-outreach` becomes `https://st-jude-outreach.preview.bazionweb.com`. The platform API registers this server-owned hostname during organization provisioning. Cloudflare wildcard DNS and the shared Traefik route send it to the platform storefront; no DNS record is created per tenant. Customer-owned domains continue to use the TXT ownership verification flow.

## One-time staging ingress setup

Do these steps before deploying the updated platform images. Existing `<tenant-slug>.bazionweb.com` preview links remain available during the transition.

1. In Cloudflare DNS for `bazionweb.com`, add an `A` record named `*.preview` pointing to the VPS IPv4 address. Set it to **Proxied** and **Auto TTL**.
2. In Cloudflare SSL/TLS, create a Cloudflare Origin Certificate covering `*.preview.bazionweb.com` (and optionally `preview.bazionweb.com`). Keep the private key private; do not commit or paste it into chat.
3. On the VPS, install the downloaded certificate and private key at:

   ```text
   /etc/dokploy/traefik/dynamic/certificates/tenant-preview/origin-cert.pem
   /etc/dokploy/traefik/dynamic/certificates/tenant-preview/origin-key.pem
   ```

   Set the key owner to `root:root` and mode `0600`; the certificate can be `root:root` mode `0644`.
4. Copy [tenant-preview-namespaced.yml](./traefik/tenant-preview-namespaced.yml) into `/etc/dokploy/traefik/dynamic/tenant-preview-namespaced.yml`. The Traefik file provider watches this directory and reloads dynamic configuration. The rule is written in Traefik v3 syntax and only matches one tenant slug under `preview.bazionweb.com`.
5. Confirm the Traefik logs show no configuration or certificate errors. Then deploy the platform images built from this branch. The staging API, admin, and storefront must all use `TENANT_PREVIEW_BASE_DOMAIN=preview.bazionweb.com`.
6. Provision a test tenant and open the preview URL shown in the platform. It should load over HTTPS and resolve to that tenant.

Keep the existing root-level preview route until the new namespace is confirmed working. The existing `*.bazionweb.com` certificate does not cover nested hosts such as `tenant.preview.bazionweb.com`; the new wildcard certificate is required for Cloudflare Full (strict).
