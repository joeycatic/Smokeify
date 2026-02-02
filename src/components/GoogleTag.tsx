"use client";

import { useEffect } from "react";
import Script from "next/script";

import { canUseAnalytics } from "@/lib/gtag";

export default function GoogleTag() {
  const googleTagId = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID;
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

  useEffect(() => {
    if (!googleTagId && !googleAdsId) return;
    const handler = () => {
      const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag !== "function") return;
      const granted = canUseAnalytics();
      gtag("consent", "update", {
        ad_storage: granted ? "granted" : "denied",
        analytics_storage: granted ? "granted" : "denied",
        ad_user_data: granted ? "granted" : "denied",
        ad_personalization: granted ? "granted" : "denied",
      });
    };
    handler();
    window.addEventListener("cookie-consent-accepted", handler);
    window.addEventListener("age-gate-verified", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cookie-consent-accepted", handler);
      window.removeEventListener("age-gate-verified", handler);
      window.removeEventListener("storage", handler);
    };
  }, [googleAdsId, googleTagId]);

  if (!googleTagId && !googleAdsId) return null;

  const primaryId = googleTagId ?? googleAdsId;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag("js", new Date());
          gtag("consent", "default", {
            ad_storage: "denied",
            analytics_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
          });
          ${googleTagId ? `gtag("config", "${googleTagId}");` : ""}
          ${googleAdsId ? `gtag("config", "${googleAdsId}");` : ""}
        `}
      </Script>
    </>
  );
}
