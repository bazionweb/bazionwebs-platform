import type { Metadata } from "next";
import Link from "next/link";
import { ResponsiveImage } from "@bazion/ui";
import { notFound } from "next/navigation";
import { fetchTenantPublicData } from "../../../lib/server-tenant-api";
import { ProductPurchaseButton } from "../product-purchase-button";
import "../shop.css";

type Currency = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";
type Product = {
  id: string; sku: string; slug: string; name: string; description: string | null; category: string;
  imageUrl: string | null; imageAlt: string | null; featured: boolean; compareAtPriceMinor: number | null;
  currency: Currency; priceMinor: number; stockAvailable: number | null;
};
type Store = { storeName: string; supportEmail: string; locale: string; defaultCountryCode: string; defaultCurrency: Currency; supportedCurrencies: Currency[]; shippingRates: Partial<Record<Currency, number>>; shippingCountries: string[] };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchTenantPublicData<{ product: Product }>(`/v1/products/${encodeURIComponent(slug)}`);
  if (!data?.product) return { title: "Product not found" };
  return { title: data.product.name, description: data.product.description?.slice(0, 160) || `${data.product.name} from our collection.` };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, storeResponse, productResponse] = await Promise.all([
    params,
    fetchTenantPublicData<{ store: Store; paymentProvider: "mpesa" | "mock" }>("/v1/storefront"),
    params.then(({ slug }) => fetchTenantPublicData<{ product: Product }>(`/v1/products/${encodeURIComponent(slug)}`)),
  ]);
  if (!productResponse?.product || !storeResponse?.store) notFound();
  const product = productResponse.product;
  const store = storeResponse.store;
  const paymentUnavailable = storeResponse.paymentProvider === "mpesa" && product.currency !== "KES";
  const formattedPrice = new Intl.NumberFormat(store.locale, { style: "currency", currency: product.currency }).format(product.priceMinor / 100);
  return <main className="store-shell">
    <header className="store-nav"><a className="store-brand" href="/"><span className="store-mark" aria-hidden="true">✳</span><span>{store.storeName}</span></a><nav aria-label="Store navigation"><Link href="/shop">All products</Link><a href="/shop#basket">Your basket</a></nav></header>
    <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span aria-hidden="true">/</span><span>{product.category}</span><span aria-hidden="true">/</span><span>{product.name}</span></nav>
    <section className="product-detail-grid">
      <div className="product-detail-visual">{product.imageUrl ? <ResponsiveImage src={product.imageUrl} alt={product.imageAlt || product.name} sizes="(max-width: 900px) 100vw, 52vw" loading="eager" /> : <div className="product-placeholder placeholder-0" aria-hidden="true"><b>{product.name.slice(0, 1).toUpperCase()}</b></div>}{product.featured && <span className="product-badge">A favourite</span>}</div>
      <div className="product-detail-copy"><p className="store-eyebrow"><span /> {product.category}</p><h1>{product.name}</h1><p className="product-detail-price">{formattedPrice}{product.compareAtPriceMinor !== null && product.compareAtPriceMinor > product.priceMinor && <del>{new Intl.NumberFormat(store.locale, { style: "currency", currency: product.currency }).format(product.compareAtPriceMinor / 100)}</del>}</p><p className="product-detail-description">{product.description || "A thoughtfully selected piece, ready to make everyday life a little better."}</p><p className="product-detail-stock">{product.stockAvailable === null ? "Ready to order" : product.stockAvailable > 0 ? `${product.stockAvailable} available` : "Currently unavailable"}</p>{paymentUnavailable && <p className="store-payment-limit">The configured M-Pesa provider can only take KES payments. This product needs a global payment provider before it can be purchased in {product.currency}.</p>}<ProductPurchaseButton productId={product.id} productName={product.name} currency={product.currency} soldOut={product.stockAvailable === 0 || paymentUnavailable} /><p className="product-detail-note">Delivery options and final costs are confirmed during checkout. Taxes are not calculated by this template.</p><Link className="product-continue-link" href="/shop">← Continue browsing</Link></div>
    </section>
    <footer className="store-footer"><a className="store-brand" href="/"><span className="store-mark" aria-hidden="true">✳</span><span>{store.storeName}</span></a>{store.supportEmail && <a className="store-support-link" href={`mailto:${store.supportEmail}`}>Questions? Email us</a>}<span>© {new Date().getFullYear()} {store.storeName}</span></footer>
  </main>;
}
