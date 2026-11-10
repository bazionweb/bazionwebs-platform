import "./admin-shell.css";
import { AdminShell } from "./admin-shell";
import { requireTenantDashboardAccess } from "../../lib/server-admin-access";

export const metadata = { title: "Tenant Administration | Bazion Web" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const identity = await requireTenantDashboardAccess();
  const { reason } = await searchParams;
  const notice = reason === "module-disabled"
    ? "Commerce is not enabled for this workspace. Contact your platform administrator if you need it."
    : reason === "module-access-unavailable"
      ? "We could not verify access to that module. Please try again in a moment."
      : undefined;
  return <AdminShell tenantName={identity.tenant?.name ?? "Tenant"} isPlatformOwner={identity.platformRole === "platform_owner"} notice={notice} />;
}
