"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Product = { id: string; sku: string; name: string; description: string | null; currency: string; priceMinor: number; stockAvailable: number | null };
type Cart = { id: string; currency: string; status: string; items: Array<{ id: string; productId: string; quantity: number; unitPriceMinor: number; name: string; sku: string }>; totals: { subtotalMinor: number; totalMinor: number; currency: string } };
type CheckoutResult = { orderId: string; orderNumber: string; status: string; currency: string; totalMinor: number; payment: { provider: string; status: string; redirectUrl: string | null } };

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amountMinor / 100);
}

export function Storefront({ products, apiBase }: { products: Product[]; apiBase: string }) {
  const [cartId, setCartId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "+254" });
  const [address, setAddress] = useState({ line1: "", city: "Nairobi", countryCode: "KE", postalCode: "" });

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? data.error ?? `Request failed (${response.status})`);
    return data as T;
  }

  async function refreshCart(id: string) {
    const result = await api<Cart>(`/v1/carts/${id}`);
    setCart(result);
    return result;
  }

  useEffect(() => {
    const savedCartId = window.localStorage.getItem("bazion-demo-cart-id");
    if (savedCartId) {
      setCartId(savedCartId);
      refreshCart(savedCartId).catch(() => {
        window.localStorage.removeItem("bazion-demo-cart-id");
        setCartId(null);
      });
    }
    // The ID is not a credential. The actual guest token is held in an HttpOnly cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureCart() {
    if (cartId) return cartId;
    const created = await api<{ id: string }>("/v1/carts", { method: "POST", body: JSON.stringify({ currency: "KES" }) });
    setCartId(created.id);
    window.localStorage.setItem("bazion-demo-cart-id", created.id);
    return created.id;
  }

  async function addProduct(productId: string) {
    setBusy(true); setNotice("");
    try {
      const id = await ensureCart();
      const updated = await api<Cart>(`/v1/carts/${id}/items`, { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
      setCart(updated); setCheckout(null); setNotice("Added to your cart.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not add the item."); }
    finally { setBusy(false); }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!cartId) return;
    setBusy(true);
    try {
      const updated = await api<Cart>(`/v1/carts/${cartId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
      setCart(updated);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update the cart."); }
    finally { setBusy(false); }
  }

  async function removeItem(itemId: string) {
    if (!cartId) return;
    setBusy(true);
    try {
      const updated = await api<Cart>(`/v1/carts/${cartId}/items/${itemId}`, { method: "DELETE" });
      setCart(updated);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the item."); }
    finally { setBusy(false); }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cartId) return;
    setBusy(true); setNotice("");
    try {
      const idempotencyStorageKey = `bazion-checkout-key:${cartId}`;
      const idempotencyKey = window.sessionStorage.getItem(idempotencyStorageKey) ?? crypto.randomUUID();
      window.sessionStorage.setItem(idempotencyStorageKey, idempotencyKey);
      const result = await api<CheckoutResult>("/v1/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ cartId, customer, shippingAddress: address }),
      });
      window.sessionStorage.removeItem(idempotencyStorageKey);
      setCheckout(result);
      setNotice("Order created. Complete the development payment simulation to test the order flow.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Checkout could not be completed."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <section id="products" className="products">
        <div className="section-heading"><div><p className="eyebrow">THE CATALOGUE</p><h2>Sample products</h2></div><span>{products.length} ITEMS</span></div>
        {products.length === 0 ? <div className="empty">No products found. Start PostgreSQL, run the migration and seed commands, then refresh this page.</div> :
          <div className="grid">{products.map((product) => <article className="product" key={product.id}>
            <div className="product-art"><span>{product.sku}</span><div className="orb">B.</div></div>
            <div className="product-info"><div><h3>{product.name}</h3><p>{product.description}</p></div><strong>{money(product.priceMinor, product.currency)}</strong></div>
            <p className="stock">{product.stockAvailable === null ? "Available" : `${product.stockAvailable} available`}</p>
            <button className="add-button" disabled={busy || product.stockAvailable === 0} onClick={() => addProduct(product.id)}>{busy ? "Please wait…" : "Add to cart +"}</button>
          </article>)}</div>}
      </section>

      <section className="cart-section" id="cart">
        <div className="section-heading"><div><p className="eyebrow">YOUR BASKET</p><h2>Shopping cart</h2></div><span>{cart?.items.length ?? 0} LINES</span></div>
        {!cart || cart.items.length === 0 ? <div className="empty">Your cart is empty. Add a sample product to begin.</div> : <>
          <div className="cart-lines">{cart.items.map((item) => <div className="cart-line" key={item.id}>
            <div><strong>{item.name}</strong><small>{item.sku} · {money(item.unitPriceMinor, cart.currency)} each</small></div>
            <div className="quantity"><button disabled={busy || item.quantity <= 1} onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity">−</button><span>{item.quantity}</span><button disabled={busy || item.quantity >= 99} onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button></div>
            <strong>{money(item.unitPriceMinor * item.quantity, cart.currency)}</strong>
            <button className="remove" disabled={busy} onClick={() => removeItem(item.id)}>Remove</button>
          </div>)}</div>
          <div className="cart-total"><span>Subtotal · shipping and tax are not yet enabled</span><strong>{money(cart.totals.totalMinor, cart.currency)}</strong></div>
          <form className="checkout-form" onSubmit={submitCheckout}>
            <p className="eyebrow">CHECKOUT DETAILS</p><h3>Where should we send your order?</h3>
            <div className="form-grid">
              <label>Full name<input required minLength={2} maxLength={120} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label>
              <label>Email<input type="email" required value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></label>
              <label>Phone<input required value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label>
              <label>Street / delivery address<input required value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} /></label>
              <label>City<input required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /></label>
              <label>Postal code<input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} /></label>
            </div>
            <button className="checkout-button" type="submit" disabled={busy}>{busy ? "Processing…" : "Create order and continue →"}</button>
          </form>
        </>}
        {notice && <p className="notice" role="status">{notice}</p>}
        {checkout && <div className="order-confirmation"><p className="eyebrow">ORDER CREATED</p><h3>{checkout.orderNumber}</h3><p>{money(checkout.totalMinor, checkout.currency)} · {checkout.status}</p><a href={checkout.payment.redirectUrl ?? `/checkout/test-payment?orderId=${checkout.orderId}`}>Continue to test payment →</a></div>}
      </section>
    </>
  );
}
