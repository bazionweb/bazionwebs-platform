import React from "react";
import { PortalApp } from "@bazion/education-portal";
import { resolveEducationTenant } from "../../../lib/education-tenant";

export default async function PortalPageRoute() {
  const education = await resolveEducationTenant();
  return (
    <div className="education-portal-root">
      <link rel="stylesheet" href="/styles/bmi-portal.css" />
      <PortalApp basename="/portal" tenantConfig={education.tenantConfig} />
    </div>
  );
}

