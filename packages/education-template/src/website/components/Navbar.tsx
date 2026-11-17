"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SchoolPortalConfig } from "@bazion/education-contracts";
import { useEducationTenant } from "../context/EducationTenantContext";

const navLinks = [
  { name: "Academics", href: "/academics" },
  { name: "Admissions", href: "/admissions" },
  {
    name: "Institutes",
    href: "/institutes",
    isDropdown: true,
    sublinks: [
      {
        name: "BEMI Training Institute",
        subtitle: "Kenya Registered Entity & Pan-Africa Hub",
        badge: "Africa Hub",
        href: "/institutes/bemi",
        icon: "🌍",
      },
      {
        name: "All BMI Institutes & Campuses",
        subtitle: "Collegiate network & institutional directory",
        badge: "Directory",
        href: "/institutes",
        icon: "🏛️",
      },
    ],
  },
  { name: "Accreditation", href: "/accreditation" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export interface NavbarProps {
  tenantConfig?: SchoolPortalConfig;
}

export default function Navbar({ tenantConfig }: NavbarProps = {}) {
  const config = useEducationTenant(tenantConfig);
  const isBmiDefault =
    config.shortName === "BMI University" ||
    config.institutionName === "Bethel Ministries International University";
  const brandTitle = isBmiDefault ? "BMI UNIVERSITY" : config.shortName.toUpperCase();
  const brandSubtitle = isBmiDefault
    ? "Bethel Ministries International"
    : config.legalEntityName || config.institutionName;
  const logoSrc =
    isBmiDefault && config.branding.logoUrl === "/images/bmi-logo.png"
      ? "/images/bmi-logo-2.png"
      : config.branding.logoUrl;
  const admissionsEmail = config.contact.admissionsEmail;
  const accreditationLabel =
    config.accreditationLabel || "QAHE Accredited Higher Education";
  const portalHref = config.portalPath || "/portal";

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [institutesDropdownOpen, setInstitutesDropdownOpen] = useState(false);
  const [mobileInstitutesOpen, setMobileInstitutesOpen] = useState(true);
  const dropdownTimeoutRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
    setInstitutesDropdownOpen(false);
  }, [pathname]);

  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setInstitutesDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setInstitutesDropdownOpen(false);
    }, 180);
  };

  return (
    <>
      <header
        role="banner"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          transition: "all 0.35s ease",
        }}
      >
        {/* ── Top Institutional Utility Bar ── */}
        <div
          style={{
            background: "linear-gradient(90deg, #1a0040 0%, #2d1060 100%)",
            borderBottom: "1px solid rgba(197, 160, 72, 0.2)",
            padding: "0.4rem 2rem",
            fontSize: "0.75rem",
            color: "rgba(255, 255, 255, 0.75)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="top-utility-bar"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                color: "var(--color-gold-light, #e5c578)",
                fontWeight: 700,
              }}
            >
              <span>✦</span> {accreditationLabel}
            </span>
            <span className="hide-mobile" style={{ color: "rgba(255,255,255,0.3)" }}>
              |
            </span>
            <span className="hide-mobile">{admissionsEmail}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            {isBmiDefault && (
              <>
                {/* Direct High-Visibility BEMI Institute Utility Link */}
                <Link
                  href="/institutes/bemi"
                  className="hide-mobile"
                  style={{
                    color: "#e5c578",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    transition: "color 0.2s",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#e5c578")}
                >
                  <span>🌍</span> BEMI Training Institute (Africa Hub)
                </Link>
                <span className="hide-mobile" style={{ color: "rgba(255,255,255,0.3)" }}>
                  |
                </span>
              </>
            )}

            <Link
              href="/verify"
              style={{
                color: "rgba(255,255,255,0.85)",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#c5a048")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
            >
              <span>🛡️</span> Verify Credentials
            </Link>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <a
              href={portalHref}
              style={{
                color: "var(--color-gold, #c5a048)",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <span>👤</span> Student Portal →
            </a>
          </div>
        </div>

        {/* ── Main Sticky Navigation Bar ── */}
        <div
          style={{
            height: "82px",
            background: scrolled
              ? "rgba(45, 16, 96, 0.98)"
              : "rgba(45, 16, 96, 0.93)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(197, 160, 72, 0.25)",
            boxShadow: scrolled ? "0 10px 30px rgba(26, 0, 64, 0.6)" : "none",
            transition: "all 0.35s ease",
          }}
          className="main-nav-bar"
        >
          <nav
            aria-label="Main navigation"
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "0 2rem",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              aria-label={`${config.shortName} — Home`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textDecoration: "none",
              }}
            >
              <img
                src={logoSrc}
                alt={`${config.shortName} Crest`}
                style={{
                  height: "58px",
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 900,
                    fontSize: "1.45rem",
                    color: "#ffffff",
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                  }}
                >
                  {brandTitle}
                </span>
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.58rem",
                    color: "var(--color-gold, #c5a048)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginTop: "4px",
                  }}
                >
                  {brandSubtitle}
                </span>
              </div>
            </Link>

            {/* ── Desktop Links ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "2.2rem" }} className="desktop-nav">
              <ul
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                {navLinks.map((link) => {
                  if (link.isDropdown) {
                    const isInstitutesActive = pathname.startsWith("/institutes") || pathname === "/bemi";
                    return (
                      <li
                        key={link.name}
                        style={{ position: "relative" }}
                        onMouseEnter={handleDropdownEnter}
                        onMouseLeave={handleDropdownLeave}
                      >
                        <button
                          type="button"
                          aria-expanded={institutesDropdownOpen}
                          aria-haspopup="true"
                          onClick={() => setInstitutesDropdownOpen(!institutesDropdownOpen)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "0.5rem 0.9rem",
                            borderRadius: "8px",
                            fontWeight: isInstitutesActive ? 800 : 600,
                            fontSize: "0.92rem",
                            color: isInstitutesActive ? "#e5c578" : "#ffffff",
                            position: "relative",
                            transition: "all 0.2s ease",
                            letterSpacing: "0.01em",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <span>{link.name}</span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              transition: "transform 0.2s ease",
                              transform: institutesDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                          >
                            ▼
                          </span>
                          {isInstitutesActive && (
                            <span
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                bottom: "-2px",
                                left: "0.9rem",
                                right: "0.9rem",
                                height: "2.5px",
                                borderRadius: "999px",
                                background: "linear-gradient(90deg, #c5a048, #e5c578)",
                                boxShadow: "0 0 8px rgba(229, 197, 120, 0.6)",
                              }}
                            />
                          )}
                        </button>

                        {/* ── Institutes Dropdown Menu ── */}
                        {institutesDropdownOpen && (
                          <div
                            role="menu"
                            aria-label="Institutes and campuses menu"
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              marginTop: "0.5rem",
                              width: "360px",
                              background: "rgba(26, 0, 64, 0.98)",
                              backdropFilter: "blur(20px)",
                              WebkitBackdropFilter: "blur(20px)",
                              border: "1px solid rgba(197, 160, 72, 0.35)",
                              borderRadius: "14px",
                              padding: "0.85rem",
                              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.6), 0 0 20px rgba(197, 160, 72, 0.15)",
                              zIndex: 1100,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "#e5c578",
                                textTransform: "uppercase",
                                letterSpacing: "0.14em",
                                fontWeight: 800,
                                padding: "0.4rem 0.6rem 0.6rem",
                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                marginBottom: "0.4rem",
                              }}
                            >
                              BMI Educational Network & Regional Hubs
                            </div>

                            {link.sublinks.map((sub) => {
                              const isSubActive = pathname === sub.href;
                              return (
                                <Link
                                  key={sub.name}
                                  href={sub.href}
                                  role="menuitem"
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "0.75rem",
                                    padding: "0.65rem 0.75rem",
                                    borderRadius: "10px",
                                    textDecoration: "none",
                                    background: isSubActive ? "rgba(197,160,72,0.18)" : "transparent",
                                    transition: "background 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSubActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSubActive) e.currentTarget.style.background = "transparent";
                                  }}
                                >
                                  <span style={{ fontSize: "1.3rem", lineHeight: 1, marginTop: "2px" }}>
                                    {sub.icon}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          fontSize: "0.92rem",
                                          color: isSubActive ? "#e5c578" : "#ffffff",
                                        }}
                                      >
                                        {sub.name}
                                      </span>
                                      <span
                                        style={{
                                          background: "rgba(197,160,72,0.2)",
                                          color: "#e5c578",
                                          fontSize: "0.65rem",
                                          padding: "0.15rem 0.45rem",
                                          borderRadius: "4px",
                                          fontWeight: 800,
                                        }}
                                      >
                                        {sub.badge}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "rgba(255,255,255,0.65)",
                                        lineHeight: 1.35,
                                        marginTop: "2px",
                                      }}
                                    >
                                      {sub.subtitle}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  }

                  const isActive = pathname === link.href;
                  return (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        aria-current={isActive ? "page" : undefined}
                        style={{
                          display: "inline-block",
                          padding: "0.5rem 0.9rem",
                          borderRadius: "8px",
                          fontWeight: isActive ? 800 : 600,
                          fontSize: "0.92rem",
                          color: isActive ? "#e5c578" : "#ffffff",
                          position: "relative",
                          transition: "all 0.2s ease",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {link.name}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              bottom: "-2px",
                              left: "0.9rem",
                              right: "0.9rem",
                              height: "2.5px",
                              borderRadius: "999px",
                              background: "linear-gradient(90deg, #c5a048, #e5c578)",
                              boxShadow: "0 0 8px rgba(229, 197, 120, 0.6)",
                            }}
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
                <Link
                  href="/apply"
                  className="btn btn-gold"
                  style={{ whiteSpace: "nowrap", fontSize: "0.88rem", padding: "0.65rem 1.4rem" }}
                >
                  Apply Today →
                </Link>
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=NTSHAE86BEUBN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-white"
                  style={{ whiteSpace: "nowrap", fontSize: "0.88rem", padding: "0.65rem 1.25rem" }}
                >
                  Give
                </a>
              </div>
            </div>

            {/* ── Mobile Hamburger ── */}
            <button
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{
                display: "none",
                flexDirection: "column",
                gap: "5px",
                padding: "8px",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderRadius: "8px",
              }}
              className="mobile-hamburger"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    display: "block",
                    width: "26px",
                    height: "2.5px",
                    borderRadius: "999px",
                    background: "#c5a048",
                    transition: "all 0.3s ease",
                    transform: mobileOpen
                      ? i === 0
                        ? "rotate(45deg) translate(5px, 5px)"
                        : i === 1
                        ? "scaleX(0)"
                        : "rotate(-45deg) translate(5px, -5px)"
                      : "none",
                    opacity: mobileOpen && i === 1 ? 0 : 1,
                  }}
                />
              ))}
            </button>
          </nav>
        </div>
      </header>

      {/* ── Mobile Backdrop Overlay ── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 998,
            transition: "opacity 0.3s ease",
          }}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer ── */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-label="Navigation menu"
        aria-modal={mobileOpen}
        style={{
          position: "fixed",
          top: "var(--mobile-drawer-top, 112px)",
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(26, 0, 64, 0.98) 0%, rgba(45, 16, 96, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "0.75rem",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: "1.5rem 1.25rem calc(2rem + env(safe-area-inset-bottom, 0px))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        className="mobile-drawer"
      >
        <ul
          style={{
            width: "100%",
            maxWidth: "380px",
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {navLinks.map((link) => {
            if (link.isDropdown) {
              const isInstitutesActive = pathname.startsWith("/institutes") || pathname === "/bemi";
              return (
                <li key={link.name}>
                  <div
                    style={{
                      borderRadius: "12px",
                      background: isInstitutesActive ? "rgba(197,160,72,0.15)" : "rgba(255,255,255,0.03)",
                      borderLeft: isInstitutesActive ? "4px solid #c5a048" : "4px solid transparent",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMobileInstitutesOpen(!mobileInstitutesOpen)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        minHeight: "48px",
                        padding: "0.85rem 1.25rem",
                        background: "transparent",
                        border: "none",
                        color: isInstitutesActive ? "#e5c578" : "rgba(255,255,255,0.92)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <span>{link.name}</span>
                      <span style={{ fontSize: "0.8rem", color: "#c5a048" }}>
                        {mobileInstitutesOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {mobileInstitutesOpen && (
                      <div
                        style={{
                          padding: "0 1rem 0.85rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
                        }}
                      >
                        {link.sublinks.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              onClick={() => setMobileOpen(false)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.6rem",
                                padding: "0.6rem 0.8rem",
                                borderRadius: "8px",
                                background: isSubActive ? "rgba(197,160,72,0.25)" : "rgba(255,255,255,0.05)",
                                color: isSubActive ? "#e5c578" : "#ffffff",
                                textDecoration: "none",
                                fontSize: "0.92rem",
                                fontWeight: 600,
                              }}
                            >
                              <span>{sub.icon}</span>
                              <span style={{ flex: 1 }}>{sub.name}</span>
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "#e5c578",
                                  background: "rgba(197,160,72,0.2)",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                }}
                              >
                                {sub.badge}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            }

            const isActive = pathname === link.href;
            return (
              <li key={link.name}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: "48px",
                    padding: "0.85rem 1.25rem",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: isActive ? "#e5c578" : "rgba(255,255,255,0.92)",
                    background: isActive ? "rgba(197,160,72,0.15)" : "rgba(255,255,255,0.03)",
                    borderLeft: isActive ? "4px solid #c5a048" : "4px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>{link.name}</span>
                  <span style={{ fontSize: "0.9rem", opacity: 0.6 }}>→</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            marginTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Link
            href="/apply"
            onClick={() => setMobileOpen(false)}
            className="btn btn-gold"
            style={{ width: "100%", fontSize: "1rem", minHeight: "48px" }}
          >
            Apply Today →
          </Link>
          <a
            href="/portal"
            className="btn btn-outline-white"
            style={{
              width: "100%",
              fontSize: "0.95rem",
              minHeight: "48px",
              textAlign: "center",
            }}
          >
            👤 Student Portal Login
          </a>
        </div>
      </div>

      {/* ── Responsive Styling ── */}
      <style>{`
        @media (max-width: 992px) {
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
          .mobile-drawer { display: flex !important; }
        }
        @media (min-width: 993px) {
          .mobile-drawer { display: none !important; }
        }
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
          .top-utility-bar {
            padding: 0.3rem 0.75rem !important;
            font-size: 0.67rem !important;
            min-height: 28px;
          }
          .main-nav-bar {
            height: 64px !important;
          }
          :root {
            --navbar-height: 92px;
            --mobile-drawer-top: 92px;
          }
        }
        @media (max-width: 400px) {
          .top-utility-bar { font-size: 0.62rem !important; }
        }
      `}</style>
    </>
  );
}
