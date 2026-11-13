import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ChurchNav } from "./church-nav.js";
import {
  isSafeSiteNavigationHref,
  isSiteNavigationLinkActive,
  isSiteNavigationLinkCurrent,
  SiteNavigation,
} from "./site-navigation.js";

describe("shared site navigation", () => {
  it("allows same-site paths and credential-free HTTPS destinations only", () => {
    for (const href of ["/", "/about?from=home", "https://partner.example.org/join"]) {
      expect(isSafeSiteNavigationHref(href), href).toBe(true);
    }

    for (const href of ["//evil.example", "/\\\\evil.example", "javascript:alert(1)", "http://partner.example.org", "https://user:secret@partner.example.org", " /about"]) {
      expect(isSafeSiteNavigationHref(href), href).toBe(false);
    }
  });

  it("matches exact and nested internal routes without false prefix matches", () => {
    expect(isSiteNavigationLinkActive("/events", "/events/mission-night")).toBe(true);
    expect(isSiteNavigationLinkActive("/events/", "/events")).toBe(true);
    expect(isSiteNavigationLinkCurrent("/events/?mode=list", "/events")).toBe(true);
    expect(isSiteNavigationLinkActive("/events", "/events-archive")).toBe(false);
    expect(isSiteNavigationLinkActive("/", "/events")).toBe(false);
    expect(isSiteNavigationLinkActive("https://partner.example.org", "/events")).toBe(false);
  });

  it("keeps church wording and the optional giving action in a thin adapter", () => {
    const adapted = ChurchNav({
      ministryName: "Global Mission",
      currentPath: "/events",
      links: [{ id: "events", label: "Events", href: "/events" }],
      giveHref: null,
    }) as ReactElement<Record<string, unknown>>;

    expect((adapted.type as unknown)).toBe(SiteNavigation);
    expect(adapted.props).toMatchObject({
      brandName: "Global Mission",
      currentPath: "/events",
      links: [{ id: "events", label: "Events", href: "/events" }],
      primaryAction: null,
    });
  });
});
