import { SiteNavigation, type SiteNavigationLink } from "./site-navigation.js";

export type NavLinkItem = SiteNavigationLink;

export interface ChurchNavProps {
  ministryName: string;
  logoUrl?: string;
  currentPath?: string;
  links?: NavLinkItem[];
  giveHref?: string | null;
  giveLabel?: string;
}

const DEFAULT_LINKS: NavLinkItem[] = [
  { label: "Home", href: "/" },
  { label: "Visit", href: "/visit" },
  { label: "Ministries", href: "/ministries" },
  { label: "About", href: "/about" },
  { label: "Sermons", href: "/sermons" },
  { label: "Events", href: "/events" },
  { label: "Contact", href: "/contact" },
];

/** Maps Church/Ministry-specific language and giving into the shared site navigation. */
export function ChurchNav({
  ministryName,
  logoUrl,
  currentPath = "/",
  links = DEFAULT_LINKS,
  giveHref = "/give",
  giveLabel = "Give to the Mission",
}: ChurchNavProps) {
  return (
    <SiteNavigation
      brandName={ministryName}
      {...(logoUrl ? { logoUrl } : {})}
      currentPath={currentPath}
      links={links}
      primaryAction={giveHref === null ? null : { href: giveHref, label: giveLabel }}
    />
  );
}
