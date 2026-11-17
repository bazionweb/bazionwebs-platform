"use client";

import React, { createContext, useContext } from "react";
import {
  bmiUniversityTenantConfig,
  type SchoolPortalConfig,
} from "@bazion/education-contracts";

const EducationTenantContext = createContext<SchoolPortalConfig>(bmiUniversityTenantConfig);

export interface EducationTenantProviderProps {
  config?: SchoolPortalConfig;
  children: React.ReactNode;
}

export function EducationTenantProvider({
  config = bmiUniversityTenantConfig,
  children,
}: EducationTenantProviderProps) {
  return (
    <EducationTenantContext.Provider value={config}>
      {children}
    </EducationTenantContext.Provider>
  );
}

export function useEducationTenant(override?: SchoolPortalConfig): SchoolPortalConfig {
  const ctx = useContext(EducationTenantContext);
  return override ?? ctx ?? bmiUniversityTenantConfig;
}

