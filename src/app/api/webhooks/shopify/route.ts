import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getProductByHandle } from "@/lib/shopify";

type ShopifyWebhookVariant = {
  title?: string;
  inventory_quantity?: number | null;
  inventory_management?: string | null;
  available?: boolean;
  admin_graphql_api_id?: string;
};

type ShopifyWebhookProduct = {
  title?: string;
  handle?: string;
  variants?: ShopifyWebhookVariant[];
};

function isValidShopifyHmac(rawBody: string, hmacHeader: string, secret: string) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const digestBuffer = Buffer.from(digest, "utf8");
  const headerBuffer = Buffer.from(hmacHeader, "utf8");
  if (digestBuffer.length !== headerBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

function isVariantAvailable(variant: ShopifyWebhookVariant) {
  if (typeof variant.available === "boolean") {
    return variant.available;
  }
  if (variant.inventory_management == null) {
    return true;
  }
  if (typeof variant.inventory_quantity === "number") {
    return variant.inventory_quantity > 0;
  }
  return false;
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader) {
    return NextResponse.json({ error: "Missing HMAC header" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (!isValidShopifyHmac(rawBody, hmacHeader, secret)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  let payload: ShopifyWebhookProduct | null = null;
  try {
    payload = JSON.parse(rawBody) as ShopifyWebhookProduct;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: true });
  }

  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  let availableVariantIds = variants
    .filter(isVariantAvailable)
    .map((variant) => variant.admin_graphql_api_id)
    .filter((id): id is string => Boolean(id));

  if (availableVariantIds.length === 0 && payload.handle) {
    try {
      const product = await getProductByHandle(payload.handle);
      availableVariantIds =
        product?.variants
          ?.filter((variant) => variant.availableForSale)
          .map((variant) => variant.id) ?? [];
    } catch {
      availableVariantIds = [];
    }
  }

  if (availableVariantIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const pending = await prisma.backInStockRequest.findMany({
    where: {
      notifiedAt: null,
      variantId: { in: availableVariantIds },
    },
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || "";
  const errors: string[] = [];

  for (const requestItem of pending) {
    const variantPayload = variants.find(
      (variant) => variant.admin_graphql_api_id === requestItem.variantId
    );
    const title = requestItem.productTitle || payload.title || "Dein Artikel";
    const variantTitle = requestItem.variantTitle || variantPayload?.title || "";
    const variantLabel = variantTitle ? ` (${variantTitle})` : "";
    const productUrl =
      payload.handle && storeDomain
        ? `https://${storeDomain}/products/${payload.handle}`
        : "";

    const subject = "Artikel wieder verfugbar";
    const lines = [
      `${title}${variantLabel} ist wieder verfugbar.`,
      productUrl ? `Link: ${productUrl}` : "",
      "",
      "Vielen Dank fur deine Geduld.",
    ].filter(Boolean);

    try {
      await sendResendEmail({
        to: requestItem.email,
        subject,
        text: lines.join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p><strong>${title}${variantLabel}</strong> ist wieder verfugbar.</p>
            ${
              productUrl
                ? `<p><a href="${productUrl}">Zum Produkt</a></p>`
                : ""
            }
            <p>Vielen Dank fur deine Geduld.</p>
          </div>
        `,
      });

      await prisma.backInStockRequest.update({
        where: { id: requestItem.id },
        data: { notifiedAt: new Date() },
      });
    } catch (error) {
      errors.push(requestItem.id);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Failed to notify all requests" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
