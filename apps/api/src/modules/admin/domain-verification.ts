import { createHash, timingSafeEqual } from "node:crypto";
import { resolveTxt, resolve4, resolveCname } from "node:dns/promises";

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

export interface DnsDiagnosticReport {
  hostname: string;
  challengeHostname: string;
  expectedTokenHash?: string | undefined;
  challengeTxtRecords: string[];
  rootTxtRecords: string[];
  aRecords: string[];
  cnameRecords: string[];
  tokenMatched: boolean;
  dnsReachable: boolean;
  issues: string[];
  recommendations: string[];
}

export async function diagnoseTenantDomainDns(
  hostname: string,
  expectedTokenHash?: string,
): Promise<DnsDiagnosticReport> {
  const challengeHostname = `_bazionweb-challenge.${hostname}`;
  let challengeTxtRecords: string[] = [];
  let rootTxtRecords: string[] = [];
  let aRecords: string[] = [];
  let cnameRecords: string[] = [];
  let dnsReachable = false;
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    const raw = await resolveTxt(challengeHostname);
    challengeTxtRecords = raw.map((chunks) => chunks.join(""));
    dnsReachable = true;
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : undefined;
    if (code !== "ENOTFOUND" && code !== "ENODATA") {
      issues.push(`Challenge TXT lookup encountered: ${code || "UNKNOWN_ERROR"}`);
    }
  }

  try {
    const raw = await resolveTxt(hostname);
    rootTxtRecords = raw.map((chunks) => chunks.join(""));
    dnsReachable = true;
  } catch {
    // root TXT is optional
  }

  try {
    aRecords = await resolve4(hostname);
    dnsReachable = true;
  } catch {
    // A record optional if CNAME used
  }

  try {
    cnameRecords = await resolveCname(hostname);
    dnsReachable = true;
  } catch {
    // CNAME optional if A record used
  }

  let tokenMatched = false;
  if (expectedTokenHash) {
    const expected = Buffer.from(expectedTokenHash, "hex");
    for (const record of challengeTxtRecords) {
      if (record.startsWith("bazionweb-verification=")) {
        const token = record.slice("bazionweb-verification=".length);
        if (/^[a-f0-9]{64}$/i.test(token)) {
          const actual = createHash("sha256").update(token).digest();
          if (timingSafeEqual(actual, expected)) {
            tokenMatched = true;
            break;
          }
        }
      }
    }

    if (!tokenMatched) {
      for (const record of rootTxtRecords) {
        if (record.startsWith("bazionweb-verification=")) {
          issues.push(`Found verification TXT on root "${hostname}" instead of challenge host "${challengeHostname}".`);
          recommendations.push(`Move the TXT record to subdomain "${challengeHostname}".`);
          break;
        }
      }
      if (challengeTxtRecords.length === 0) {
        issues.push(`No TXT records found at "${challengeHostname}".`);
        recommendations.push(`Add a TXT DNS record with Host "${challengeHostname}" and Value "bazionweb-verification=<challenge_token>".`);
      } else {
        issues.push(`TXT record at "${challengeHostname}" does not match the active challenge token.`);
        recommendations.push(`Update the TXT DNS record value to match your latest challenge token.`);
      }
    }
  }

  if (aRecords.length === 0 && cnameRecords.length === 0) {
    issues.push(`No A or CNAME records found for "${hostname}".`);
    recommendations.push(`Add an A record or CNAME record pointing to your platform entry point.`);
  }

  return {
    hostname,
    challengeHostname,
    expectedTokenHash,
    challengeTxtRecords,
    rootTxtRecords,
    aRecords,
    cnameRecords,
    tokenMatched,
    dnsReachable,
    issues,
    recommendations,
  };
}
