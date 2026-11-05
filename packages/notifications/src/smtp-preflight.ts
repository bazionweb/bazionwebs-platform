import nodemailer from "nodemailer";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("SMTP production preflight requires NODE_ENV=production.");
  }

  const host = required("NOTIFICATION_SMTP_HOST");
  const port = Number(process.env.NOTIFICATION_SMTP_PORT ?? "587");
  const secure = process.env.NOTIFICATION_SMTP_SECURE === "true";
  const requireTls = process.env.NOTIFICATION_SMTP_REQUIRE_TLS !== "false";
  const user = process.env.NOTIFICATION_SMTP_USER?.trim();
  const password = process.env.NOTIFICATION_SMTP_PASSWORD;

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("NOTIFICATION_SMTP_PORT must be a valid TCP port.");
  }
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("Configure both NOTIFICATION_SMTP_USER and NOTIFICATION_SMTP_PASSWORD, or neither.");
  }
  if (!user || !password) {
    throw new Error("Production SMTP authentication is required; provide both NOTIFICATION_SMTP_USER and NOTIFICATION_SMTP_PASSWORD.");
  }
  if (!secure && !requireTls) {
    throw new Error("Production SMTP must use implicit TLS or mandatory STARTTLS.");
  }
  required("NOTIFICATION_EMAIL_FROM");

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && requireTls,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    ...(user && password ? { auth: { user, pass: password } } : {}),
  });

  try {
    await transport.verify();
    process.stdout.write(`SMTP preflight passed for ${host}:${port}; credentials and message content were not logged.\n`);
  } finally {
    transport.close();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`SMTP preflight failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
}
