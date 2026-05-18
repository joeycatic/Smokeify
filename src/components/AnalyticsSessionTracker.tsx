"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_HEARTBEAT_INTERVAL_MS,
  isTrackedAnalyticsPath,
} from "@/lib/analyticsShared";
import {
  canUseAnalytics,
  trackAnalyticsHeartbeat,
  trackAnalyticsPageView,
} from "@/lib/analytics";

const getCurrentConsent = () => canUseAnalytics();

export default function AnalyticsSessionTracker() {
  const pathname = usePathname() ?? "/";
  const [analyticsEnabled, setAnalyticsEnabled] = useState(getCurrentConsent);

  useEffect(() => {
    const update = () => setAnalyticsEnabled(getCurrentConsent());
    update();
    window.addEventListener("storage", update);
    window.addEventListener("cookie-consent-accepted", update);
    window.addEventListener("smokeify-cookie-consent-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("cookie-consent-accepted", update);
      window.removeEventListener("smokeify-cookie-consent-change", update);
    };
  }, []);

  useEffect(() => {
    if (!analyticsEnabled || !isTrackedAnalyticsPath(pathname)) return;
    trackAnalyticsPageView(pathname);
  }, [analyticsEnabled, pathname]);

  useEffect(() => {
    if (!analyticsEnabled || !isTrackedAnalyticsPath(pathname)) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      trackAnalyticsHeartbeat(pathname);
    };

    tick();
    const interval = window.setInterval(tick, ANALYTICS_HEARTBEAT_INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [analyticsEnabled, pathname]);

  return null;
}
