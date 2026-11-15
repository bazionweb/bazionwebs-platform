"use client";

import React from "react";
import { BrowserRouter } from "./shims/react-router-dom";
import App from "./App";
import type { SchoolPortalConfig } from "@bazion/education-contracts";

export interface PortalAppProps {
  basename?: string;
  tenantConfig?: SchoolPortalConfig;
}

export function PortalApp({ basename = "/portal" }: PortalAppProps) {
  return (
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  );
}

export default PortalApp;
export { api, ApiError } from "./lib/api";
export { AuthProvider, useAuth } from "./hooks/useAuth";
export { BrowserRouter, MemoryRouter } from "./shims/react-router-dom";

