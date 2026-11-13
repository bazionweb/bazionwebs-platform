"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ResponsiveImage } from "@bazion/ui";

type Currency = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";
type Product = {
  id: string; sku: string; slug: string; name: string; description: string | null; category: string;
  imageUrl: string | null; imageAlt: string | null; featured: boolean; compareAtPriceMinor: number | null;
  currency: Currency; priceMinor: number; stockAvailable: number | null;
};
type Cart = {
  id: string; currency: Currency; status: string;
  items: Array<{ id: string; productId: string; quantity: number; unitPriceMinor: number; name: string; sku: string }>;
  totals: { subtotalMinor: number; totalMinor: number; currency: Currency };
};
type Store = {
  storeName: string; tagline: string; supportEmail: string; isHomePage: boolean; locale: string; defaultCountryCode: string; defaultCurrency: Currency;
  supportedCurrencies: Currency[]; shippingRates: Partial<Record<Currency, number>>; shippingCountries: string[];
  paymentProvider: "mpesa" | "mock";
};
type CheckoutResult = {
  orderId: string; orderNumber: string; status: string; currency: Currency; totalMinor: number;
  payment: { provider: string; status: string; redirectUrl: string | null; providerReference?: string | null };
};

const countries = [
  ["KE", "Kenya"], ["UG", "Uganda"], ["TZ", "Tanzania"], ["RW", "Rwanda"], ["NG", "Nigeria"], ["ZA", "South Africa"],
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"],
  ["NL", "Netherlands"], ["ES", "Spain"], ["IT", "Italy"], ["AU", "Australia"], ["NZ", "New Zealand"], ["IN", "India"], ["AE", "United Arab Emirates"],
] as const;
const allCountryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");

function money(amountMinor: number, currency: Currency, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMinor / 100);
}

function defaultPhonePrefix(countryCode: string) {
  return ({ KE: "+254", UG: "+256", TZ: "+255", US: "+1", CA: "+1", GB: "+44", AU: "+61", IN: "+91" } as Record<string, string>)[countryCode] ?? "+";
}

export function ShopStorefront({ initialProducts, categories, store, homeHref = "/" }: { initialProducts: Product[]; categories: string[]; store: Store; homeHref?: string }) {
  const shopperCurrencies = store.paymentProvider === "mpesa"
    ? store.supportedCurrencies.filter((item) => item === "KES")
    : store.supportedCurrencies;
  const initialCurrency = shopperCurrencies.includes(store.defaultCurrency) ? store.defaultCurrency : shopperCurrencies[0] ?? "KES";
  const [products, setProducts] = useState(initialProducts);
  const [totalProducts, setTotalProducts] = useState(initialProducts.length);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [paymentStatusToken, setPaymentStatusToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState({ line1: "", city: "", countryCode: store.defaultCountryCode, postalCode: "" });

  const availableCountries = useMemo(() => {
    const names = new Intl.DisplayNames([store.locale], { type: "region" });
    const codes = store.shippingCountries.length ? store.shippingCountries : allCountryCodes;
    return codes.map((code) => [code, countries.find(([knownCode]) => knownCode === code)?.[1] ?? names.of(code) ?? code] as const)
      .sort((left, right) => left[1].localeCompare(right[1]));
  }, [store.locale, store.shippingCountries]);

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(`/v1${path}`, { ...init, credentials: "include", headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? data.error ?? `Request failed (${response.status})`);
    return data as T;
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingProducts(true);
      const params = new URLSearchParams({ limit: "100", currency, sort });
      if (search.trim()) params.set("q", search.trim());
      if (category !== "all") params.set("category", category);
      fetch(`/v1/products?${params.toString()}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Product list could not be refreshed.");
          return response.json() as Promise<{ items: Product[]; total: number }>;
        })
        .then((result) => { if (active) { setProducts(result.items); setTotalProducts(result.total); } })
        .catch(() => { if (active) setNotice("Products could not be refreshed. Please try again."); })
        .finally(() => { if (active) setLoadingProducts(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [category, currency, search, sort]);

  useEffect(() => {
    let active = true;
    const savedCartId = window.localStorage.getItem("bazion-commerce-cart");
    if (!savedCartId) return;
    setCartId(savedCartId);
    api<Cart>(`/carts/${savedCartId}`).then((result) => {
      if (!active) return;
      if (store.paymentProvider === "mpesa" && result.currency !== "KES") {
        window.localStorage.removeItem("bazion-commerce-cart");
        setCartId(null); setNotice("Your saved basket uses a currency that the configured M-Pesa provider cannot charge.");
        return;
      }
      setCart(result);
      setCurrency(result.currency);
      const savedCheckout = window.sessionStorage.getItem(`bazion-checkout-result:${savedCartId}`);
      const savedStatusToken = window.sessionStorage.getItem(`bazion-checkout-status:${savedCartId}`);
      if (savedCheckout) {
        try { setCheckout(JSON.parse(savedCheckout) as CheckoutResult); }
        catch { window.sessionStorage.removeItem(`bazion-checkout-result:${savedCartId}`); }
      }
      if (savedStatusToken) setPaymentStatusToken(savedStatusToken);
    }).catch(() => {
      window.localStorage.removeItem("bazion-commerce-cart");
      if (active) { setCartId(null); setCart(null); }
    });
    return () => { active = false; };
    // One restore on mount; the guest credential itself is in the HttpOnly cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.paymentProvider]);

  useEffect(() => {
    if (checkout?.payment.provider !== "mpesa" || !paymentStatusToken || ["succeeded", "failed", "cancelled"].includes(checkout.payment.status)) return;
    let active = true;
    const checkPayment = async () => {
      try {
        const response = await fetch("/v1/public/commerce/payments/status", { credentials: "include", headers: { "X-Payment-Status-Token": paymentStatusToken } });
        if (!response.ok) return;
        const data = await response.json() as { attemptStatus?: string; orderStatus?: string; providerReference?: string | null };
        if (!active || typeof data.attemptStatus !== "string" || !cartId) return;
        const next = { ...checkout, status: data.orderStatus ?? checkout.status, payment: { ...checkout.payment, status: data.attemptStatus, providerReference: data.providerReference } };
        setCheckout(next);
        window.sessionStorage.setItem(`bazion-checkout-result:${cartId}`, JSON.stringify(next));
        if (["succeeded", "failed", "cancelled"].includes(data.attemptStatus)) {
          window.sessionStorage.removeItem(`bazion-checkout-status:${cartId}`);
          setPaymentStatusToken(null);
          setNotice(data.attemptStatus === "succeeded" ? "Your payment is confirmed." : "The payment did not complete. No payment was recorded.");
        }
      } catch { /* The order stays pending until the provider confirms it. */ }
    };
    void checkPayment();
    const timer = window.setInterval(() => void checkPayment(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [cartId, checkout, paymentStatusToken]);

  const estimatedShipping = store.shippingRates[currency] ?? 0;
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  async function ensureCart() {
    if (cartId && cart?.currency === currency && cart.status === "open") return cartId;
    const created = await api<{ id: string }>("/carts", { method: "POST", body: JSON.stringify({ currency }) });
    setCartId(created.id);
    window.localStorage.setItem("bazion-commerce-cart", created.id);
    return created.id;
  }

  async function addProduct(product: Product) {
    if (product.currency !== currency) {
      setNotice(`Choose ${product.currency} to add this item to your basket.`);
      return;
    }
    setBusy(true); setNotice("");
    try {
      const id = await ensureCart();
      const updated = await api<Cart>(`/carts/${id}/items`, { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }) });
      setCart(updated); setCheckout(null); setNotice(`${product.name} added to your basket.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not add this item."); }
    finally { setBusy(false); }
  }

  async function changeQuantity(itemId: string, quantity: number) {
    if (!cartId) return;
    setBusy(true);
    try { setCart(await api<Cart>(`/carts/${cartId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update the basket."); }
    finally { setBusy(false); }
  }

  async function removeItem(itemId: string) {
    if (!cartId) return;
    setBusy(true);
    try { setCart(await api<Cart>(`/carts/${cartId}/items/${itemId}`, { method: "DELETE" })); setCheckout(null); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the item."); }
    finally { setBusy(false); }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cartId) return;
    setBusy(true); setNotice("");
    try {
      const keyKey = `bazion-checkout-key:${cartId}`;
      const statusKey = `bazion-checkout-status:${cartId}`;
      const idempotencyKey = window.sessionStorage.getItem(keyKey) ?? crypto.randomUUID();
      const statusToken = window.sessionStorage.getItem(statusKey) ?? `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
      window.sessionStorage.setItem(keyKey, idempotencyKey);
      window.sessionStorage.setItem(statusKey, statusToken);
      const result = await api<CheckoutResult>("/checkout", {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey, "X-Payment-Status-Token": statusToken },
        body: JSON.stringify({ cartId, customer, shippingAddress: address }),
      });
      window.sessionStorage.removeItem(keyKey);
      window.sessionStorage.setItem(`bazion-checkout-result:${cartId}`, JSON.stringify(result));
      setCheckout(result);
      setCart((current) => current ? { ...current, status: "converted" } : current);
      const pendingMpesa = result.payment.provider === "mpesa" && !["succeeded", "failed", "cancelled"].includes(result.payment.status);
      setPaymentStatusToken(pendingMpesa ? statusToken : null);
      if (!pendingMpesa) window.sessionStorage.removeItem(statusKey);
      setNotice(result.payment.provider === "mpesa"
        ? "Approve the M-Pesa prompt. Your order remains unpaid until Safaricom confirms it."
        : "Order created. Continue to the configured payment step.");
    } catch (error) {
      window.sessionStorage.removeItem(`bazion-checkout-key:${cartId}`);
      setNotice(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally { setBusy(false); }
  }

  function changeCurrency(value: Currency) {
    if (cart?.status === "open" && cart.items.length && cart.currency !== value) {
      setNotice("Finish or empty your current basket before changing its currency.");
      return;
    }
    setCurrency(value); setNotice("");
  }

  return (
    <main className="store-shell">
      <header className="store-nav">
        <a className="store-brand" href={homeHref} aria-label={`${store.storeName} home`}>
          <span className="store-mark" aria-hidden="true">✳</span><span>{store.storeName}</span>
        </a>
        <nav aria-label="Store navigation">
          <a href="#catalog">Shop</a><a href="#promise">Our promise</a>
          <a className="store-cart-link" href="#basket">Basket <span>{cartCount}</span></a>
        </nav>
      </header>

      <section className="store-hero" aria-labelledby="store-title">
        <div className="store-hero-copy">
          <p className="store-eyebrow"><span /> A considered collection</p>
          <h1 id="store-title">Made for the<br /><em>way you live.</em></h1>
          <p>{store.tagline}</p>
          <a className="store-primary-link" href="#catalog">Explore the collection <span aria-hidden="true">↘</span></a>
        </div>
        <div className="store-hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><span>Everyday<br />essentials</span><b>01</b></div>
        <div className="store-hero-foot"><span>Thoughtful goods, chosen with care</span><span>Scroll to explore ↓</span></div>
      </section>

      <section className="store-benefits" id="promise" aria-label="Store promises">
        <div><span>01</span><strong>Thoughtfully chosen</strong><small>Useful things with lasting value.</small></div>
        <div><span>02</span><strong>Clear, honest pricing</strong><small>Your currency and delivery costs shown up front.</small></div>
        <div><span>03</span><strong>Here when you need us</strong><small>Real people ready to help with your order.</small></div>
      </section>

      <section id="catalog" className="store-catalog" aria-labelledby="catalog-title">
        <div className="store-section-heading">
          <div><p className="store-eyebrow">THE COLLECTION</p><h2 id="catalog-title">Find your next favourite.</h2></div>
          <p>{totalProducts} {totalProducts === 1 ? "piece" : "pieces"} to explore</p>
        </div>
        {store.paymentProvider === "mpesa" && shopperCurrencies.length === 0 && <p className="store-payment-limit" role="status">This store needs a KES price list for M-Pesa checkout. Connect a global payment provider before selling in other currencies.</p>}
        <div className="store-filters">
          <label className="store-search"><span className="sr-only">Search products</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Search the collection" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured first</option><option value="newest">Recently added</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
          {shopperCurrencies.length > 1 && <label><span className="sr-only">Display currency</span><select value={currency} onChange={(event) => changeCurrency(event.target.value as Currency)}>{shopperCurrencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        </div>
        <div className="store-products" aria-busy={loadingProducts}>
          {products.length === 0 ? <div className="store-empty"><span aria-hidden="true">✳</span><h3>No pieces found</h3><p>Try another search or choose a different category.</p></div> : products.map((product, index) => (
            <article className="store-product" key={product.id} style={{ "--product-index": index } as React.CSSProperties}>
              <div className="store-product-image">
                {product.imageUrl ? <ResponsiveImage src={product.imageUrl} alt={product.imageAlt || product.name} sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 33vw" /> : <div className={`product-placeholder placeholder-${index % 4}`} aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span><b>{product.name.slice(0, 1).toUpperCase()}</b></div>}
                {product.featured && <span className="product-badge">A favourite</span>}
                {product.stockAvailable === 0 && <span className="product-badge sold-out">Sold out</span>}
                <button type="button" className="quick-add" aria-label={`Add ${product.name} to basket`} disabled={busy || product.stockAvailable === 0} onClick={() => void addProduct(product)}><span aria-hidden="true">+</span><span>Add to basket</span></button>
              </div>
              <div className="store-product-meta"><div><span>{product.category}</span><h3><a href={`/shop/${encodeURIComponent(product.slug)}`}>{product.name}</a></h3></div><div className="store-price"><strong>{money(product.priceMinor, product.currency, store.locale)}</strong>{product.compareAtPriceMinor !== null && product.compareAtPriceMinor > product.priceMinor && <del>{money(product.compareAtPriceMinor, product.currency, store.locale)}</del>}</div></div>
              {product.description && <p className="store-product-description">{product.description}</p>}
              <p className="store-stock">{product.stockAvailable === null ? "Ready to order" : product.stockAvailable > 0 ? `${product.stockAvailable} in stock` : "Currently unavailable"}</p>
            </article>
          ))}
        </div>
        {totalProducts > products.length && <p className="store-result-note">Showing {products.length} of {totalProducts}. Refine your search to find more.</p>}
      </section>

      <section id="basket" className="store-basket" aria-labelledby="basket-title">
        <div className="store-section-heading"><div><p className="store-eyebrow">YOUR BASKET</p><h2 id="basket-title">A good choice.</h2></div><span>{cartCount} {cartCount === 1 ? "item" : "items"}</span></div>
        {!cart || cart.items.length === 0 ? <div className="store-basket-empty"><p>Your basket is taking a little break.</p><a href="#catalog">Browse the collection ↗</a></div> : <div className="store-basket-layout">
          <div className="store-cart-lines">{cart.items.map((item) => <div className="store-cart-line" key={item.id}>
            <div><strong>{item.name}</strong><small>{item.sku} · {money(item.unitPriceMinor, cart.currency, store.locale)} each</small></div>
            <div className="store-quantity"><button type="button" disabled={busy || item.quantity <= 1} aria-label={`Remove one ${item.name}`} onClick={() => void changeQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" disabled={busy || item.quantity >= 99} aria-label={`Add one ${item.name}`} onClick={() => void changeQuantity(item.id, item.quantity + 1)}>+</button></div>
            <strong>{money(item.unitPriceMinor * item.quantity, cart.currency, store.locale)}</strong>
            <button type="button" className="store-remove" disabled={busy} onClick={() => void removeItem(item.id)}>Remove</button>
          </div>)}
          <div className="store-cart-total"><span>Subtotal</span><strong>{money(cart.totals.subtotalMinor, cart.currency, store.locale)}</strong></div>
          <div className="store-cart-total"><span>Delivery estimate</span><strong>{money(estimatedShipping, cart.currency, store.locale)}</strong></div>
          <p className="store-tax-note">Tax is not included in this template total. Configure the tax rules required in each selling region before launch.</p>
          </div>
          <form className="store-checkout" onSubmit={submitCheckout}>
            <p className="store-eyebrow">SECURE CHECKOUT</p><h3>Where should we send it?</h3>
            <label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
            <label>Email address<input type="email" autoComplete="email" required value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
            <label>Phone number<input type="tel" autoComplete="tel" placeholder={`${defaultPhonePrefix(address.countryCode)} …`} required value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
            <label>Street address<input autoComplete="street-address" required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label>
            <div className="store-checkout-row"><label>City<input autoComplete="address-level2" required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>Postal code<input autoComplete="postal-code" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label></div>
            <label>Delivery country<select autoComplete="country" value={address.countryCode} onChange={(event) => setAddress({ ...address, countryCode: event.target.value, city: address.city || "" })}>{availableCountries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
            <button className="store-checkout-button" type="submit" disabled={busy || Boolean(checkout)}>{busy ? "Preparing your order…" : checkout ? "Order created" : "Continue to payment · " + money(cart.totals.subtotalMinor + estimatedShipping, cart.currency, store.locale)}</button>
          <p className="store-secure-note">{store.paymentProvider === "mpesa" ? "Pay securely with the configured M-Pesa service." : "Payment details are handled by the configured provider."}</p>
            {notice && <p className="store-notice" role="status">{notice}</p>}
            {checkout && <div className="store-confirmation" role="status"><span>Order {checkout.status === "paid" ? "confirmed" : "received"}</span><h4>{checkout.orderNumber}</h4><p>{money(checkout.totalMinor, checkout.currency, store.locale)}</p>
              {checkout.payment.provider === "mpesa" ? <p>{checkout.payment.status === "succeeded" ? "Payment received. Thank you." : checkout.payment.status === "failed" || checkout.payment.status === "cancelled" ? "Payment did not complete." : "Approve the M-Pesa prompt. We will update this page when it is confirmed."}</p> : checkout.payment.redirectUrl && <a href={checkout.payment.redirectUrl}>Continue to payment ↗</a>}
            </div>}
          </form>
        </div>}
      </section>

      <footer className="store-footer"><a className="store-brand" href={homeHref}><span className="store-mark" aria-hidden="true">✳</span><span>{store.storeName}</span></a><span>Made to feel easy.</span>{store.supportEmail && <a className="store-support-link" href={`mailto:${store.supportEmail}`}>Questions? Email us</a>}<span>© {new Date().getFullYear()} {store.storeName}</span></footer>
      <div className="store-mobile-basket"><a href="#basket">Basket <span>{cartCount}</span></a></div>
    </main>
  );
}
