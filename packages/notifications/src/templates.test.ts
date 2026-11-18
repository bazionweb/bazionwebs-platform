import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "./templates.js";

describe("email templates", () => {
  it("renders auth.password-reset with brand, button, security notes, and direct URL fallback", () => {
    const rendered = renderEmailTemplate(
      "auth.password-reset",
      "user@example.test",
      undefined,
      {
        url: "http://localhost:3000/reset-password?token=secret123",
        token: "secret123",
      },
    );

    expect(rendered.subject).toBe("Reset your Bazion Web password");
    expect(rendered.html).toContain("Reset Password");
    expect(rendered.html).toContain("http://localhost:3000/reset-password?token=secret123");
    expect(rendered.html).toContain("secret123");
    expect(rendered.html).toContain("user@example.test");
    expect(rendered.html).toContain("60 minutes");
    expect(rendered.text).toContain("secret123");
  });

  it("renders auth.password-reset-complete security alert", () => {
    const rendered = renderEmailTemplate(
      "auth.password-reset-complete",
      "user@example.test",
      undefined,
      {},
    );

    expect(rendered.subject).toBe("Your Bazion Web password was changed");
    expect(rendered.html).toContain("Password successfully changed");
    expect(rendered.html).toContain("user@example.test");
    expect(rendered.text).toContain("contact support immediately");
  });

  it("renders general fallback notification safely", () => {
    const rendered = renderEmailTemplate(
      "general.alert",
      "user@example.test",
      "Custom Subject",
      { intro: "Something happened in your workspace.", url: "https://example.test/workspace" },
    );

    expect(rendered.subject).toBe("Custom Subject");
    expect(rendered.html).toContain("Something happened in your workspace.");
    expect(rendered.html).toContain("https://example.test/workspace");
  });
});
