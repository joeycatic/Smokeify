import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const formatPrice = (value: number, currency = "EUR") =>
  `${value.toFixed(2)} ${currency}`;

const resolveProductUrl = (handle: string) =>
  `${SITE_URL}/products/${handle}`;

const resolveImageUrl = (images: Array<{ url: string }>) => {
  const url = images[0]?.url ?? "";
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const buildItemId = (productHandle: string, variantId: string, sku?: string | null) => {
  const base = sku?.trim() || `${productHandle}-${variantId.slice(0, 8)}`;
  return base.length > 50 ? base.slice(0, 50) : base;
};

export async function GET() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true, options: true },
      },
      categories: {
        orderBy: { position: "asc" },
        include: { category: { include: { parent: true } } },
      },
    },
  });
  const now = new Date().toUTCString();

  const items = products
    .flatMap((product) => {
      const baseTitle = product.title;
      const description = escapeXml(
        stripHtml(product.description ?? product.shortDescription ?? "")
      );
      const link = escapeXml(resolveProductUrl(product.handle));
      const image = escapeXml(resolveImageUrl(product.images));
      const brandRaw = product.manufacturer ?? product.sellerName ?? "";
      const brand = escapeXml(brandRaw || "Smokeify");
      const condition = "new";
      const primaryCategory = product.categories[0]?.category;
      const categoryPath = primaryCategory
        ? primaryCategory.parent
          ? `${primaryCategory.parent.name} > ${primaryCategory.name}`
          : primaryCategory.name
        : "";
      const productType = categoryPath ? escapeXml(categoryPath) : "";
      const additionalImages = product.images
        .slice(1, 10)
        .map((img) => escapeXml(img.url))
        .filter(Boolean);

      return product.variants.map((variant) => {
        const available =
          (variant.inventory?.quantityOnHand ?? 0) -
          (variant.inventory?.reserved ?? 0);
        const isInStock = available > 0;
        const isPreorder = !isInStock && Boolean(product.leadTimeDays);
        const availability = isPreorder
          ? "preorder"
          : isInStock
            ? "in_stock"
            : "out_of_stock";
        const availabilityDate =
          isPreorder && product.leadTimeDays
            ? new Date(
                Date.now() + product.leadTimeDays * 24 * 60 * 60 * 1000
              ).toISOString()
            : null;
        const variantTitle =
          variant.title && !/default/i.test(variant.title)
            ? `${baseTitle} - ${variant.title}`
            : baseTitle;
        const price = escapeXml(formatPrice(variant.priceCents / 100));
        const sku = variant.sku?.trim() ?? "";
        const identifierExists = sku || brandRaw ? "yes" : "no";
        const itemId = buildItemId(product.handle, variant.id, sku);

        return [
          "<item>",
          `<g:id>${escapeXml(itemId)}</g:id>`,
          `<g:item_group_id>${escapeXml(product.id)}</g:item_group_id>`,
          `<title>${escapeXml(variantTitle)}</title>`,
          `<description>${description}</description>`,
          `<link>${link}</link>`,
          image ? `<g:image_link>${image}</g:image_link>` : "",
          ...additionalImages.map(
            (url) => `<g:additional_image_link>${url}</g:additional_image_link>`
          ),
          `<g:availability>${escapeXml(availability)}</g:availability>`,
          availabilityDate
            ? `<g:availability_date>${escapeXml(availabilityDate)}</g:availability_date>`
            : "",
          `<g:price>${price}</g:price>`,
          `<g:brand>${brand}</g:brand>`,
          sku ? `<g:mpn>${escapeXml(sku)}</g:mpn>` : "",
          productType ? `<g:product_type>${productType}</g:product_type>` : "",
          product.weightGrams
            ? `<g:shipping_weight>${escapeXml(
                (product.weightGrams / 1000).toFixed(2)
              )} kg</g:shipping_weight>`
            : "",
          `<g:condition>${escapeXml(condition)}</g:condition>`,
          `<g:identifier_exists>${identifierExists}</g:identifier_exists>`,
          "</item>",
        ]
          .filter(Boolean)
          .join("");
      });
    })
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">` +
    `<channel>` +
    `<title>Smokeify Product Feed</title>` +
    `<link>${escapeXml(SITE_URL)}</link>` +
    `<description>Google Merchant Center Feed</description>` +
    `<lastBuildDate>${now}</lastBuildDate>` +
    items +
    `</channel>` +
    `</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
