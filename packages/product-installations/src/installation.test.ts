import { describe, expect, it } from "vitest";
import { canTransitionProductInstallation, transitionProductInstallation } from "./installation.js";

describe("product installation lifecycle", () => {
  it("allows only explicit, reversible lifecycle transitions", () => {
    expect(transitionProductInstallation("provisioning", "ready")).toBe("ready");
    expect(transitionProductInstallation("ready", "suspended")).toBe("suspended");
    expect(transitionProductInstallation("suspended", "ready")).toBe("ready");
    expect(canTransitionProductInstallation("offboarded", "ready")).toBe(false);
    expect(() => transitionProductInstallation("offboarded", "ready")).toThrow("INVALID_PRODUCT_INSTALLATION_TRANSITION");
  });

  it("treats a repeated same-state command as an idempotent no-op", () => {
    expect(transitionProductInstallation("ready", "ready")).toBe("ready");
  });

  it("allows a failed provisioning operation to retry without reviving retired installations", () => {
    expect(transitionProductInstallation("failed", "provisioning")).toBe("provisioning");
    expect(transitionProductInstallation("offboarded", "offboarded")).toBe("offboarded");
  });

  it("offboards through explicit recovery-safe states", () => {
    expect(transitionProductInstallation("ready", "offboarding")).toBe("offboarding");
    expect(transitionProductInstallation("offboarding", "offboarded")).toBe("offboarded");
  });
});
