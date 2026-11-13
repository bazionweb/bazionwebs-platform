"use client";

import { useState } from "react";
import { pulse } from "@bazion/ui";

export function ProductPurchaseButton({ productId, productName, currency, soldOut }: { productId: string; productName: string; currency: string; soldOut: boolean }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function addToBasket() {
    setBusy(true); setNotice("");
    try {
      await pulse.track(
        async () => {
          let cartId = window.localStorage.getItem("bazion-commerce-cart");
          if (cartId) {
            const saved = await fetch(`/v1/carts/${cartId}`, { credentials: "include", cache: "no-store" });
            if (!saved.ok) { cartId = null; window.localStorage.removeItem("bazion-commerce-cart"); }
            else {
              const cart = await saved.json() as { currency: string; status: string; items: Array<unknown> };
              if (cart.status !== "open") cartId = null;
              else if (cart.currency !== currency && cart.items.length > 0) throw new Error(`Your basket uses ${cart.currency}. Finish or empty it before adding this ${currency} item.`);
              if (cartId && cart.currency !== currency) cartId = null;
            }
          }
          if (!cartId) {
            const created = await fetch("/v1/carts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ currency }) });
            if (!created.ok) throw new Error("A basket could not be started for this currency.");
            cartId = (await created.json() as { id: string }).id;
            window.localStorage.setItem("bazion-commerce-cart", cartId);
          }
          const added = await fetch(`/v1/carts/${cartId}/items`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, quantity: 1 }) });
          const result = await added.json().catch(() => null) as { error?: string; message?: string } | null;
          if (!added.ok) throw new Error(result?.message ?? result?.error ?? "This item could not be added.");
        },
        {
          pending: `Adding ${productName} to basket…`,
          success: `${productName} added to basket`,
          group: `basket:add:${productId}`,
        },
      );
      setNotice(`${productName} added to your basket.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "This item could not be added."); }
    finally { setBusy(false); }
  }

  return <div className="product-purchase"><button className="store-checkout-button" type="button" disabled={busy || soldOut} onClick={() => void addToBasket()}>{soldOut ? "Currently unavailable" : busy ? "Adding to basket…" : "Add to basket"}</button>{notice && <p className="store-notice" role="status">{notice}</p>}</div>;
}
