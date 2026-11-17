"use client";

import React from "react";
import App from "./App";
import { AuthProvider } from "./components/AuthContext";
import { AuthorizedApolloProvider } from "./components/AuthorizedApolloProvider";
import { ClerkAuthProvider } from "./components/ClerkAuthProvider";
import { TenantProvider, ChurchManagementTenantConfig, defaultHkmTenantConfig, useTenantConfig } from "./context/TenantContext";
import { ApolloProvider } from "./shims/apollo";
import { portalApolloClient } from "./portal/services/portalApollo";
import PortalLogin from "./portal/pages/PortalLogin";
import SetPassword from "./portal/pages/SetPassword";
import MemberDashboard from "./portal/pages/MemberDashboard";
import PortalAuthGuard from "./portal/components/PortalAuthGuard";
import { HashRouter, BrowserRouter, MemoryRouter, Routes, Route } from "./shims/react-router-dom";
import "./dark-mode.css";

export interface ChurchManagementAppProps {
  basename?: string;
  tenantConfig?: Partial<ChurchManagementTenantConfig>;
}

/**
 * Complete Church Management App (Admin CMS + Member Portal)
 */
export function ChurchManagementApp({
  basename = "/church-management",
  tenantConfig,
}: ChurchManagementAppProps) {
  return (
    <TenantProvider config={tenantConfig}>
      <div className="church-management-root">
        <ClerkAuthProvider>
          <AuthProvider>
            <AuthorizedApolloProvider>
              <App />
            </AuthorizedApolloProvider>
          </AuthProvider>
        </ClerkAuthProvider>
      </div>
    </TenantProvider>
  );
}

export interface ChurchPortalAppProps {
  basename?: string;
  initialPath?: string;
  tenantConfig?: Partial<ChurchManagementTenantConfig>;
}

/**
 * Dedicated Member Portal App (Login with PIN/Password, Set Password, Member Dashboard)
 */
export function ChurchPortalApp({
  basename = "/portal",
  initialPath,
  tenantConfig,
}: ChurchPortalAppProps) {
  const RouterComponent = initialPath ? MemoryRouter : BrowserRouter;
  const routerProps = initialPath ? { initialEntries: [initialPath], basename } : { basename };

  return (
    <TenantProvider config={tenantConfig}>
      <ApolloProvider client={portalApolloClient}>
        <div className="church-portal-root">
          <RouterComponent {...(routerProps as any)}>
            <Routes>
              <Route path="/" element={<PortalLogin />} />
              <Route path="/login" element={<PortalLogin />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route
                path="/dashboard"
                element={
                  <PortalAuthGuard>
                    <MemberDashboard />
                  </PortalAuthGuard>
                }
              />
              <Route
                path="/*"
                element={
                  <PortalAuthGuard>
                    <MemberDashboard />
                  </PortalAuthGuard>
                }
              />
            </Routes>
          </RouterComponent>
        </div>
      </ApolloProvider>
    </TenantProvider>
  );
}

export default ChurchManagementApp;

// Re-exports
export { App };
export { TenantProvider, useTenantConfig, defaultHkmTenantConfig };
export type { ChurchManagementTenantConfig };
export { useMembers } from "./hooks/useMembers";
export { useAttendance } from "./hooks/useAttendance";
export { useTransactions } from "./hooks/useTransactions";
export { useVisitors } from "./hooks/useVisitors";
export { useGroups } from "./hooks/useGroups";
export { useEquipment } from "./hooks/useEquipment";
export { useSms } from "./hooks/useSms";
export { useBranches } from "./hooks/useBranches";
export { useUsers } from "./hooks/useUsers";
export { portalAuthService } from "./portal/services/portalAuth";
