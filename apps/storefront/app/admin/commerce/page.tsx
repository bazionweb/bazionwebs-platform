import { CommerceDashboard } from "./commerce-dashboard";
import "./commerce-admin.css";
import { requireTenantModuleAccess } from "../../../lib/server-admin-access";

export default async function CommerceAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireTenantModuleAccess("commerce");
  const { tab } = await searchParams;
  const initialTab = tab === "orders" || tab === "settings" ? tab : "products";
  return <CommerceDashboard initialTab={initialTab} />;
}
