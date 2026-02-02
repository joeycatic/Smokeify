"use client";

import { useEffect } from "react";
import Script from "next/script";

import { canUseAnalytics } from "@/lib/gtag";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export default function GTMTag() {
  useEffect(() => {
    if (!GTM_ID) return;
    const update = () => {
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
    update();
    window.addEventListener("cookie-consent-accepted", update);
    window.addEventListener("age-gate-verified", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cookie-consent-accepted", update);
      window.removeEventListener("age-gate-verified", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!GTM_ID) return null;

  return (
    <>
      <Script id="gtm-consent-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag("consent", "default", {
            ad_storage: "denied",
            analytics_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
          });
        `}
      </Script>
      <Script id="gtm-init" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
