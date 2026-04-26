"use client";

import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";
import AnalyticsSessionTracker from "@/components/AnalyticsSessionTracker";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import CommerceProviders from "@/components/CommerceProviders";
import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CommerceProviders>{children}</CommerceProviders>
      <WebVitalsReporter />
      <GTMTag />
      <AnalyticsSessionTracker />
      <CookieConsent />
    </SessionProvider>
  );
}
