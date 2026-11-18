import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./recovery.css";
import "./font-fallbacks.css";
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
import "@bazion/ui/church.css";
import "@bazion/ui/pulse.css";
import "@bazion/sme-website-template/theme.css";
import "../styles/gmfc/index.css";
import { PulseHost } from "@bazion/ui";
import { SiteThemeProvider } from "../lib/site-theme-provider";
import { ResponsiveImageProvider } from "@bazion/ui";
import { AnalyticsTracker } from "../lib/analytics-tracker";
import {
  fetchTenantPublicData,
  getTenantRequestContext,
} from "../lib/server-tenant-api";

const plusJakartaSans = localFont({
  src: "../../../packages/ui/assets/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-plus-jakarta",
  weight: "200 800",
  display: "swap",
});

const inter = localFont({
  src: "../../../packages/ui/assets/fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const outfit = localFont({
  src: "../../../packages/ui/assets/fonts/outfit-latin.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const fraunces = localFont({
  src: [
    {
      path: "../../../packages/ui/assets/fonts/fraunces-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../../packages/ui/assets/fonts/fraunces-latin-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});

interface PublicSiteMetadataResponse {
  tenant?: { name?: string | null } | null;
  profile?: {
    ministryName?: string | null;
    description?: string | null;
  } | null;
  siteSettings?: {
    metadata?: { title?: string; description?: string };
    branding?: { heroImageUrl?: string };
  } | null;
}

export async function generateMetadata(): Promise<Metadata> {
  const [site, tenantContext] = await Promise.all([
    fetchTenantPublicData<PublicSiteMetadataResponse>("/v1/public/church/site"),
    getTenantRequestContext(),
  ]);
  const ministryName =
    site?.profile?.ministryName?.trim() ||
    site?.tenant?.name?.trim() ||
    "Church & Ministry";
  const title = site?.siteSettings?.metadata?.title?.trim() || ministryName;
  const description = (
    site?.siteSettings?.metadata?.description?.trim() ||
    site?.profile?.description?.trim() ||
    "Service information, community, events, sermons and giving."
  ).slice(0, 320);
  const image = site?.siteSettings?.branding?.heroImageUrl;

  return {
    title: { default: title, template: `%s | ${title}` },
    description,
    ...(tenantContext ? { metadataBase: new URL(tenantContext.origin) } : {}),
    openGraph: {
      type: "website",
      siteName: ministryName,
      title,
      description,
      ...(tenantContext ? { url: tenantContext.origin } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${inter.variable} ${outfit.variable} ${fraunces.variable}`}
    >
      <body>
        <AnalyticsTracker />
        <ResponsiveImageProvider
          publicMediaBaseUrl={process.env.MEDIA_STORAGE_PUBLIC_BASE_URL ?? ""}
          imageTransformsEnabled={
            process.env.MEDIA_IMAGE_TRANSFORMS_ENABLED === "true"
          }
          siteImageTransformsEnabled={
            process.env.SITE_IMAGE_TRANSFORMS_ENABLED === "true"
          }
        >
          <SiteThemeProvider>{children}</SiteThemeProvider>
        </ResponsiveImageProvider>
        <PulseHost position="top-right" />
      </body>
    </html>
  );
}
