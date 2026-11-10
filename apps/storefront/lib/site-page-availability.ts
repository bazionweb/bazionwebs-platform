import type { WebsitePage } from "@bazion/church-ministry-contracts";

/** Matches concrete and nested routes to the most specific configured website page. */
export function getWebsitePageForRoute(pages: readonly WebsitePage[], pathname: string): WebsitePage | undefined {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return pages
    .filter((page) => page.path === normalizedPath || (page.path !== "/" && normalizedPath.startsWith(`${page.path}/`)))
    .sort((left, right) => right.path.length - left.path.length)[0];
}
