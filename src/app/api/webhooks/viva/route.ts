import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/sentry";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { createOrderFromVivaDraft } from "@/lib/vivaOrderFulfillment";
import {
  getVivaWebhookVerificationKey,
  normalizeVivaStatus,
  retrieveVivaTransaction,
  type VivaTransaction,
} from "@/lib/viva";
import {
  releaseLoyaltyHoldForPaymentOrder,
  releaseReservedInventoryForItems,
} from "@/lib/paymentCheckoutReservations";

export const runtime = "nodejs";

type VivaWebhookBody = {
  CorrelationId?: string;
  EventData?: VivaTransaction & {
    OrderCode?: string | number | null;
    StatusId?: string | null;
    TransactionId?: string | null;
  };
  EventTypeId?: number;
  MessageId?: string;
};

const getWebhookErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown Viva webhook failure";

const beginWebhookEvent = async (eventId: string, type: string) => {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        type,
        status: "processing",
        errorMessage: null,
        errorContext: Prisma.JsonNull,
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { eventId },
      });
      if (existing?.status === "failed") {
        await prisma.processedWebhookEvent.update({
          where: { eventId },
          data: {
            status: "processing",
            errorMessage: null,
            errorContext: Prisma.JsonNull,
          },
        });
        return true;
      }
      return false;
    }
    throw error;
  }
};

const finalizeWebhookEvent = async (eventId: string) => {
  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: {
      status: "processed",
      processedAt: new Date(),
      errorMessage: null,
      errorContext: Prisma.JsonNull,
    },
  });
};

const failWebhookEvent = async (
  eventId: string,
  error: unknown,
  context: Record<string, unknown>,
) => {
  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: {
      status: "failed",
      errorMessage: getWebhookErrorMessage(error),
      errorContext: context as Prisma.InputJsonValue,
    },
  });
};

const readDraftItemsForRelease = (value: Prisma.JsonValue) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { quantity: 0, variantId: null };
      }
      return {
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        variantId: typeof item.variantId === "string" ? item.variantId : null,
      };
    })
    .filter((item) => item.variantId && item.quantity > 0);
};

export async function GET() {
  try {
    const key = await getVivaWebhookVerificationKey();
    return NextResponse.json({ Key: key, key });
  } catch (error) {
    captureException(error, { context: "vivaWebhookVerification" });
    return NextResponse.json(
      { error: "Viva webhook verification key not configured." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VivaWebhookBody | null;
  const eventData = body?.EventData;
  const paymentOrderCode = String(eventData?.OrderCode ?? eventData?.orderCode ?? "").trim();
  const transactionId = String(
    eventData?.TransactionId ?? eventData?.transactionId ?? "",
  ).trim();
  const eventId =
    body?.MessageId ??
    body?.CorrelationId ??
    `${body?.EventTypeId ?? "viva"}:${paymentOrderCode}:${transactionId}`;

  if (!paymentOrderCode || !eventId) {
    return NextResponse.json(
      { error: "Missing Viva webhook identifiers." },
      { status: 400 },
    );
  }

  const shouldProcess = await beginWebhookEvent(
    eventId,
    `viva:${body?.EventTypeId ?? "unknown"}`,
  );
  if (!shouldProcess) {
    return NextResponse.json({ duplicate: true, received: true });
  }

  try {
    const draft = await prisma.checkoutPaymentDraft.findUnique({
      where: { paymentOrderCode },
    });
    if (!draft) {
      console.warn("[viva webhook] Draft not found.", { paymentOrderCode, transactionId });
      await finalizeWebhookEvent(eventId);
      return NextResponse.json({ missingDraft: true, received: true });
    }

    const transaction =
      transactionId && normalizeVivaStatus(eventData?.StatusId) === "paid"
        ? await retrieveVivaTransaction(transactionId).catch(() => ({
            ...eventData,
            orderCode: paymentOrderCode,
            statusId: eventData?.StatusId,
            transactionId,
          }))
        : ({
            ...eventData,
            orderCode: paymentOrderCode,
            statusId: eventData?.StatusId,
            transactionId: transactionId || undefined,
          } as VivaTransaction);
    const status = normalizeVivaStatus(transaction.statusId);

    if (status === "paid" || status === "refunded") {
      await createOrderFromVivaDraft({ draft, request, transaction });
    } else if (status === "failed") {
      await prisma.checkoutPaymentDraft.update({
        where: { paymentOrderCode },
        data: {
          paymentStatus: "failed",
          paymentTransactionId: transactionId || undefined,
          status: "failed",
        },
      });
      await releaseReservedInventoryForItems(
        readDraftItemsForRelease(draft.items),
        paymentOrderCode,
        { logMissingReservation: false },
      );
      await releaseLoyaltyHoldForPaymentOrder(paymentOrderCode);

      const order = await prisma.order.findFirst({
        where: { paymentOrderCode },
        select: { id: true, paymentStatus: true, status: true },
      });
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "failed", status: "failed" },
        });
        await logOrderTimelineEvent({
          orderId: order.id,
          action: "order.lifecycle.payment_failed",
          summary: "Payment failed (Viva Transaction Failed)",
          metadata: {
            paymentOrderCode,
            previousPaymentStatus: order.paymentStatus,
            previousStatus: order.status,
            source: "viva.webhook",
            transactionId,
          },
        });
      }
    }
  } catch (error) {
    captureException(error, { context: "vivaWebhook", eventId, paymentOrderCode });
    console.error("[viva webhook] Handler failed.", {
      error: error instanceof Error ? error.message : error,
      eventId,
      paymentOrderCode,
    });
    await failWebhookEvent(eventId, error, { paymentOrderCode, transactionId });
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }

  await finalizeWebhookEvent(eventId);
  return NextResponse.json({ received: true });
}
