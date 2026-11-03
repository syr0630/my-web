"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordPageView } from "@/lib/analytics/client";

/**
 * First-party page-view counter. Admin pages are deliberately excluded from
 * public traffic numbers.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const last = useRef<{ path: string; at: number }>({ path: "", at: 0 });

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const now = Date.now();
    if (last.current.path === pathname && now - last.current.at < 1500) {
      return;
    }
    last.current = { path: pathname, at: now };
    recordPageView(pathname);
  }, [pathname]);

  return null;
}