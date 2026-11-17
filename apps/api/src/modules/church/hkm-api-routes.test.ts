import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { hkmApiRoutes } from "./hkm-api-routes.js";

describe("hkmApiRoutes Church Management & Member Portal endpoints", () => {
  it("provides tenant configuration and admin overview metrics", async () => {
    const app = Fastify();
    await app.register(hkmApiRoutes);

    const configRes = await app.inject({ method: "GET", url: "/api/church/hkm/config" });
    expect(configRes.statusCode).toBe(200);
    const configBody = configRes.json();
    expect(configBody.success).toBe(true);
    expect(configBody.tenantId).toBe("00000000-0000-4000-8000-000000000077");
    expect(configBody.config.currency).toBe("KES");

    const statsRes = await app.inject({ method: "GET", url: "/api/church/hkm/stats" });
    expect(statsRes.statusCode).toBe(200);
    const statsBody = statsRes.json();
    expect(statsBody.success).toBe(true);
    expect(statsBody.stats.totalMembers).toBeGreaterThanOrEqual(3);
    expect(statsBody.stats.totalGiving).toBeGreaterThan(0);
    expect(statsBody.stats.latestAttendance).toBeGreaterThan(0);

    await app.close();
  });

  it("authenticates portal members via PIN or password, and serves giving history & statements", async () => {
    const app = Fastify();
    await app.register(hkmApiRoutes);

    // 1. Check member status
    const checkRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/check-member",
      payload: { membershipNumber: "HKM-001" },
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json().exists).toBe(true);
    expect(checkRes.json().hasPassword).toBe(true);

    // 2. Member logs in with password
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/login-password",
      payload: {
        membershipNumber: "HKM-001",
        password: "Password123!",
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.token).toBeDefined();
    expect(loginBody.member.membershipNumber).toBe("HKM-001");

    // 3. Member fetches giving history
    const historyRes = await app.inject({
      method: "GET",
      url: "/api/church/hkm/portal/giving-history?memberId=mbr-001",
    });
    expect(historyRes.statusCode).toBe(200);
    const historyBody = historyRes.json();
    expect(historyBody.success).toBe(true);
    expect(historyBody.transactions.length).toBeGreaterThan(0);
    expect(historyBody.totalGiven).toBeGreaterThanOrEqual(25000);

    // 4. Member generates annual giving statement
    const stmtRes = await app.inject({
      method: "GET",
      url: "/api/church/hkm/portal/statement?memberId=mbr-001&year=2026",
    });
    expect(stmtRes.statusCode).toBe(200);
    const stmtBody = stmtRes.json();
    expect(stmtBody.statementYear).toBe("2026");
    expect(stmtBody.summary.currency).toBe("KES");
    expect(stmtBody.summary.grandTotal).toBeGreaterThan(0);

    await app.close();
  });

  it("supports PIN reset and first-time member password setup", async () => {
    const app = Fastify();
    await app.register(hkmApiRoutes);

    // 1. First-time member checks status
    const checkRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/check-member",
      payload: { membershipNumber: "HKM-002" },
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json().exists).toBe(true);
    expect(checkRes.json().hasPassword).toBe(false);

    // 2. Logs in with default PIN
    const pinRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/login-pin",
      payload: { membershipNumber: "HKM-002", pin: "1234" },
    });
    expect(pinRes.statusCode).toBe(200);
    expect(pinRes.json().needsPasswordSetup).toBe(true);

    // 3. Sets password
    const setPassRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/set-password",
      payload: { membershipNumber: "HKM-002", newPassword: "NewSecretPassword!" },
    });
    expect(setPassRes.statusCode).toBe(200);
    expect(setPassRes.json().success).toBe(true);

    // 4. Can now log in with the new password
    const newLoginRes = await app.inject({
      method: "POST",
      url: "/api/church/hkm/portal/login-password",
      payload: { membershipNumber: "HKM-002", password: "NewSecretPassword!" },
    });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.json().success).toBe(true);

    await app.close();
  });
});

