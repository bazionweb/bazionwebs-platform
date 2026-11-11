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

/** Request a password reset using the current app origin as the trusted callback. */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<"accepted" | "rate-limited"> {
  const response = await fetch("/api/auth/request-password-reset", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, redirectTo }),
  });
  if (response.status === 429) return "rate-limited";
  if (!response.ok) throw new Error("The reset request could not be sent. Please try again later.");
  return "accepted";
}

/** Complete a reset without placing the secret token in another URL. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (response.ok) return;
  const body = await response.json().catch(() => null) as { code?: string; error?: string; message?: string } | null;
  if (body?.code === "INVALID_TOKEN" || body?.error === "INVALID_TOKEN") {
    throw new Error("This reset link is invalid or has expired. Request a new link to continue.");
  }
  if (response.status === 429) throw new Error("Too many attempts. Wait before trying again.");
  throw new Error("The password could not be changed. Check the form and request a fresh reset link if needed.");
}

export { resolveSafeRedirectTarget } from "./bff-cookies.js";
export {
  buildTenantStorefrontUrl,
  buildTenantWorkspacePickerUrl,
  resolveConfiguredWorkspaceBaseUrl,
} from "./deep-links.js";
