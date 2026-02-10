import type { MetadataRoute } from "next";
import { seoPages } from "@/lib/seoPages";
import { prisma } from "@/lib/prisma";

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

const toUrl = (path: string) => `${siteUrl}${path}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { handle: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
  const productUrls = products.map((product) => ({
    url: toUrl(`/products/${product.handle}`),
    lastModified: product.updatedAt,
  }));
  return [
    { url: toUrl("/"), lastModified: now },
    { url: toUrl("/products"), lastModified: now },
    { url: toUrl("/customizer"), lastModified: now },
    { url: toUrl("/bestseller"), lastModified: now },
    { url: toUrl("/neuheiten"), lastModified: now },
    ...seoPages.map((page) => ({
      url: toUrl(`/${page.slugParts.join("/")}`),
      lastModified: now,
    })),
    ...productUrls,
  ];
}
