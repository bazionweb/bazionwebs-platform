import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, organizationRoles } from "./permissions.js";

// No baseURL is specified because the storefront proxies /api/auth/* to Fastify.
// This keeps the Better Auth session cookie first-party on each client domain.
export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles: organizationRoles,
    }),
  ],
});
