import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSmePageMetadata } from "@bazion/sme-website-template";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";
import { getPublicTenantWebsiteConfig } from "../../lib/server-website-config";

interface CatchAllPageProps {
  params: Promise<{ path: string[] }>;
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
  const { path } = await params;
  const pathname = `/${path.join("/")}`;
  const website = await getPublicTenantWebsiteConfig();
  if (!website || website.packageId === "church-ministry") return {};

  const page = website.smeConfig.website.pages.find((candidate) => candidate.path === pathname);
  if (!page?.enabled) return { title: "Page not available", robots: { index: false, follow: false } };
  const metadata = getSmePageMetadata(website.smeConfig, page.id);
  return { title: metadata.title, description: metadata.description, robots: metadata.noindex ? { index: false, follow: false } : undefined };
}

export default async function ConfiguredCatchAllPage({ params }: CatchAllPageProps) {
  const { path } = await params;
  if (path.length === 0) notFound();
  const page = await renderConfiguredTemplatePage(`/${path.join("/")}`);
  if (!page) notFound();
  return page;
}
