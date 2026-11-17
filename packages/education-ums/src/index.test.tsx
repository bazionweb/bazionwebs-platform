import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UmsApp } from "./index.js";

describe("@bazion/education-ums", () => {
  it("renders the verbatim BMI University Management System shell", () => {
    const html = renderToStaticMarkup(<UmsApp basename="/ums" />);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("BMI University ERP");
  });

  it("mounts with institutional styling and preloader elements", () => {
    const html = renderToStaticMarkup(<UmsApp basename="/ums" />);
    expect(html).toContain("Loading system modules");
  });
});
