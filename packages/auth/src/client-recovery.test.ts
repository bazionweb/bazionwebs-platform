import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset, resetPassword } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("password recovery client", () => {
  it("posts a reset request to the same-origin auth proxy without exposing account existence", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestPasswordReset("member@example.test", "http://localhost:3100/reset-password"))
      .resolves.toBe("accepted");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/request-password-reset", expect.objectContaining({
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test", redirectTo: "http://localhost:3100/reset-password" }),
    }));
  });

  it("reports rate limiting on reset requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));

    await expect(requestPasswordReset("member@example.test", "http://localhost:3100/reset-password"))
      .resolves.toBe("rate-limited");
  });

  it("sends the reset token in the POST body and accepts a successful reset", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resetPassword("one-time-token", "a-long-and-strong-password"))
      .resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/reset-password", expect.objectContaining({
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ token: "one-time-token", newPassword: "a-long-and-strong-password" }),
    }));
  });

  it("explains invalid or expired reset tokens without leaking server details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "INVALID_TOKEN" }), { status: 400 })));

    await expect(resetPassword("expired-token", "a-long-and-strong-password"))
      .rejects.toThrow("This reset link is invalid or has expired. Request a new link to continue.");
  });

  it("returns a useful message for reset throttling and generic failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));
    await expect(resetPassword("token", "a-long-and-strong-password"))
      .rejects.toThrow("Too many attempts. Wait before trying again.");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "internal details" }), { status: 500 })));
    await expect(resetPassword("token", "a-long-and-strong-password"))
      .rejects.toThrow("The password could not be changed. Check the form and request a fresh reset link if needed.");
  });
});
