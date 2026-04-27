"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import CommerceProviders from "@/components/CommerceProviders";
import { SessionProvider } from "next-auth/react";

const CookieConsent = dynamic(() => import("@/components/CookieConsent"), {
  ssr: false,
});
const GTMTag = dynamic(() => import("@/components/GTMTag"), {
  ssr: false,
});
const AnalyticsSessionTracker = dynamic(
  () => import("@/components/AnalyticsSessionTracker"),
  { ssr: false },
);
const WebVitalsReporter = dynamic(() => import("@/components/WebVitalsReporter"), {
  ssr: false,
});

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enhancementsReady, setEnhancementsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(() => {
        setEnhancementsReady(true);
      }, { timeout: 1500 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = setTimeout(() => {
      setEnhancementsReady(true);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <SessionProvider>
      <CommerceProviders>{children}</CommerceProviders>
      <CookieConsent />
      {enhancementsReady ? <WebVitalsReporter /> : null}
      {enhancementsReady ? <GTMTag /> : null}
      {enhancementsReady ? <AnalyticsSessionTracker /> : null}
    </SessionProvider>
  );
}
