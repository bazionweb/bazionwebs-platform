import { Storefront } from "./storefront";

const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";

async function getProducts() {
  try {
    const response = await fetch(`${apiBase}/v1/products`, { cache: "no-store" });
    if (!response.ok) return [];
    return await response.json() as Array<{ id: string; sku: string; name: string; description: string | null; currency: string; priceMinor: number; stockAvailable: number | null }>;
  } catch { return []; }
}

export default async function HomePage() {
  const products = await getProducts();
  return (
    <main className="shell">
      <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">PLATFORM DEMO</span><a className="cart-nav" href="#cart">Cart ↓</a></nav>
      <section className="hero">
        <p className="eyebrow">BUILD · HOST · GROW</p>
        <h1>Reusable commerce.<br /><em>Ready for your brand.</em></h1>
        <p className="intro">This demo storefront reads products from the Bazion commerce API. Its cart and checkout logic lives in shared server-side packages and can power independently branded client stores.</p>
        <a className="cta" href="#products">Explore demo products <span>↘</span></a>
      </section>
      <Storefront products={products} apiBase="" />
      <footer><span>BAZION WEB PLATFORM</span><span>Reusable blocks. Independent client experiences.</span></footer>
    </main>
  );
}
