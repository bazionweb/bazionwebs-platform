import { CommerceDashboard } from "./commerce-dashboard";
import "./commerce-admin.css";

export default async function CommerceAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === "orders" || tab === "settings" ? tab : "products";
  return <CommerceDashboard initialTab={initialTab} />;
}
