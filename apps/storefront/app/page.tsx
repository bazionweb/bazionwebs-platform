import type { Metadata } from "next";
import ChurchHomePage from "./church-home";
import { fetchTenantPublicData } from "../lib/server-tenant-api";
import { ShopStorefront } from "./shop/shop-storefront";
import "./shop/shop.css";

type Currency = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";
type Store = {
  storeName: string; tagline: string; supportEmail: string; isHomePage: boolean; locale: string; defaultCountryCode: string;
  defaultCurrency: Currency; supportedCurrencies: Currency[];
  shippingRates: Partial<Record<Currency, number>>; shippingCountries: string[];
  paymentProvider: "mpesa" | "mock";
};
type Product = {
  id: string; sku: string; slug: string; name: string; description: string | null; category: string;
  imageUrl: string | null; imageAlt: string | null; featured: boolean; compareAtPriceMinor: number | null;
  currency: Currency; priceMinor: number; stockAvailable: number | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const response = await fetchTenantPublicData<{ store: Store }>("/v1/storefront");
  if (response?.store?.isHomePage) return { title: response.store.storeName, description: response.store.tagline };
  return {};
}

export default async function HomePage() {
  const response = await fetchTenantPublicData<{ store: Omit<Store, "paymentProvider">; paymentProvider: Store["paymentProvider"] }>("/v1/storefront");
  if (!response?.store?.isHomePage) return <ChurchHomePage />;
  const store = { ...response.store, paymentProvider: response.paymentProvider };
  const catalog = await fetchTenantPublicData<{ items: Product[]; categories: string[] }>(
    `/v1/products?limit=100&sort=featured&currency=${encodeURIComponent(store.paymentProvider === "mpesa" ? "KES" : store.defaultCurrency)}`,
  );
  return <ShopStorefront initialProducts={catalog?.items ?? []} categories={catalog?.categories ?? []} store={store} homeHref="/" />;
}
