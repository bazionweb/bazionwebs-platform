"use client";

import React, { createContext, useContext } from "react";

export interface ChurchManagementTenantConfig {
  churchName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  primaryColor?: string;
  contact?: {
    address?: string;
    phone?: string;
    email?: string;
  };
  currency?: string;
}

export const defaultHkmTenantConfig: ChurchManagementTenantConfig = {
  churchName: "Heavenly God Kingdom Churches (HKM Ministries)",
  shortName: "HKM Church",
  tagline: "Church Management & Member Discipleship Portal",
  logoUrl: "/hkm-logo.webp",
  primaryColor: "#16a34a",
  contact: {
    address: "Nairobi Central & Multi-Branch Regional Campuses",
    phone: "+254 700 000 001",
    email: "info@hkmministries.org",
  },
  currency: "KES",
};

const TenantContext = createContext<ChurchManagementTenantConfig>(defaultHkmTenantConfig);

export interface TenantProviderProps {
  config?: Partial<ChurchManagementTenantConfig>;
  children: React.ReactNode;
}

export function TenantProvider({ config, children }: TenantProviderProps) {
  const merged: ChurchManagementTenantConfig = {
    ...defaultHkmTenantConfig,
    ...config,
    contact: {
      ...defaultHkmTenantConfig.contact,
      ...config?.contact,
    },
  };

  return <TenantContext.Provider value={merged}>{children}</TenantContext.Provider>;
}

export function useTenantConfig(): ChurchManagementTenantConfig {
  return useContext(TenantContext) ?? defaultHkmTenantConfig;
}

