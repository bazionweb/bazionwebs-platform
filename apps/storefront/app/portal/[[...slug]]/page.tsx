import React from "react";
import { PortalApp } from "@bazion/education-portal";
import { ChurchPortalApp } from "@bazion/church-management";
import { resolveEducationTenant } from "../../../lib/education-tenant";
import { resolveChurchTenant } from "../../../lib/church-tenant";

export default async function PortalPageRoute() {
  const [education, church] = await Promise.all([
    resolveEducationTenant(),
    resolveChurchTenant(),
  ]);

  if (church.isHkm) {
    return (
      <div className="church-portal-wrapper">
        <ChurchPortalApp basename="/portal" tenantConfig={church.tenantConfig} />
      </div>
    );
  }

  return (
    <div className="education-portal-root">
      <link rel="stylesheet" href="/styles/bmi-portal.css" />
      <PortalApp basename="/portal" tenantConfig={education.tenantConfig} />
    </div>
  );
}

