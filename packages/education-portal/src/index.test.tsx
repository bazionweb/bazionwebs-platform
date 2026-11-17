import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalApp } from "./index.js";

describe("@bazion/education-portal", () => {
  it("renders the verbatim BMI Student Portal shell", () => {
    const html = renderToStaticMarkup(<PortalApp basename="/portal" />);
    expect(html).toContain("Student Portal");
    expect(html).toContain("Apply");
  });

  it("prefixes internal portal links with the mounted basename", () => {
    const html = renderToStaticMarkup(<PortalApp basename="/portal" />);
    expect(html).toContain('href="/portal/login"');
    expect(html).toContain('href="/portal/register"');
  });
});

