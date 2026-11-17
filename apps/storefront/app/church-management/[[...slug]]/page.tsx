import React from "react";
import { ChurchManagementApp } from "@bazion/church-management";
import { resolveChurchTenant } from "../../../lib/church-tenant";

export default async function ChurchManagementPageRoute() {
  const church = await resolveChurchTenant();

  return (
    <div className="church-management-wrapper">
      <ChurchManagementApp basename="/church-management" tenantConfig={church.tenantConfig} />
    </div>
  );
}

