"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMinistrySite } from "../../lib/use-ministry-site";

function splitBrandName(ministryName: string): { top: string; bottom: string } {
  const normalized = ministryName.trim();
  if (/^global mission\s+for christ international$/i.test(normalized)) {
    return { top: "Global Mission", bottom: "For Christ International" };
  }
  const words = normalized.split(/\s+/);
  if (words.length >= 3) {
    const splitAt = Math.ceil(words.length / 2);
    return {
      top: words.slice(0, splitAt).join(" "),
      bottom: words.slice(splitAt).join(" "),
    };
  }
  return { top: normalized, bottom: "" };
}

export function Navbar({ currentPath }: { currentPath?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const detectedPathname = usePathname() || "/";
  const pathname = currentPath ?? detectedPathname;
  const site = useMinistrySite();

  const baseNav = [...site.navigation];
  const hasMinistriesData =
    site.ministries.length > 0 ||
    (site.departments?.length ?? 0) > 0 ||
    (site.groups?.length ?? 0) > 0 ||
    (site.volunteerTeams?.length ?? 0) > 0;
  const hasVisitData = site.serviceTimes.length > 0 || site.locations.length > 0;

  if (
    hasMinistriesData &&
    site.pages.some((p) => p.id === "ministries" && p.enabled) &&
    !baseNav.some((item) => item.href === "/ministries")
  ) {
    baseNav.splice(Math.min(2, baseNav.length), 0, {
      id: "ministries",
      label: "Ministries",
      href: "/ministries",
    });
  }
  if (
    hasVisitData &&
    site.pages.some((p) => p.id === "visit" && p.enabled) &&
    !baseNav.some((item) => item.href === "/visit")
  ) {
    baseNav.splice(Math.min(2, baseNav.length), 0, {
      id: "visit",
      label: "Visit",
      href: "/visit",
    });
  }

  const giveEnabled = site.pages.some((page) => page.id === "giving" && page.enabled);
  const brand = splitBrandName(site.ministryName);

  return (
    <header className="gmfci-site-header">
      <div className="gmfci-header-inner">
        <Link href="/" className="gmfci-logo-link" onClick={() => setMenuOpen(false)}>
          {site.branding.logoUrl && (
            <img
              src={site.branding.logoUrl}
              alt={site.ministryName}
              width={48}
              height={48}
              className="gmfci-logo-img"
            />
          )}
          <div id="gmfci-site-brand">
            <span className="gmfci-brand-top">{brand.top}</span>
            {brand.bottom && <span className="gmfci-brand-bottom">{brand.bottom}</span>}
          </div>
        </Link>

        <span className="gmfci-nav-separator" aria-hidden="true" />

        <nav aria-label="Main navigation">
          <span id="nav-label" hidden>
            Main navigation
          </span>
          <ul className={`gmfci-main-nav${menuOpen ? " open" : ""}`}>
            {baseNav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <li key={item.href} className={active ? "active" : ""}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {giveEnabled && (
              <li className="nav-give">
                <Link href="/give" onClick={() => setMenuOpen(false)}>
                  Give
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <button
          type="button"
          className="gmfci-hamburger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export default Navbar;

