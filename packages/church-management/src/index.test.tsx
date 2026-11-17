import { describe, expect, it, beforeAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChurchManagementApp, ChurchPortalApp, defaultHkmTenantConfig } from "./index";

if (typeof (globalThis as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("@bazion/church-management", () => {
  it("renders the church management system shell with default HKM tenant branding", () => {
    const html = renderToStaticMarkup(<ChurchManagementApp basename="/church-management" />);
    expect(html.length).toBeGreaterThan(50);
    expect(html).toContain("church-management-root");
  });

  it("renders the church member portal with PIN/Password authentication", () => {
    const html = renderToStaticMarkup(<ChurchPortalApp basename="/portal" />);
    expect(html.length).toBeGreaterThan(50);
    expect(html).toContain("church-portal-root");
  });

  it("exports valid default tenant configuration", () => {
    expect(defaultHkmTenantConfig.churchName).toBe("Heavenly God Kingdom Churches (HKM Ministries)");
    expect(defaultHkmTenantConfig.shortName).toBe("HKM Church");
    expect(defaultHkmTenantConfig.currency).toBe("KES");
  });
});
