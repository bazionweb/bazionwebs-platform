"use client";

import Link from "next/link";
import { useState } from "react";
import { PulseActivityButton, pulse } from "@bazion/ui";

export function AdminTopbar({
  title,
  userEmail,
  platformRole,
}: {
  title: string;
  userEmail?: string;
  platformRole?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await pulse.track(
        () =>
          fetch("/api/auth/sign-out", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: "{}",
          }),
        {
          title: "Signing out",
          pendingDetail: "Closing platform operator session…",
          successTitle: "Signed out",
          group: "admin:signout",
        },
      );
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-crumb">{title}</span>
      </div>

      <div className="topbar-right">
        <PulseActivityButton label="Activity" />
        {userEmail ? (
          <div className="topbar-user">
            <span className="topbar-status-dot" title="Authenticated session active"></span>
            <span className="topbar-user-email">{userEmail}</span>
            {platformRole && <span className="topbar-role-badge">{platformRole.replace("_", " ")}</span>}
            <button
              type="button"
              className="topbar-signout"
              disabled={signingOut}
              onClick={handleSignOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <Link href="/login" className="topbar-signin">
            Sign in / switch account ↗
          </Link>
        )}
      </div>
    </header>
  );
}

