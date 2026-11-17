"use client";

import React from "react";
import { BrowserRouter } from "./shims/react-router-dom";
import App from "./App";
import { TenantProvider } from "./context/TenantContext";
import type { SchoolPortalConfig } from "@bazion/education-contracts";

export interface PortalAppProps {
  basename?: string;
  tenantConfig?: SchoolPortalConfig;
}

export function PortalApp({ basename = "/portal", tenantConfig }: PortalAppProps) {
  return (
    <TenantProvider config={tenantConfig}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </TenantProvider>
  );
}

export default PortalApp;
export { api, ApiError } from "./lib/api";
export { AuthProvider, useAuth } from "./hooks/useAuth";
export { TenantProvider, useTenantConfig } from "./context/TenantContext";
export { BrowserRouter, MemoryRouter } from "./shims/react-router-dom";

