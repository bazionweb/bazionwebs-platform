export interface SecretManagerClient {
  getSecretValue(secretPath: string, version?: string): Promise<string | null>;
}

export interface HttpSecretManagerClientOptions {
  baseUrl: string;
  authToken: string;
  timeoutMs?: number;
  allowInsecureLocalhost?: boolean;
  fetchImpl?: typeof fetch;
}

const maxSecretManagerResponseBytes = 64 * 1024;

async function readBoundedResponseBody(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxSecretManagerResponseBytes) {
    throw new Error("SECRET_MANAGER_RESPONSE_INVALID");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxSecretManagerResponseBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("SECRET_MANAGER_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

/** HTTP adapter for Vault-style brokers. Plain HTTP is allowed only for explicit loopback development. */
export class HttpSecretManagerClient implements SecretManagerClient {
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpSecretManagerClientOptions) {
    let parsed: URL;
    try { parsed = new URL(options.baseUrl); } catch {
      throw new Error("SECRET_MANAGER_URL_INVALID");
    }
    const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    const httpsOk = parsed.protocol === "https:";
    const devHttpOk = options.allowInsecureLocalhost === true && isLoopback && parsed.protocol === "http:";
    if ((!httpsOk && !devHttpOk) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("SECRET_MANAGER_URL_INVALID");
    }
    const token = options.authToken.trim();
    if (!token) throw new Error("SECRET_MANAGER_TOKEN_REQUIRED");
    if (token.length > 8_192 || /[\r\n\0]/.test(token)) throw new Error("SECRET_MANAGER_TOKEN_INVALID");

    this.baseUrl = parsed.toString().replace(/\/+$/, "");
    this.authToken = token;
    this.timeoutMs = Math.max(500, Math.min(30_000, Math.trunc(options.timeoutMs ?? 5_000)));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getSecretValue(secretPath: string, version?: string): Promise<string | null> {
    const cleanPath = secretPath.replace(/^\/+/, "");
    if (!cleanPath || !cleanPath.split("/").every((part) => /^[A-Za-z0-9_-]{1,128}$/.test(part))) {
      throw new Error("SECRET_MANAGER_PATH_INVALID");
    }
    const query = version ? `?version=${encodeURIComponent(version)}` : "";
    const response = await this.fetchImpl(`${this.baseUrl}/${cleanPath}${query}`, {
      method: "GET",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("SECRET_MANAGER_UNAVAILABLE");

    let payload: unknown;
    try {
      const raw = await readBoundedResponseBody(response);
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("SECRET_MANAGER_RESPONSE_INVALID");
    }
    if (typeof payload === "string") return payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("SECRET_MANAGER_RESPONSE_INVALID");
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.secretString === "string") return record.secretString;
    if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
      const innerData = record.data as Record<string, unknown>;
      if (innerData.data && typeof innerData.data === "object" && !Array.isArray(innerData.data)) {
        return JSON.stringify(innerData.data);
      }
      return JSON.stringify(innerData);
    }
    return JSON.stringify(record);
  }
}
