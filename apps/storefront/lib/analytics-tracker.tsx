"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    try {
      fetch("/v1/public/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "page_view",
          path: pathname,
          properties: {
            referrer: document.referrer || undefined,
            title: document.title || undefined,
          },
        }),
      }).catch(() => {
        // Analytics failure should never disrupt UX
      });
    } catch {
      // Ignore
    }
  }, [pathname]);

  return null;
}
