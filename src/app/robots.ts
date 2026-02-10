import type { MetadataRoute } from "next";

const rawSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

const siteUrl = (() => {
  try {
    const url = new URL(rawSiteUrl);
    if (url.hostname === "smokeify.de") {
      url.hostname = "www.smokeify.de";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return rawSiteUrl;
  }
})();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/account/",
          "/cart",
          "/order",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
