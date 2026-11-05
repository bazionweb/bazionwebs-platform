import { Pool } from "pg";
import nodemailer from "nodemailer";
import {
  createOutboxPayloadCodec,
  deliverOutboxBatch,
  PostgresNotificationOutbox,
  type OutboxDelivery,
} from "./outbox.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required notification worker environment variable: ${name}`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const encryptionKey = Buffer.from(required("NOTIFICATION_ENCRYPTION_KEY"), "base64");
const codec = createOutboxPayloadCodec(encryptionKey);
const pool = new Pool({
  connectionString: required("NOTIFICATION_WORKER_DATABASE_URL"),
  max: Number(process.env.NOTIFICATION_WORKER_DB_POOL_SIZE ?? "4"),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const smtpHost = required("NOTIFICATION_SMTP_HOST");
const smtpPort = Number(process.env.NOTIFICATION_SMTP_PORT ?? "587");
const smtpSecure = process.env.NOTIFICATION_SMTP_SECURE === "true";
const smtpUser = process.env.NOTIFICATION_SMTP_USER?.trim();
const smtpPassword = process.env.NOTIFICATION_SMTP_PASSWORD;
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
  throw new Error("NOTIFICATION_SMTP_PORT must be a valid TCP port.");
}
if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
  throw new Error("Configure both NOTIFICATION_SMTP_USER and NOTIFICATION_SMTP_PASSWORD, or neither.");
}
const transport = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  ...(smtpUser && smtpPassword ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
});
const emailFrom = required("NOTIFICATION_EMAIL_FROM");
const outbox = new PostgresNotificationOutbox(pool, codec);
const batchSize = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE ?? "20");
const idleMilliseconds = Number(process.env.NOTIFICATION_WORKER_IDLE_MS ?? "1000");
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
  throw new Error("NOTIFICATION_WORKER_BATCH_SIZE must be an integer between 1 and 100.");
}
if (!Number.isInteger(idleMilliseconds) || idleMilliseconds < 100 || idleMilliseconds > 30_000) {
  throw new Error("NOTIFICATION_WORKER_IDLE_MS must be an integer between 100 and 30000.");
}

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    process.stdout.write(`[bazion-notification-worker] ${signal} received; draining current batch\n`);
  });
}

async function deliver(delivery: OutboxDelivery): Promise<void> {
  if (delivery.channel !== "email") {
    throw new Error("UNSUPPORTED_NOTIFICATION_CHANNEL");
  }

  const intro = typeof delivery.payload.variables.intro === "string"
    ? delivery.payload.variables.intro
    : "You have a new notification from Bazion Web.";
  const url = typeof delivery.payload.variables.url === "string"
    ? delivery.payload.variables.url
    : "";
  const text = url ? `${intro}\n\n${url}\n\nIf you did not request this, you can ignore this email.`
    : `${intro}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<p>${escapeHtml(intro)}</p>${url ? `<p><a href="${escapeHtml(url)}">Continue to Bazion Web</a></p>` : ""}<p>If you did not request this, you can ignore this email.</p>`;

  await transport.sendMail({
    from: emailFrom,
    to: delivery.payload.to,
    subject: delivery.payload.subject ?? "Notification from Bazion Web",
    text,
    html,
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  await transport.verify();
  process.stdout.write("[bazion-notification-worker] SMTP transport verified; polling encrypted outbox\n");

  while (!stopping) {
    const result = await deliverOutboxBatch(outbox, deliver, batchSize);
    if (result.claimed > 0) {
      process.stdout.write(`[bazion-notification-worker] claimed=${result.claimed} sent=${result.sent} failed=${result.failed}\n`);
    } else {
      await sleep(idleMilliseconds);
    }
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`[bazion-notification-worker] fatal ${error instanceof Error ? error.name : "UnknownError"}\n`);
  process.exitCode = 1;
} finally {
  transport.close();
  await pool.end();
}
