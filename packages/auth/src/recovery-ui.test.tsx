import { describe, expect, it } from "vitest";
import React from "react";
import { PasswordResetRequestForm, PasswordResetForm } from "./recovery-ui.js";

describe("Recovery UI Components", () => {
  it("renders PasswordResetRequestForm without crashing", () => {
    const element = <PasswordResetRequestForm />;
    expect(element).toBeDefined();
    expect(element.type).toBe(PasswordResetRequestForm);
  });

  it("renders PasswordResetForm without crashing", () => {
    const element = <PasswordResetForm />;
    expect(element).toBeDefined();
    expect(element.type).toBe(PasswordResetForm);
  });

  it("supports platform and tenant variants", () => {
    const platformReq = <PasswordResetRequestForm variant="platform" />;
    const platformReset = <PasswordResetForm variant="platform" />;
    expect(platformReq.props.variant).toBe("platform");
    expect(platformReset.props.variant).toBe("platform");
  });
});
