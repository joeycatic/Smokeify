import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildRefundRequestEmail } from "@/lib/refundRequestEmail";
import { buildRefundRequestUrl } from "@/lib/refundRequestLink";
import { buildReceiptUrl } from "@/lib/receiptLink";
import { buildOrderViewUrl } from "@/lib/orderViewLink";
import {
  getStorefrontOrigin,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";
import {
  parseStorefrontHostFromUrl,
  resolveStorefrontFromHost,
} from "@/lib/storefrontHosts";

export type AdminOrderEmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "refund_request";

export const buildOrderEmailSentAtUpdate = (type: AdminOrderEmailType) =>
  type === "confirmation"
    ? { confirmationEmailSentAt: new Date() }
    : type === "shipping"
      ? { shippingEmailSentAt: new Date() }
      : type === "refund"
        ? { refundEmailSentAt: new Date() }
        : { refundRequestEmailSentAt: new Date() };

const resolveAdminOrderEmailStorefront = (input: {
  sourceStorefront: string | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
  requestOrigin: string;
}) => {
  const originStorefront = resolveStorefrontFromHost(
    parseStorefrontHostFromUrl(input.sourceOrigin),
  );
  const hostStorefront = resolveStorefrontFromHost(input.sourceHost);
  const explicitStorefront = parseStorefront(input.sourceStorefront ?? null);

  if (originStorefront && originStorefront !== explicitStorefront) {
    return originStorefront;
  }

  if (!explicitStorefront && hostStorefront) {
    return hostStorefront;
  }

  return resolveStorefrontEmailBrand(explicitStorefront, [
    input.sourceOrigin,
    input.sourceHost,
    input.requestOrigin,
  ]);
};

export async function sendAdminOrderEmailById(input: {
  orderId: string;
  type: AdminOrderEmailType;
  requestOrigin: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!order) {
    throw new Error("Order not found");
  }

  return sendAdminOrderEmailForOrder({
    order,
    type: input.type,
    requestOrigin: input.requestOrigin,
  });
}

export async function sendAdminOrderEmailForOrder(input: {
  order: {
    id: string;
    userId: string | null;
    sourceStorefront: string | null;
    sourceHost: string | null;
    sourceOrigin: string | null;
    customerEmail: string | null;
    shippingName: string | null;
    user?: {
      email: string | null;
      name: string | null;
    } | null;
    createdAt: Date;
    currency: string;
    amountSubtotal: number;
    amountTax: number;
    amountShipping: number;
    amountDiscount: number;
    amountTotal: number;
    amountRefunded: number;
    discountCode: string | null;
    trackingCarrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    items: Array<{
      name: string;
      quantity: number;
      totalAmount: number;
      currency: string;
    }>;
  };
  type: AdminOrderEmailType;
  requestOrigin: string;
}) {
  const recipient =
    input.order.user?.email?.trim() || input.order.customerEmail?.trim() || "";
  if (!recipient) {
    throw new Error("Order has no customer email");
  }

  const storefront = resolveAdminOrderEmailStorefront({
    sourceStorefront: input.order.sourceStorefront,
    sourceHost: input.order.sourceHost,
    sourceOrigin: input.order.sourceOrigin,
    requestOrigin: input.requestOrigin,
  });
  const origin = getStorefrontOrigin(
    storefront,
    input.order.sourceOrigin ?? input.requestOrigin,
  );
  const guestOrderUrl = buildOrderViewUrl(origin, input.order.id);
  const orderUrl = input.order.userId
    ? `${origin}/account/orders/${input.order.id}`
    : guestOrderUrl ?? undefined;
  const invoiceUrl =
    input.type === "confirmation" ? buildInvoiceUrl(origin, input.order.id) : null;
  const receiptUrl =
    input.type === "confirmation" && storefront === "MAIN"
      ? buildReceiptUrl(origin, input.order.id)
      : null;

  const email =
    input.type === "refund_request"
      ? (() => {
          const refundRequestUrl = buildRefundRequestUrl(origin, input.order.id);
          if (!refundRequestUrl) {
            throw new Error("Refund request links are not configured.");
          }
          return buildRefundRequestEmail(
            {
              orderId: input.order.id,
              customerName: input.order.shippingName,
            },
            {
              storefront,
              fallbackOrigin: origin,
              refundRequestUrl,
            },
          );
        })()
      : buildOrderEmail(
          input.type,
          input.order,
          orderUrl,
          invoiceUrl ?? undefined,
          {
            storefront,
            fallbackOrigin: origin,
            receiptUrl: receiptUrl ?? undefined,
          },
        );

  await sendResendEmail({
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return {
    recipient,
    sentAtUpdate: buildOrderEmailSentAtUpdate(input.type),
  };
}
