import React from "react";
import {
  BmiNavbar,
  BmiFooter,
  BmiCookieBanner,
  EducationTenantProvider,
  type SchoolPortalConfig,
} from "@bazion/education-template";
import { resolveEducationTenant } from "../../lib/education-tenant";

export interface EducationShellProps {
  children: React.ReactNode;
  tenantConfig?: SchoolPortalConfig;
}

export async function EducationShell({ children, tenantConfig }: EducationShellProps) {
  const resolvedConfig = tenantConfig ?? (await resolveEducationTenant()).tenantConfig;

  return (
    <EducationTenantProvider config={resolvedConfig}>
      <div className="education-site-root" style={{
        "--color-gold": resolvedConfig.branding.accentColor,
        "--color-gold-light": resolvedConfig.branding.accentColor,
        "--color-gold-dark": resolvedConfig.branding.accentColor,
        "--education-primary": resolvedConfig.branding.primaryColor,
        "--education-secondary": resolvedConfig.branding.secondaryColor,
      } as React.CSSProperties}>
        <link rel="stylesheet" href="/styles/bmi-website.css" />
        <style>{`
          .education-site-root {
            width: 100%;
            min-height: 100vh;
            margin: 0;
            padding: 0;
            background-color: #0b1528;
            color: #ffffff;
            font-family: 'Plus Jakarta Sans', sans-serif;
            isolation: isolate;
          }
          .education-site-root footer,
          .education-site-root .bmi-footer {
            display: block !important;
            width: 100% !important;
            border-top: none !important;
            padding: 0 !important;
            margin: 0 !important;
            font-family: 'Plus Jakarta Sans', sans-serif !important;
            font-size: inherit !important;
            letter-spacing: normal !important;
            color: #ffffff !important;
            box-sizing: border-box !important;
          }
          .education-site-root .footer-grid {
            display: grid !important;
            width: 100% !important;
            max-width: 1280px !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          .education-site-root .footer-bottom-bar {
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
        `}</style>
        <BmiNavbar tenantConfig={resolvedConfig} />
        <div className="education-content-wrapper">{children}</div>
        <BmiCookieBanner />
        <BmiFooter tenantConfig={resolvedConfig} />
      </div>
    </EducationTenantProvider>
  );
}
