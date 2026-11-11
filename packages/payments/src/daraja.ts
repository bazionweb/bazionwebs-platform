export interface DarajaConfig {
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
}

export interface DarajaStkPushInput {
  amountKes: number;
  phoneNumber: string;
  accountReference: string;
  transactionDescription: string;
  callbackUrl?: string;
}

export interface DarajaStkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

export interface DarajaStkPushQueryResult {
  responseCode: string;
  responseDescription: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
}

type JsonObject = Record<string, unknown>;

export class DarajaRequestError extends Error {
  constructor(message: string, public readonly deliveryState: "not_sent" | "unknown") {
    super(message);
    this.name = "DarajaRequestError";
  }
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function timestampNairobi(date = new Date()): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export function normalizeKenyanPhoneNumber(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "");
  const national = compact.startsWith("+254")
    ? compact.slice(1)
    : compact.startsWith("254")
      ? compact
      : compact.startsWith("0")
        ? `254${compact.slice(1)}`
        : "";
  if (!/^254[17]\d{8}$/.test(national)) {
    throw new Error("Enter a valid Kenyan M-Pesa mobile number.");
  }
  return national;
}

export class DarajaClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private tokenRequest: Promise<string> | null = null;
  private readonly baseUrl: string;

  constructor(
    private readonly config: DarajaConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl = config.environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
    const callback = new URL(config.callbackUrl);
    if (callback.protocol !== "https:" && callback.hostname !== "localhost" && callback.hostname !== "127.0.0.1") {
      throw new Error("Daraja callback URL must use HTTPS.");
    }
  }

  async initiateStkPush(input: DarajaStkPushInput): Promise<DarajaStkPushResult> {
    if (!Number.isSafeInteger(input.amountKes) || input.amountKes < 1) {
      throw new Error("Daraja STK Push amount must be a positive integer in KES.");
    }
    const phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
    const timestamp = timestampNairobi();
    const password = Buffer.from(`${this.config.businessShortCode}${this.config.passkey}${timestamp}`).toString("base64");
    const accessToken = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          BusinessShortCode: this.config.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: input.amountKes,
          PartyA: phoneNumber,
          PartyB: this.config.businessShortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: input.callbackUrl ?? this.config.callbackUrl,
          AccountReference: input.accountReference.slice(0, 12),
          TransactionDesc: input.transactionDescription.slice(0, 13),
        }),
      });
    } catch {
      throw new DarajaRequestError("Safaricom did not return a response. Payment status is being checked.", "unknown");
    }
    const payload = asObject(await response.json().catch(() => null));
    if (!payload) {
      throw new DarajaRequestError("Safaricom returned an incomplete response. Payment status is being checked.", "unknown");
    }
    if (!response.ok) {
      // A server error can occur after Safaricom accepted the request. Keep the
      // order pending until status is reconciled instead of releasing stock.
      throw new DarajaRequestError(
        "Safaricom returned an unexpected error. Payment status is being checked.",
        response.status >= 500 ? "unknown" : "not_sent",
      );
    }
    if (payload.ResponseCode !== "0" && payload.ResponseCode !== 0) {
      const code = payload.ResponseCode;
      const hasExplicitRejection = (typeof code === "number" && Number.isInteger(code) && code !== 0) ||
        (typeof code === "string" && /^\d+$/.test(code) && Number(code) !== 0);
      throw new DarajaRequestError(
        hasExplicitRejection
          ? "Safaricom did not accept the payment request. No payment has been confirmed."
          : "Safaricom returned an incomplete response. Payment status is being checked.",
        hasExplicitRejection ? "not_sent" : "unknown",
      );
    }
    if (typeof payload.MerchantRequestID !== "string" || typeof payload.CheckoutRequestID !== "string") {
      throw new DarajaRequestError("Safaricom's response could not be correlated. Payment status is being checked.", "unknown");
    }
    return {
      merchantRequestId: payload.MerchantRequestID,
      checkoutRequestId: payload.CheckoutRequestID,
      customerMessage: typeof payload.CustomerMessage === "string" ? payload.CustomerMessage : "Payment request sent.",
    };
  }

  async queryStkPushStatus(checkoutRequestId: string): Promise<DarajaStkPushQueryResult> {
    const trimmedId = checkoutRequestId.trim();
    if (!trimmedId) {
      throw new Error("CheckoutRequestID is required for status query.");
    }
    const timestamp = timestampNairobi();
    const password = Buffer.from(`${this.config.businessShortCode}${this.config.passkey}${timestamp}`).toString("base64");
    const accessToken = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          BusinessShortCode: this.config.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: trimmedId,
        }),
      });
    } catch {
      throw new DarajaRequestError("Safaricom STK query endpoint was unreachable.", "unknown");
    }
    const payload = asObject(await response.json().catch(() => null));
    if (!payload) {
      throw new DarajaRequestError("Safaricom returned an invalid response for the STK query.", "unknown");
    }
    return {
      responseCode: String(payload.ResponseCode ?? payload.responseCode ?? ""),
      responseDescription: String(payload.ResponseDescription ?? payload.responseDescription ?? ""),
      merchantRequestId: String(payload.MerchantRequestID ?? payload.merchantRequestId ?? ""),
      checkoutRequestId: String(payload.CheckoutRequestID ?? payload.checkoutRequestId ?? trimmedId),
      resultCode: String(payload.ResultCode ?? payload.resultCode ?? ""),
      resultDesc: String(payload.ResultDesc ?? payload.resultDesc ?? payload.errorMessage ?? ""),
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 30_000) return this.accessToken;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const credentials = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString("base64");
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          method: "GET",
          headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new DarajaRequestError("Safaricom authentication was unreachable. The payment request was not sent.", "not_sent");
      }
      const payload = asObject(await response.json().catch(() => null));
      if (!response.ok || typeof payload?.access_token !== "string") {
        throw new DarajaRequestError("Safaricom authentication failed. Payment request was not sent.", "not_sent");
      }
      const lifetime = typeof payload.expires_in === "string" ? Number(payload.expires_in) : 3600;
      this.accessToken = payload.access_token;
      this.accessTokenExpiresAt = Date.now() + (Number.isFinite(lifetime) ? lifetime : 3600) * 1000;
      return this.accessToken;
    })();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }
}
