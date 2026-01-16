import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const toUrl = (path: string) => `${siteUrl}${path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  return [
    { url: toUrl("/"), lastModified: now },
    { url: toUrl("/products"), lastModified: now },
    { url: toUrl("/wishlist"), lastModified: now },
    { url: toUrl("/customizer"), lastModified: now },
    { url: toUrl("/pages/contact"), lastModified: now },
    { url: toUrl("/pages/shipping"), lastModified: now },
    { url: toUrl("/returns"), lastModified: now },
    { url: toUrl("/pages/agb"), lastModified: now },
    { url: toUrl("/pages/privacy"), lastModified: now },
    { url: toUrl("/pages/refund"), lastModified: now },
    { url: toUrl("/pages/return"), lastModified: now },
    { url: toUrl("/pages/imprint"), lastModified: now },
    { url: toUrl("/pages/faq"), lastModified: now },
  ];
}
