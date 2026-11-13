import type { Metadata } from "next";
import "./globals.css";
import "./recovery.css";
import "./font-fallbacks.css";
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
import "@bazion/ui/church.css";
import { SiteThemeProvider } from "../lib/site-theme-provider";
import { ResponsiveImageProvider } from "@bazion/ui";
import { fetchTenantPublicData, getTenantRequestContext } from "../lib/server-tenant-api";

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
    <html lang="en">
      <body>
        <ResponsiveImageProvider
          publicMediaBaseUrl={process.env.MEDIA_STORAGE_PUBLIC_BASE_URL ?? ""}
          imageTransformsEnabled={process.env.MEDIA_IMAGE_TRANSFORMS_ENABLED === "true"}
        >
          <SiteThemeProvider>{children}</SiteThemeProvider>
        </ResponsiveImageProvider>
      </body>
    </html>
  );
}
