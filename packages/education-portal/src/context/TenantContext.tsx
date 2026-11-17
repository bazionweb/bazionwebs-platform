import React, { createContext, useContext } from "react";
import {
  bmiUniversityTenantConfig,
  type SchoolPortalConfig,
} from "@bazion/education-contracts";

const TenantContext = createContext<SchoolPortalConfig>(bmiUniversityTenantConfig);

export interface TenantProviderProps {
  config?: SchoolPortalConfig;
  children: React.ReactNode;
}

export function TenantProvider({
  config = bmiUniversityTenantConfig,
  children,
}: TenantProviderProps) {
  return (
    <TenantContext.Provider value={config}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantConfig(): SchoolPortalConfig {
  return useContext(TenantContext) ?? bmiUniversityTenantConfig;
}

