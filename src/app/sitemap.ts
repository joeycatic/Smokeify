import type { MetadataRoute } from "next";
import { seoPages } from "@/lib/seoPages";
import { getProductHandlesForSitemap } from "@/lib/catalog";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const toUrl = (path: string) => `${siteUrl}${path}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const productHandles = await getProductHandlesForSitemap();
  const productUrls = productHandles.map((handle) => ({
    url: toUrl(`/products/${handle}`),
    lastModified: now,
  }));
  return [
    { url: toUrl("/"), lastModified: now },
    { url: toUrl("/products"), lastModified: now },
    ...seoPages.map((page) => ({
      url: toUrl(`/${page.slugParts.join("/")}`),
      lastModified: now,
    })),
    ...productUrls,
  ];
}
