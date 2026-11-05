import Link from "next/link";
import { notFound } from "next/navigation";

export default async function TestPaymentPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { orderId } = await searchParams;
  const validOrderId = typeof orderId === "string" && /^[0-9a-f-]{36}$/i.test(orderId);
  return <main className="shell"><nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">LOCAL PAYMENT SIMULATOR</span></nav>
    <section className="hero"><p className="eyebrow">DEVELOPMENT ONLY</p><h1>Test payment.<br /><em>No real money moves.</em></h1>
      <p className="intro">This page is connected to Bazion's local mock payment adapter. It must never be used in a production store.</p>
      {validOrderId ? <form action={`/api/dev-payments/${orderId}/succeed`} method="post"><button className="checkout-button" type="submit">Simulate successful payment →</button></form> : <p className="notice">Missing or invalid order reference.</p>}
      <p><Link href="/" style={{color:"#596d56"}}>← Return to store</Link></p>
    </section></main>;
}
