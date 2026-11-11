"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSidebar({
  userEmail,
  userName,
  platformRole,
}: {
  userEmail?: string;
  userName?: string;
  platformRole?: string;
}) {
  const pathname = usePathname();

  async function handleSignOut() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } finally {
      window.location.assign("/login");
    }
  }

  const navItems = [
    {
      href: "/",
      label: "Overview & Workspaces",
      icon: "◫",
      isActive: pathname === "/" || pathname.startsWith("/tenants"),
    },
    {
      href: "/modules",
      label: "Modules Catalogue",
      icon: "🧩",
      isActive: pathname.startsWith("/modules"),
    },
    {
      href: "/system",
      label: "System & Health",
      icon: "⚡",
      isActive: pathname.startsWith("/system"),
    },
    {
      href: "/troubleshoot",
      label: "Troubleshooting Hub",
      icon: "🛠️",
      isActive: pathname.startsWith("/troubleshoot"),
    },
    {
      href: "/audit",
      label: "Audit & Logs",
      icon: "📜",
      isActive: pathname.startsWith("/audit"),
    },
  ];

  const initial = (userName || userEmail || "A").charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <Link className="wordmark" href="/">
        BAZION<span> / CONTROL</span>
      </Link>

      <p className="side-label">PLATFORM CONTROL</p>
      <nav className="side-nav" aria-label="Platform navigation">
        {navItems.map((item) => (
          <Link
            key={item.href}
            className={`side-link ${item.isActive ? "selected" : ""}`}
            href={item.href}
          >
            <span className="side-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="side-quick-links">
        <p className="side-label" style={{ marginTop: "24px" }}>QUICK ACCESS</p>
        <a
          className="side-link side-link-subtle"
          href="http://localhost:3100"
          target="_blank"
          rel="noreferrer"
        >
          <span className="side-icon">↗</span>
          <span>Client Storefront</span>
        </a>
        <a
          className="side-link side-link-subtle"
          href="http://localhost:3100/admin"
          target="_blank"
          rel="noreferrer"
        >
          <span className="side-icon">↗</span>
          <span>GMFC Church Desk</span>
        </a>
      </div>

      <div className="side-bottom">
        <span className="avatar">{initial}</span>
        <div className="side-user-meta">
          <strong>{userName || "Platform Operator"}</strong>
          <small>{userEmail || "Secure control plane"}</small>
          {platformRole && <span className="side-role-pill">{platformRole}</span>}
        </div>
        <button
          type="button"
          className="side-signout-btn"
          title="Sign out of platform"
          onClick={handleSignOut}
        >
          ⎋
        </button>
      </div>
    </aside>
  );
}

