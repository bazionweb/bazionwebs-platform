import { createHash, timingSafeEqual } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

type TxtResolver = (hostname: string) => Promise<string[][]>;
const defaultTxtResolver: TxtResolver = async (hostname) => resolveTxt(hostname);

/** Validate the DNS proof without returning or logging the presented token. */
export async function verifyTenantDomainTxt(
  hostname: string,
  expectedTokenHash: string,
  resolver: TxtResolver = defaultTxtResolver,
): Promise<boolean> {
  let records: string[][];
  try {
    records = await resolver(`_bazionweb-challenge.${hostname}`);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENODATA" || code === "ENOTFOUND") return false;
    throw error;
  }

  const expected = Buffer.from(expectedTokenHash, "hex");
  if (expected.length !== 32) return false;
  for (const chunks of records) {
    const record = chunks.join("");
    const prefix = "bazionweb-verification=";
    if (!record.startsWith(prefix)) continue;
    const token = record.slice(prefix.length);
    if (!/^[a-f0-9]{64}$/i.test(token)) continue;
    const actual = createHash("sha256").update(token).digest();
    if (timingSafeEqual(actual, expected)) return true;
  }
  return false;
}
