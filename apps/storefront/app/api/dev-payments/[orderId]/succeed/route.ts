import { NextResponse } from "next/server";

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { orderId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return new Response("Invalid order", { status: 400 });
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
  const secret = process.env.DEV_PAYMENT_SECRET;
  if (!secret) return new Response("Development payment secret is not configured", { status: 503 });
  const result = await fetch(`${apiBase}/v1/_dev/orders/${orderId}/pay`, {
    method: "POST",
    headers: { "x-dev-secret": secret },
    cache: "no-store",
  });
  if (!result.ok) return new Response("Payment simulation failed", { status: result.status });
  return NextResponse.redirect(new URL(`/?payment=simulated&orderId=${orderId}`, process.env.PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"), 303);
}
