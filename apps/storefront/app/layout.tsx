import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Outfit, Fraunces } from "next/font/google";
import "./globals.css";
import "./recovery.css";
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
import "@bazion/ui/church.css";
import "@bazion/ui/pulse.css";
import { PulseHost } from "@bazion/ui";
import { SiteThemeProvider } from "../lib/site-theme-provider";
import { fetchTenantPublicData, getTenantRequestContext } from "../lib/server-tenant-api";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

interface PublicSiteMetadataResponse {
  tenant?: { name?: string | null } | null;
  profile?: { ministryName?: string | null; description?: string | null } | null;
  siteSettings?: { metadata?: { title?: string; description?: string }; branding?: { heroImageUrl?: string } } | null;
}

export async function generateMetadata(): Promise<Metadata> {
  const [site, tenantContext] = await Promise.all([
    fetchTenantPublicData<PublicSiteMetadataResponse>("/v1/public/church/site"),
    getTenantRequestContext(),
  ]);
  const ministryName = site?.profile?.ministryName?.trim() || site?.tenant?.name?.trim() || "Church & Ministry";
  const title = site?.siteSettings?.metadata?.title?.trim() || ministryName;
  const description = (site?.siteSettings?.metadata?.description?.trim() ||
    site?.profile?.description?.trim() || "Service information, community, events, sermons and giving.").slice(0, 320);
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
        <SiteThemeProvider>{children}</SiteThemeProvider>
        <PulseHost position="top-right" />
      </body>
    </html>
  );
}
