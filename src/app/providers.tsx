"use client";

import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";
import AnalyticsSessionTracker from "@/components/AnalyticsSessionTracker";
import WebVitalsReporter from "@/components/WebVitalsReporter";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <WebVitalsReporter />
      <GTMTag />
      <AnalyticsSessionTracker />
      <CookieConsent />
    </>
  );
}
