"use client";

import { useEffect } from "react";

import { canUseAnalytics } from "@/lib/analytics";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";
const EEA_REGIONS = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
];

export default function GTMTag() {
  useEffect(() => {
    if (!GTM_ID) return;
    const w = window as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    const dataLayer = (w.dataLayer = w.dataLayer || []);
    w.gtag = (...args: unknown[]) => {
      dataLayer.push(args);
    };

    w.gtag("consent", "default", {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    w.gtag("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      region: EEA_REGIONS,
    });
    dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    script.setAttribute("data-smokeify-gtm", GTM_ID);
    document.head.appendChild(script);

    const update = () => {
      const granted = canUseAnalytics();
      const consentState = {
        ad_storage: granted ? "granted" : "denied",
        analytics_storage: granted ? "granted" : "denied",
        ad_user_data: granted ? "granted" : "denied",
        ad_personalization: granted ? "granted" : "denied",
      };
      dataLayer.push(["consent", "update", consentState]);

      if (typeof w.gtag === "function") {
        w.gtag("consent", "update", consentState);
      }
    };
    update();
    window.addEventListener("cookie-consent-accepted", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cookie-consent-accepted", update);
      window.removeEventListener("storage", update);
      script.remove();
    };
  }, []);

  if (!GTM_ID) return null;

  return (
    <>
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
