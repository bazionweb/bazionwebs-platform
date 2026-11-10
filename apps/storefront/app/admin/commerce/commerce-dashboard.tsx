"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Currency = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";
type Product = {
  id: string; sku: string; slug: string; name: string; description: string | null; category: string;
  imageUrl: string | null; imageAlt: string | null; currency: Currency; priceMinor: number;
  compareAtPriceMinor: number | null; featured: boolean; stockTracked: boolean; stockOnHand: number;
  stockReserved: number; active: boolean; createdAt: string;
};
type Order = {
  id: string; orderNumber: string; status: string; currency: Currency; subtotalMinor: number;
  shippingMinor: number; taxMinor: number; totalMinor: number; customerName: string;
  customerEmail: string; customerPhone: string; shippingAddress: Record<string, string>;
  createdAt: string; lines: Array<{ id: string; nameSnapshot: string; skuSnapshot: string; quantity: number; unitPriceMinor: number }>;
};
type Store = {
  storeName: string; tagline: string; supportEmail: string; isHomePage: boolean; locale: string; timeZone: string;
  defaultCountryCode: string; defaultCurrency: Currency; supportedCurrencies: Currency[];
  shippingRates: Partial<Record<Currency, number>>; shippingCountries: string[];
};
type ProductForm = {
  sku: string; slug: string; name: string; description: string; category: string; imageUrl: string; imageAlt: string;
  currency: Currency; price: string; compareAtPrice: string; featured: boolean; stockTracked: boolean;
  stockOnHand: string; active: boolean;
};

const emptyProduct: ProductForm = {
  sku: "", slug: "", name: "", description: "", category: "General", imageUrl: "", imageAlt: "",
  currency: "KES", price: "", compareAtPrice: "", featured: false, stockTracked: true, stockOnHand: "0", active: true,
};
const emptyStore: Store = {
  storeName: "Our Store", tagline: "Thoughtfully selected for you.", supportEmail: "", isHomePage: false,
  locale: "en-KE", timeZone: "Africa/Nairobi", defaultCountryCode: "KE", defaultCurrency: "KES",
  supportedCurrencies: ["KES"], shippingRates: { KES: 0 }, shippingCountries: [],
};
const currencies: Currency[] = ["KES", "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SGD", "ZAR", "NGN", "GHS", "INR", "AED", "BRL", "MXN", "SAR", "CNY", "HKD", "SEK", "NOK", "DKK", "PLN", "THB", "PHP"];

function amount(value: number, currency: Currency, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
}
function decimal(value: number | null | undefined) { return value == null ? "" : (value / 100).toFixed(2); }
function parseAmount(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : Number.NaN;
}
function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/v1${path}`, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => null) as { error?: string; message?: string } | T | null;
  if (!response.ok) {
    const detail = result && typeof result === "object" && "message" in result ? result.message
      : result && typeof result === "object" && "error" in result ? result.error : `Request failed (${response.status})`;
    if (response.status === 401) throw new Error("Your session has expired. Sign in again to manage this store.");
    if (response.status === 403) throw new Error("Your workspace role does not allow this action.");
    throw new Error(detail ?? `Request failed (${response.status})`);
  }
  return result as T;
}

export function CommerceDashboard({ initialTab = "products" }: { initialTab?: "products" | "orders" | "settings" }) {
  const [tab, setTab] = useState<"products" | "orders" | "settings">(initialTab);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [store, setStore] = useState<Store>(emptyStore);
  const [canCreateProduct, setCanCreateProduct] = useState(false);
  const [canEditProduct, setCanEditProduct] = useState(false);
  const [canEditOrders, setCanEditOrders] = useState(false);
  const [canEditStore, setCanEditStore] = useState(false);
  const [productError, setProductError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [storeError, setStoreError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState("all");
  const [countriesInput, setCountriesInput] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      const result = await api<{ items: Product[]; total: number; canCreate: boolean; canUpdate: boolean }>("/admin/commerce/products?limit=100");
      setProducts(result.items); setProductTotal(result.total); setCanCreateProduct(result.canCreate); setCanEditProduct(result.canUpdate); setProductError("");
    } catch (error) { setProductError(message(error)); }
  }, []);
  const loadOrders = useCallback(async () => {
    try {
      const result = await api<{ items: Order[]; total: number; canUpdate: boolean }>("/admin/commerce/orders?limit=50");
      setOrders(result.items); setOrderTotal(result.total); setCanEditOrders(result.canUpdate); setOrderError("");
    } catch (error) { setOrderError(message(error)); }
  }, []);
  const loadStore = useCallback(async () => {
    try {
      const result = await api<{ store: Store; canUpdate: boolean }>("/admin/commerce/store");
      setStore({ ...emptyStore, ...result.store }); setCanEditStore(result.canUpdate);
      setCountriesInput(result.store.shippingCountries.join(", ")); setStoreError("");
    } catch (error) { setStoreError(message(error)); }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadProducts(), loadOrders(), loadStore()]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadOrders, loadProducts, loadStore]);

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setForm({
      sku: product.sku, slug: product.slug, name: product.name, description: product.description ?? "",
      category: product.category, imageUrl: product.imageUrl ?? "", imageAlt: product.imageAlt ?? "",
      currency: product.currency, price: decimal(product.priceMinor), compareAtPrice: decimal(product.compareAtPriceMinor),
      featured: product.featured, stockTracked: product.stockTracked, stockOnHand: String(product.stockOnHand), active: product.active,
    });
    setTab("products");
    document.getElementById("commerce-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice("");
    const priceMinor = parseAmount(form.price);
    const compareAtPriceMinor = parseAmount(form.compareAtPrice);
    if (priceMinor === null || Number.isNaN(priceMinor) || (Number.isNaN(compareAtPriceMinor))) {
      setProductError("Enter valid product prices, using the selected currency."); setSaving(false); return;
    }
    const payload = {
      sku: form.sku, slug: form.slug.trim() || undefined, name: form.name,
      description: form.description || null, category: form.category,
      imageUrl: form.imageUrl || null, imageAlt: form.imageAlt || null,
      currency: form.currency, priceMinor, compareAtPriceMinor,
      featured: form.featured, stockTracked: form.stockTracked,
      stockOnHand: form.stockTracked ? Number(form.stockOnHand) : 0, active: form.active,
    };
    try {
      const path = editingProductId ? `/admin/commerce/products/${editingProductId}` : "/admin/commerce/products";
      await api(path, { method: editingProductId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setForm(emptyProduct); setEditingProductId(null); setProductError("");
      setNotice(editingProductId ? "Product changes saved." : "Product added to your catalog.");
      await loadProducts();
    } catch (error) { setProductError(message(error)); }
    finally { setSaving(false); }
  }

  async function saveStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice(""); setStoreError("");
    const enabled = store.supportedCurrencies.length ? store.supportedCurrencies : [store.defaultCurrency];
    const parsedCountries = countriesInput.split(",").map((country) => country.trim().toUpperCase()).filter(Boolean);
    if (parsedCountries.some((country) => !/^[A-Z]{2}$/.test(country))) {
      setStoreError("Use two-letter ISO country codes separated by commas, such as KE, UG, GB."); setSaving(false); return;
    }
    const shippingRates = Object.fromEntries(enabled.map((currency) => {
      const entered = decimal(store.shippingRates[currency]);
      const value = parseAmount(entered || "0");
      return [currency, value ?? 0];
    }));
    const payload = { ...store, supportedCurrencies: enabled, shippingRates, shippingCountries: parsedCountries };
    try {
      const result = await api<{ store: Store }>("/admin/commerce/store", { method: "PUT", body: JSON.stringify(payload) });
      setStore({ ...emptyStore, ...result.store }); setCountriesInput(result.store.shippingCountries.join(", "));
      setNotice("Store settings saved.");
    } catch (error) { setStoreError(message(error)); }
    finally { setSaving(false); }
  }

  async function fulfillOrder(orderId: string) {
    setSaving(true); setNotice(""); setOrderError("");
    try { await api(`/admin/commerce/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "fulfilled" }) }); setNotice("Order marked fulfilled."); await loadOrders(); }
    catch (error) { setOrderError(message(error)); }
    finally { setSaving(false); }
  }

  const visibleOrders = orderStatus === "all" ? orders : orders.filter((order) => order.status === orderStatus);
  const paidOrders = orders.filter((order) => ["paid", "fulfilled"].includes(order.status)).length;
  const pendingOrders = orders.filter((order) => order.status === "pending_payment").length;

  return <main className="commerce-admin">
    <header className="commerce-admin-header">
      <div><Link href="/admin" className="commerce-back">← Admin portal</Link><p className="commerce-admin-kicker">TENANT COMMERCE</p><h1>Store workspace</h1><p className="commerce-admin-lead">Manage this store's products, orders and regional preferences.</p></div>
      <div className="commerce-admin-actions"><Link href="/shop" target="_blank" rel="noreferrer">Preview shop ↗</Link><Link href="/" target="_blank" rel="noreferrer">Public homepage ↗</Link></div>
    </header>
    <section className="commerce-stats" aria-label="Store overview">
      <div><span>Catalog products</span><strong>{productTotal}</strong></div>
      <div><span>Orders received</span><strong>{orderTotal}</strong></div>
      <div><span>Awaiting payment · latest 50</span><strong>{pendingOrders}</strong></div>
      <div><span>Paid / fulfilled · latest 50</span><strong>{paidOrders}</strong></div>
    </section>
    <nav className="commerce-tabs" aria-label="Commerce sections">
      <button type="button" aria-pressed={tab === "products"} onClick={() => setTab("products")}>Catalog <span>{products.length}</span></button>
      <button type="button" aria-pressed={tab === "orders"} onClick={() => setTab("orders")}>Orders <span>{orders.length}</span></button>
      <button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>Store settings</button>
    </nav>
    {notice && <p className="commerce-success" role="status">{notice}</p>}
    {loading && <p className="commerce-loading" role="status">Loading your store workspace…</p>}

    {!loading && tab === "products" && <section className="commerce-panel" aria-labelledby="catalog-panel-title">
      <div className="commerce-panel-heading"><div><p className="commerce-admin-kicker">THE CATALOG</p><h2 id="catalog-panel-title">Products</h2><p>Prices are entered in major currency units. Inventory reservations are protected during checkout.</p></div>{canCreateProduct && <button type="button" className="commerce-primary" onClick={() => { setEditingProductId(null); setForm(emptyProduct); document.getElementById("commerce-product-form")?.scrollIntoView({ behavior: "smooth" }); }}>+ Add product</button>}</div>
      {productError && <p className="commerce-error" role="alert">{productError}</p>}
      {productError && productError.includes("role") ? <Link className="commerce-signin" href="/login?next=%2Fadmin%2Fcommerce">Sign in with an authorized workspace role</Link> : null}
      {canCreateProduct && <form id="commerce-product-form" className="commerce-product-form" onSubmit={saveProduct}>
        <div className="commerce-form-title"><div><h3>{editingProductId ? "Edit product" : "Add a product"}</h3><p>Keep titles and product images descriptive for shoppers.</p></div>{editingProductId && <button type="button" className="commerce-text-button" onClick={() => { setEditingProductId(null); setForm(emptyProduct); }}>Cancel edit</button>}</div>
        <div className="commerce-form-grid">
          <label>Product name<input required minLength={2} maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: form.slug || event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></label>
          <label>SKU<input required maxLength={80} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
          <label>URL slug<input maxLength={180} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
          <label>Category<input required maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label>Price<input type="number" required min="0" step="0.01" inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Currency })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          <label>Compare-at price<input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Optional sale reference" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: event.target.value })} /></label>
          <label>Stock on hand<input type="number" min="0" step="1" value={form.stockOnHand} disabled={!form.stockTracked} onChange={(event) => setForm({ ...form, stockOnHand: event.target.value })} /></label>
          <label className="commerce-wide">Description<textarea maxLength={5000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="commerce-wide">Product image URL<input type="text" placeholder="https://… or /images/product.jpg" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label>
          <label className="commerce-wide">Image description<input maxLength={180} value={form.imageAlt} onChange={(event) => setForm({ ...form, imageAlt: event.target.value })} /></label>
        </div>
        <div className="commerce-checks"><label><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Feature on the shop</label><label><input type="checkbox" checked={form.stockTracked} onChange={(event) => setForm({ ...form, stockTracked: event.target.checked })} /> Track inventory</label><label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Publish product</label></div>
        {productError && <p className="commerce-error" role="alert">{productError}</p>}
        <button className="commerce-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingProductId ? "Save product" : "Add product"}</button>
      </form>}
      <div className="commerce-product-list">
        {products.length === 0 ? <div className="commerce-empty"><span>✳</span><h3>Your catalog is ready.</h3><p>Add your first product to begin building the public shop.</p></div> : products.map((product) => <article className="commerce-product-row" key={product.id}>
          {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <div className="commerce-product-monogram" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</div>}
          <div className="commerce-product-row-main"><span className="commerce-product-category">{product.category} · {product.sku}</span><h3>{product.name}</h3><p>{amount(product.priceMinor, product.currency, store.locale)}{product.compareAtPriceMinor ? ` · Compare ${amount(product.compareAtPriceMinor, product.currency, store.locale)}` : ""}</p></div>
          <div className="commerce-product-stock"><span className={product.active ? "status-active" : "status-muted"}>{product.active ? "Published" : "Draft"}</span><small>{product.stockTracked ? `${Math.max(product.stockOnHand - product.stockReserved, 0)} available` : "Inventory not tracked"}</small></div>
          {canEditProduct && <button type="button" className="commerce-secondary" onClick={() => editProduct(product)}>Edit</button>}
        </article>)}
      </div>
    </section>}

    {!loading && tab === "orders" && <section className="commerce-panel" aria-labelledby="orders-panel-title">
      <div className="commerce-panel-heading"><div><p className="commerce-admin-kicker">CUSTOMER ORDERS</p><h2 id="orders-panel-title">Orders</h2><p>Payment status is confirmed by the configured provider; only paid orders can be fulfilled.</p></div><label className="commerce-order-filter">Filter<select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option>{["pending_payment", "paid", "fulfilled", "cancelled", "refunded"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div>
      {orderError && <p className="commerce-error" role="alert">{orderError}</p>}
      {orderError && orderError.includes("role") ? <Link className="commerce-signin" href="/login?next=%2Fadmin%2Fcommerce">Sign in with an authorized workspace role</Link> : null}
      {visibleOrders.length === 0 ? <div className="commerce-empty"><span>↗</span><h3>No orders in this view yet.</h3><p>New customer orders will appear here as they come in.</p></div> : visibleOrders.map((order) => <article className="commerce-order-card" key={order.id}>
        <div className="commerce-order-top"><div><span className="commerce-order-number">{order.orderNumber}</span><h3>{order.customerName}</h3><small>{new Date(order.createdAt).toLocaleString(store.locale)}</small></div><div className="commerce-order-state"><span className={`status-${order.status}`}>{order.status.replaceAll("_", " ")}</span><strong>{amount(order.totalMinor, order.currency, store.locale)}</strong></div></div>
        <div className="commerce-order-lines">{order.lines.map((line) => <div key={line.id}><span>{line.quantity} × {line.nameSnapshot}</span><small>{line.skuSnapshot}</small><strong>{amount(line.unitPriceMinor * line.quantity, order.currency, store.locale)}</strong></div>)}</div>
        <details className="commerce-order-customer"><summary>Delivery and customer details</summary><div><span>{order.customerEmail}</span><span>{order.customerPhone}</span><span>{[order.shippingAddress.line1, order.shippingAddress.city, order.shippingAddress.countryCode, order.shippingAddress.postalCode].filter(Boolean).join(", ")}</span></div></details>
        <div className="commerce-order-bottom"><span>Subtotal {amount(order.subtotalMinor, order.currency, store.locale)} · Delivery {amount(order.shippingMinor, order.currency, store.locale)} · Tax {amount(order.taxMinor, order.currency, store.locale)}</span>{canEditOrders && order.status === "paid" && <button type="button" className="commerce-primary" disabled={saving} onClick={() => void fulfillOrder(order.id)}>Mark fulfilled</button>}</div>
      </article>)}
    </section>}

    {!loading && tab === "settings" && <section className="commerce-panel" aria-labelledby="settings-panel-title">
      <div className="commerce-panel-heading"><div><p className="commerce-admin-kicker">REGIONAL SETUP</p><h2 id="settings-panel-title">Store settings</h2><p>Use one catalog per tenant and enable the currencies and delivery countries your business supports.</p></div></div>
      {storeError && <p className="commerce-error" role="alert">{storeError}</p>}
      {canEditStore ? <form className="commerce-settings-form" onSubmit={saveStore}>
        <label>Store name<input required minLength={2} maxLength={160} value={store.storeName} onChange={(event) => setStore({ ...store, storeName: event.target.value })} /></label>
        <label>Store tagline<input maxLength={240} value={store.tagline} onChange={(event) => setStore({ ...store, tagline: event.target.value })} /></label>
        <label>Customer support email<input type="email" value={store.supportEmail} onChange={(event) => setStore({ ...store, supportEmail: event.target.value })} /></label>
        <label>Locale<input required placeholder="en-KE" value={store.locale} onChange={(event) => setStore({ ...store, locale: event.target.value })} /></label>
        <label>Time zone<input required placeholder="Africa/Nairobi" value={store.timeZone} onChange={(event) => setStore({ ...store, timeZone: event.target.value })} /></label>
        <label>Default delivery country<input required maxLength={2} placeholder="KE" value={store.defaultCountryCode} onChange={(event) => setStore({ ...store, defaultCountryCode: event.target.value.toUpperCase() })} /></label>
        <label>Default currency<select value={store.defaultCurrency} onChange={(event) => {
          const next = event.target.value as Currency;
          setStore({ ...store, defaultCurrency: next, supportedCurrencies: store.supportedCurrencies.includes(next) ? store.supportedCurrencies : [...store.supportedCurrencies, next] });
        }}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <fieldset className="commerce-wide"><legend>Shopper currencies</legend><div className="commerce-checks">{currencies.map((currency) => <label key={currency}><input type="checkbox" checked={store.supportedCurrencies.includes(currency)} onChange={(event) => setStore({ ...store, supportedCurrencies: event.target.checked ? [...store.supportedCurrencies, currency] : store.supportedCurrencies.filter((item) => item !== currency) })} /> {currency}</label>)}</div><p className="commerce-help">A separate product price is required in each currency. The store does not perform automatic exchange-rate conversion.</p></fieldset>
        <div className="commerce-wide"><p className="commerce-field-label">Flat delivery estimate by currency</p><div className="commerce-rate-grid">{store.supportedCurrencies.map((currency) => <label key={currency}>{currency}<input type="number" min="0" step="0.01" value={decimal(store.shippingRates[currency])} onChange={(event) => setStore({ ...store, shippingRates: { ...store.shippingRates, [currency]: parseAmount(event.target.value) ?? 0 } })} /></label>)}</div><p className="commerce-help">Flat-rate delivery only. Tax is not automatically calculated by this starter template.</p></div>
        <label className="commerce-wide">Delivery countries<input placeholder="KE, UG, TZ, GB (leave blank to allow all countries)" value={countriesInput} onChange={(event) => setCountriesInput(event.target.value)} /><small>Use two-letter ISO country codes. An empty list allows the countries shown in checkout.</small></label>
        <label className="commerce-home-toggle"><input type="checkbox" checked={store.isHomePage} onChange={(event) => setStore({ ...store, isHomePage: event.target.checked })} /><span><strong>Use this shop as the public homepage</strong><small>This setting affects only this tenant. The reusable ministry template stays available to every other tenant.</small></span></label>
        {storeError && <p className="commerce-error commerce-wide" role="alert">{storeError}</p>}
        <div className="commerce-wide commerce-settings-actions"><button className="commerce-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save store settings"}</button><Link href="/shop" target="_blank" rel="noreferrer">Open shop preview ↗</Link></div>
      </form> : <p className="commerce-error">Your workspace role can view store data but cannot change store settings.</p>}
    </section>}
    <footer className="commerce-admin-footer">Commerce data is scoped to the active tenant workspace. Store payments and tax rules depend on configured regional providers.</footer>
  </main>;
}
