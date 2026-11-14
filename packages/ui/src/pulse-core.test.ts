import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computePulseDuration, interpretError, isPulseReported, pulse, PulseHttpError } from "./pulse-core.js";

function clear() {
  pulse.dismissAll();
  vi.runAllTimers();
}

describe("interpretError", () => {
  it("explains HTTP status codes and keeps the server message as detail", () => {
    const insight = interpretError(new PulseHttpError(409, { message: "Slug already taken" }));
    expect(insight.title).toBe("That conflicts with the latest changes");
    expect(insight.detail).toBe("Slug already taken");
    expect(insight.hint).toMatch(/Refresh/);
    expect(insight.retryable).toBe(false);
  });

  it("maps known server codes to tailored guidance", () => {
    const insight = interpretError({ response: { status: 403, data: { code: "SANDBOX_IMPERSONATION_FORBIDDEN", message: "Support sandbox or impersonation sessions are read-only and cannot perform mutations." } } });
    expect(insight.title).toBe("Sandbox sessions are read-only");
    expect(insight.hint).toMatch(/Exit the support sandbox/);
  });

  it("treats 401 as an expired session that needs sign-in", () => {
    const insight = interpretError({ status: 401, data: { message: "Unauthorized" } });
    expect(insight.signIn).toBe(true);
    expect(insight.detail).toBeUndefined();
  });

  it("marks server failures as retryable", () => {
    expect(interpretError(new PulseHttpError(503, null)).retryable).toBe(true);
    expect(interpretError(new PulseHttpError(500, "<html>boom</html>")).detail).toBeUndefined();
  });

  it("recognises network and timeout failures", () => {
    expect(interpretError(new TypeError("Failed to fetch")).code).toBe("NETWORK");
    expect(interpretError({ code: "ECONNABORTED", message: "timeout of 15000ms exceeded" }).code).toBe("TIMEOUT");
  });

  it("joins Nest validation arrays", () => {
    const insight = interpretError(new PulseHttpError(400, { message: ["email must be an email", "name should not be empty"] }));
    expect(insight.detail).toBe("email must be an email · name should not be empty");
  });

  it("falls back to a readable plain error message", () => {
    expect(interpretError(new Error("Choose at least one photo")).title).toBe("Choose at least one photo");
    expect(interpretError(new Error("Request failed with status code 418")).title).toBe("Something went wrong");
  });
});

describe("pulse store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    clear();
    vi.useRealTimers();
  });

  it("coalesces identical messages with a counter", () => {
    pulse.success("Saved");
    pulse.success("Saved");
    const items = pulse.getSnapshot().items.filter((item) => !item.leaving);
    expect(items).toHaveLength(1);
    expect(items[0]?.count).toBe(2);
  });

  it("morphs a pending pulse into success when tracked work resolves", async () => {
    const result = pulse.track(Promise.resolve(42), { pending: "Saving…", success: (value) => `Saved ${value}` });
    expect(pulse.getSnapshot().items[0]?.tone).toBe("pending");
    await expect(result).resolves.toBe(42);
    const item = pulse.getSnapshot().items[0];
    expect(item?.tone).toBe("success");
    expect(item?.title).toBe("Saved 42");
  });

  it("escalates slow work and offers retry on retryable failures", async () => {
    let attempts = 0;
    const work = () => new Promise<string>((resolve, reject) => {
      attempts += 1;
      setTimeout(() => (attempts === 1 ? reject(new PulseHttpError(503, null)) : resolve("ok")), 13_000);
    });
    const tracked = pulse.track(work, { pending: "Publishing…", success: "Published", error: "Couldn’t publish" });
    tracked.catch(() => undefined);
    vi.advanceTimersByTime(4_100);
    expect(pulse.getSnapshot().items[0]?.stage).toBe(1);
    vi.advanceTimersByTime(8_000);
    expect(pulse.getSnapshot().items[0]?.stage).toBe(2);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(tracked).rejects.toBeInstanceOf(PulseHttpError);
    const failed = pulse.getSnapshot().items[0];
    expect(failed?.tone).toBe("error");
    expect(failed?.title).toBe("Couldn’t publish");
    expect(failed?.detail).toBe("The service is briefly unavailable");
    expect(failed?.action?.label).toBe("Try again");

    const retry = pulse.runAction(failed!.id);
    expect(pulse.getSnapshot().items[0]?.tone).toBe("pending");
    await vi.advanceTimersByTimeAsync(13_000);
    await retry;
    expect(pulse.getSnapshot().items[0]?.title).toBe("Published");
    expect(attempts).toBe(2);
  });

  it("does not start a keyed command twice", async () => {
    let calls = 0;
    const work = () => new Promise<void>((resolve) => { calls += 1; setTimeout(resolve, 100); });
    const first = pulse.track(work, { pending: "Syncing…", key: "sync" });
    const second = pulse.track(work, { pending: "Syncing…", key: "sync" });
    expect(pulse.isRunning("sync")).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(pulse.getSnapshot().items.some((item) => item.title === "Already on it")).toBe(true);
  });

  it("marks reported errors so safety nets can avoid duplicates", async () => {
    const failure = new PulseHttpError(400, { message: "Nope" });
    await pulse.run(() => Promise.reject(failure), { pending: "Trying…" });
    expect(isPulseReported(failure)).toBe(true);
  });

  it("pauses and resumes dwell timers", () => {
    const id = pulse.info("Heads up", { duration: 5_000 });
    vi.advanceTimersByTime(2_000);
    pulse.pause(id);
    vi.advanceTimersByTime(10_000);
    expect(pulse.getSnapshot().items.find((item) => item.id === id)?.leaving).toBe(false);
    pulse.resume(id);
    vi.advanceTimersByTime(3_100);
    expect(pulse.getSnapshot().items.find((item) => item.id === id)?.leaving ?? true).toBe(true);
  });

  it("gives longer messages more reading time", () => {
    expect(computePulseDuration("success", "Saved")).toBeLessThan(
      computePulseDuration("success", "Saved", "Your sermon is now live on the website and visible to every visitor."),
    );
    expect(computePulseDuration("pending", "Working")).toBe(0);
  });
});

