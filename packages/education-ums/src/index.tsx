"use client";

import React, { useEffect, useState } from "react";
import "./i18n";
import App from "./App";
import { BrowserRouter } from "./shims/react-router-dom";
import { AccessibilityProvider } from "./components/AccessibilityProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "./shims/tanstack-react-query";
import { useUIStore } from "./stores/uiStore";
import { TenantProvider } from "./context/TenantContext";
import type { SchoolPortalConfig } from "@bazion/education-contracts";

const PRINT_PROTOCOL_CSS = `
  @media print {
    .no-print { display: none !important; }
    @page { size: auto; margin: 10mm; }
    html, body {
      height: auto !important;
      overflow: visible !important;
      background-color: white !important;
      color: #1a1a1a !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .grid, .flex-row, .pdf-stack, .pdf-section {
      display: block !important;
      width: 100% !important;
      position: static !important;
      clear: both !important;
    }
    .grid > div, .pdf-section > div {
      width: 100% !important;
      margin-bottom: 30px !important;
      page-break-inside: avoid !important;
    }
    div[class*="bg-white"], .pdf-section, .pdf-ai-panel {
      position: relative !important;
      border: 1px solid #e5e7eb !important;
      box-shadow: none !important;
      background: white !important;
    }
    .pdf-chart-fixed {
      height: 400px !important;
      min-height: 400px !important;
      width: 100% !important;
      overflow: visible !important;
      padding-right: 20px !important;
    }
    .recharts-responsive-container {
      width: 98% !important;
      margin: 0 auto !important;
    }
    .pdf-page-break {
      page-break-before: always !important;
      break-before: page !important;
      margin-top: 50pt !important;
    }
    .absolute, .fixed, .opacity-0, .hover\\:opacity-100 {
      position: static !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .fixed.inset-0 { display: none !important; }
  }
`;

export interface UmsAppProps {
  basename?: string;
  tenantConfig?: SchoolPortalConfig;
}

export function UmsApp({ basename = "/ums", tenantConfig }: UmsAppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("bmi-ums-print-protocol")) {
      const style = document.createElement("style");
      style.id = "bmi-ums-print-protocol";
      style.textContent = PRINT_PROTOCOL_CSS;
      document.head.appendChild(style);
    }
    if (tenantConfig) {
      useUIStore.getState().setInstitutionBranding({
        logo: tenantConfig.branding?.logoUrl,
        institutionName: tenantConfig.institutionName,
        shortName: tenantConfig.shortName,
        primaryColor: tenantConfig.branding?.primaryColor,
        secondaryColor: tenantConfig.branding?.secondaryColor,
        accentColor: tenantConfig.branding?.accentColor,
        tagline: tenantConfig.tagline,
        accreditationLabel: tenantConfig.accreditationLabel,
        address: tenantConfig.contact?.address,
        contactEmail: tenantConfig.contact?.registrarEmail,
        contactPhone: tenantConfig.contact?.phones?.[0],
      });
    }
  }, [tenantConfig]);

  return (
    <TenantProvider config={tenantConfig}>
      <QueryClientProvider client={queryClient}>
        <AccessibilityProvider>
          <BrowserRouter basename={basename}>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </BrowserRouter>
        </AccessibilityProvider>
      </QueryClientProvider>
    </TenantProvider>
  );
}

export default UmsApp;
export { useAuthStore } from "./stores/authStore";
export { useDataStore } from "./stores/dataStore";
export { useUIStore } from "./stores/uiStore";
export { TenantProvider, useTenantConfig } from "./context/TenantContext";
export { BrowserRouter, MemoryRouter } from "./shims/react-router-dom";
