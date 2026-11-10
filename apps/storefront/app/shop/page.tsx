import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchTenantPublicData } from "../../lib/server-tenant-api";
import { ShopStorefront } from "./shop-storefront";
import "./shop.css";

type Currency = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";
type Store = {
  storeName: string; tagline: string; supportEmail: string; isHomePage: boolean; locale: string; defaultCountryCode: string; defaultCurrency: Currency;
  supportedCurrencies: Currency[]; shippingRates: Partial<Record<Currency, number>>; shippingCountries: string[];
  paymentProvider: "mpesa" | "mock";
};
type Product = {
  id: string; sku: string; slug: string; name: string; description: string | null; category: string;
  imageUrl: string | null; imageAlt: string | null; featured: boolean; compareAtPriceMinor: number | null;
  currency: Currency; priceMinor: number; stockAvailable: number | null;
};

const fallbackStore: Store = {
  storeName: "Our Store", tagline: "Thoughtfully selected for you.", supportEmail: "", isHomePage: false, locale: "en-KE", defaultCountryCode: "KE",
  defaultCurrency: "KES", supportedCurrencies: ["KES"], shippingRates: { KES: 0 }, shippingCountries: [], paymentProvider: "mock",
};

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchTenantPublicData<{ store?: Store }>("/v1/storefront");
  const name = data?.store?.storeName || fallbackStore.storeName;
  return { title: `Shop | ${name}`, description: data?.store?.tagline || "Explore a considered collection from our store." };
}

export default async function ShopPage() {
  const response = await fetchTenantPublicData<{ store: Omit<Store, "paymentProvider">; paymentProvider: Store["paymentProvider"] }>("/v1/storefront");
  if (!response?.store) notFound();
  const store = { ...fallbackStore, ...response.store, paymentProvider: response.paymentProvider };
  const currency = store.paymentProvider === "mpesa" ? "KES" : store.defaultCurrency;
  const productResponse = await fetchTenantPublicData<{ items: Product[]; categories: string[]; total: number }>(
    `/v1/products?limit=100&sort=featured&currency=${encodeURIComponent(currency)}`,
  );
  return <ShopStorefront initialProducts={productResponse?.items ?? []} categories={productResponse?.categories ?? []} store={store} homeHref="/" />;
}
