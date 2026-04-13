import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildRefundRequestEmail } from "@/lib/refundRequestEmail";
import { buildRefundRequestUrl } from "@/lib/refundRequestLink";
import { buildOrderViewUrl } from "@/lib/orderViewLink";
import {
  getStorefrontOrigin,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";

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

export async function sendAdminOrderEmailById(input: {
  orderId: string;
  type: AdminOrderEmailType;
  requestOrigin: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
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
  const recipient = input.order.customerEmail?.trim();
  if (!recipient) {
    throw new Error("Order has no customer email");
  }

  const storefront = resolveStorefrontEmailBrand(
    parseStorefront(input.order.sourceStorefront ?? null),
    [input.order.sourceOrigin, input.order.sourceHost, input.requestOrigin],
  );
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
          { storefront, fallbackOrigin: origin },
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
