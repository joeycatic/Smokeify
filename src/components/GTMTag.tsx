"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

import { canUseAnalytics } from "@/lib/gtag";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export default function GTMTag() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!GTM_ID) return;
    const update = () => {
      setEnabled(canUseAnalytics());
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

  if (!GTM_ID || !enabled) return null;

  return (
    <>
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
