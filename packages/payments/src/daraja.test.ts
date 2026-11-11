import { describe, expect, it, vi } from "vitest";
import { DarajaClient, DarajaRequestError, normalizeKenyanPhoneNumber } from "./daraja.js";

const config = {
  environment: "sandbox" as const,
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  businessShortCode: "600000",
  passkey: "test-passkey",
  callbackUrl: "https://ministry.example.org/v1/public/church/donations/mpesa-callback",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function requestInput() {
  return {
    amountKes: 1250,
    phoneNumber: "0712 345 678",
    accountReference: "donation-reference-too-long",
    transactionDescription: "Mission and community outreach",
  };
}

describe("Kenyan M-Pesa phone normalization", () => {
  it.each(["0712345678", "+254712345678", "254712345678", "(0712) 345-678"])("normalizes %s to Safaricom's international format", (phone) => {
    expect(normalizeKenyanPhoneNumber(phone)).toBe("254712345678");
  });

  it.each(["071234567", "+1 415 555 2671", "254001234567", "abc"])("rejects invalid phone number %s", (phone) => {
    expect(() => normalizeKenyanPhoneNumber(phone)).toThrow("Enter a valid Kenyan M-Pesa mobile number.");
  });
});

describe("Daraja STK Push", () => {
  it("uses OAuth, formats the request and reuses a live access token", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token", expires_in: "3600" }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: "0", MerchantRequestID: "merchant-1", CheckoutRequestID: "checkout-1" }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: 0, MerchantRequestID: "merchant-2", CheckoutRequestID: "checkout-2", CustomerMessage: "Prompt sent" }));
    const client = new DarajaClient(config, fetcher);

    const first = await client.initiateStkPush(requestInput());
    const second = await client.initiateStkPush(requestInput());

    expect(first.checkoutRequestId).toBe("checkout-1");
    expect(second.customerMessage).toBe("Prompt sent");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(`Basic ${Buffer.from("consumer-key:consumer-secret").toString("base64")}`);

    const push = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, string | number>;
    expect(String(fetcher.mock.calls[1]?.[0])).toBe("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    expect(push.Amount).toBe(1250);
    expect(push.PhoneNumber).toBe("254712345678");
    expect(push.PartyA).toBe("254712345678");
    expect(push.AccountReference).toBe("donation-ref");
    expect(push.TransactionDesc).toBe("Mission and c");
    expect(push.Timestamp).toMatch(/^\d{14}$/);
    expect(push.Password).toBe(Buffer.from(`600000test-passkey${push.Timestamp}`).toString("base64"));
    expect(push.CallBackURL).toBe(config.callbackUrl);
  });

  it("rejects invalid amounts and phone numbers before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new DarajaClient(config, fetcher);

    await expect(client.initiateStkPush({ ...requestInput(), amountKes: 0 })).rejects.toThrow("positive integer");
    await expect(client.initiateStkPush({ ...requestInput(), phoneNumber: "not-a-phone" })).rejects.toThrow("valid Kenyan M-Pesa mobile number");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [400, "not_sent"],
    [500, "unknown"],
  ] as const)("classifies an HTTP %s response as %s", async (status, deliveryState) => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token", expires_in: "3600" }))
      .mockResolvedValueOnce(jsonResponse({ message: "provider response" }, status));
    const client = new DarajaClient(config, fetcher);

    await expect(client.initiateStkPush(requestInput())).rejects.toMatchObject({
      name: "DarajaRequestError",
      deliveryState,
    });
  });

  it("treats a timeout or uncorrelated success response as unknown", async () => {
    const timeoutFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token", expires_in: "3600" }))
      .mockRejectedValueOnce(new Error("network timeout"));
    const timeoutClient = new DarajaClient(config, timeoutFetcher);
    await expect(timeoutClient.initiateStkPush(requestInput())).rejects.toMatchObject({ deliveryState: "unknown" });

    const incompleteFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token", expires_in: "3600" }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: "0" }));
    const incompleteClient = new DarajaClient(config, incompleteFetcher);
    await expect(incompleteClient.initiateStkPush(requestInput())).rejects.toMatchObject({ deliveryState: "unknown" });
  });

  it("marks explicit provider rejection and OAuth failures as not sent", async () => {
    const rejectionFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token", expires_in: "3600" }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: "1" }));
    const rejectionClient = new DarajaClient(config, rejectionFetcher);
    await expect(rejectionClient.initiateStkPush(requestInput())).rejects.toMatchObject({ deliveryState: "not_sent" });

    const oauthFetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, 401));
    const oauthClient = new DarajaClient(config, oauthFetcher);
    await expect(oauthClient.initiateStkPush(requestInput())).rejects.toMatchObject({
      name: "DarajaRequestError",
      deliveryState: "not_sent",
    } satisfies Partial<DarajaRequestError>);
  });

  it("requires HTTPS callbacks except for localhost development callbacks", () => {
    expect(() => new DarajaClient({ ...config, callbackUrl: "http://payments.example.org/callback" })).toThrow("must use HTTPS");
    expect(() => new DarajaClient({ ...config, callbackUrl: "http://localhost:4000/callback" })).not.toThrow();
  });

  it("queries Daraja STK push status", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-abc", expires_in: "3600" }))
      .mockResolvedValueOnce(jsonResponse({
        ResponseCode: "0",
        ResponseDescription: "The service request has been accepted successfully",
        MerchantRequestID: "merch-1",
        CheckoutRequestID: "ws_CO_test",
        ResultCode: "0",
        ResultDesc: "The service request is processed successfully.",
      }));

    const client = new DarajaClient(config, fetcher);
    const result = await client.queryStkPushStatus("ws_CO_test");

    expect(result.resultCode).toBe("0");
    expect(result.checkoutRequestId).toBe("ws_CO_test");
    expect(result.resultDesc).toContain("successfully");
  });
});
