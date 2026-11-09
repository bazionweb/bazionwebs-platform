#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const outputIndex = args.indexOf("--output");
const sourceDir = path.resolve((sourceIndex >= 0 ? args[sourceIndex + 1] : undefined) ?? process.env.GMFC_SOURCE_DIR ?? "D:/new-gmfc");
const outputFile = path.resolve((outputIndex >= 0 ? args[outputIndex + 1] : undefined) ?? path.join(repoRoot, "data/migrations/global-mission-events.json"));

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    values[match[1]] = value;
  }
  return values;
}

const envFile = path.join(sourceDir, ".env.local");
let sourceEnv;
try {
  sourceEnv = parseEnv(await readFile(envFile, "utf8"));
} catch {
  throw new Error(`Could not read the source environment file at ${envFile}. No source credentials were displayed.`);
}

const supabaseUrl = sourceEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = sourceEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey || /placeholder|your[-_ ]/i.test(`${supabaseUrl} ${anonKey}`)) {
  throw new Error("The source Supabase URL or public read key is missing or still a placeholder.");
}

const events = [];
for (let offset = 0; ; offset += 500) {
  const url = new URL("/rest/v1/events", supabaseUrl);
  url.search = new URLSearchParams({
    select: "title,slug,start_date,end_date,excerpt,description,image_url,location",
    order: "start_date.asc",
    limit: "500",
    offset: String(offset),
  }).toString();
  let response;
  try {
    response = await fetch(url, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Could not reach the source event endpoint. The export contains no private contact records.");
  }
  if (!response.ok) {
    throw new Error(`Source event export returned HTTP ${response.status}. Verify public read access to the events table.`);
  }
  const batch = await response.json();
  if (!Array.isArray(batch)) throw new Error("The source events response was not a list.");
  events.push(...batch);
  if (batch.length < 500) break;
}

const sanitizedEvents = events.map((event) => ({
  title: typeof event.title === "string" ? event.title.trim() : "",
  slug: typeof event.slug === "string" ? event.slug.trim() : "",
  startsAt: event.start_date ?? null,
  endsAt: event.end_date ?? null,
  excerpt: typeof event.excerpt === "string" ? event.excerpt.trim() : "",
  description: typeof event.description === "string" ? event.description.trim() : "",
  imageUrl: typeof event.image_url === "string" ? event.image_url.trim() : "",
  location: typeof event.location === "string" ? event.location.trim() : "",
}));

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify({ source: "global-mission-fc", exportedAt: new Date().toISOString(), events: sanitizedEvents }, null, 2)}\n`, "utf8");
console.log(`Exported ${sanitizedEvents.length} public events to ${path.relative(repoRoot, outputFile) || outputFile}. Contact submissions and other private records were not queried.`);
