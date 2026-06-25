import "server-only";

import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getStorefrontEmailBrand, getStorefrontLinks } from "@/lib/storefrontEmailBrand";

export async function notifyBackInStockForVariants(variantIds: string[]) {
  const ids = Array.from(new Set(variantIds.filter(Boolean)));
  if (ids.length === 0) return { requests: 0, sent: 0, failed: 0 };

  const availableVariants = await prisma.variant.findMany({
    where: {
      id: { in: ids },
      inventory: { quantityOnHand: { gt: 0 } },
    },
    select: { id: true },
  });
  const availableIds = availableVariants.map((variant) => variant.id);
  if (availableIds.length === 0) return { requests: 0, sent: 0, failed: 0 };

  const requests = await prisma.backInStockRequest.findMany({
    where: { variantId: { in: availableIds }, notifiedAt: null },
  });
  let sent = 0;
  let failed = 0;

  for (const request of requests) {
    const storefront = request.storefront ?? "GROW";
    const brand = getStorefrontEmailBrand(storefront);
    const links = getStorefrontLinks(storefront);
    const product = await prisma.product.findUnique({
      where: { id: request.productId },
      select: { handle: true, title: true },
    });
    const productTitle = request.productTitle || product?.title || "Dein Artikel";
    const variantTitle = request.variantTitle?.trim();
    const displayTitle = variantTitle ? `${productTitle} (${variantTitle})` : productTitle;
    const productUrl = product?.handle
      ? `${links.origin}/products/${product.handle}`
      : links.shopUrl;
    const html = `
      <div style="background:${brand.backgroundColor};padding:32px 16px;font-family:Arial,sans-serif;color:${brand.textColor}">
        <div style="max-width:600px;margin:auto;border-radius:18px;overflow:hidden;border:1px solid ${brand.cardBorderColor};background:${brand.cardBackgroundColor}">
          <div style="height:5px;background:${brand.accentColor}"></div>
          <div style="padding:34px">
            <div style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${brand.emphasisColor}">${brand.brandName} · Restock Signal</div>
            <h1 style="margin:16px 0 10px;font-size:28px;color:${brand.textColor}">Wieder verfügbar</h1>
            <p style="font-size:15px;line-height:1.7;color:${brand.mutedTextColor}"><strong>${displayTitle}</strong> ist wieder auf Lager.</p>
            <a href="${productUrl}" style="display:inline-block;margin-top:22px;padding:14px 22px;border-radius:12px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};font-weight:800;text-decoration:none">Artikel ansehen →</a>
          </div>
        </div>
      </div>`;
    try {
      await prisma.backInStockRequest.update({
        where: { id: request.id },
        data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastError: null },
      });
      await sendResendEmail({
        to: request.email,
        subject: `${displayTitle} ist wieder verfügbar`,
        html,
        text: `${displayTitle} ist wieder verfügbar.\n\n${productUrl}`,
      });
      await prisma.backInStockRequest.update({
        where: { id: request.id },
        data: { notifiedAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (error) {
      await prisma.backInStockRequest.update({
        where: { id: request.id },
        data: {
          lastError: error instanceof Error ? error.message : "Versand fehlgeschlagen",
          lastAttemptAt: new Date(),
        },
      });
      failed += 1;
    }
  }
  return { requests: requests.length, sent, failed };
}
