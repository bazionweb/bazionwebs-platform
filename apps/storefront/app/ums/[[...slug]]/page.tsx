import React from "react";
import { UmsApp } from "@bazion/education-ums";
import { resolveEducationTenant } from "../../../lib/education-tenant";

export default async function UmsPageRoute() {
  const education = await resolveEducationTenant();
  return (
    <div className="education-ums-root">
      <link rel="stylesheet" href="/styles/bmi-ums.css" />
      <UmsApp basename="/ums" tenantConfig={education.tenantConfig} />
    </div>
  );
}

