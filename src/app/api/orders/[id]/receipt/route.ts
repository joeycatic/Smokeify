import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyReceiptToken } from "@/lib/receiptLink";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      stripePaymentIntent: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const isAdmin = session?.user?.role === "ADMIN";
  const viewerUserId = session?.user?.id ?? null;
  const isOwner = Boolean(viewerUserId) && order.userId === viewerUserId;
  if (!isAdmin && !isOwner) {
    const expiresAt = Number(request.nextUrl.searchParams.get("expires"));
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const hasValidToken = verifyReceiptToken(order.id, expiresAt, token);
    if (!hasValidToken) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (!order.stripePaymentIntent) {
    return NextResponse.json({ error: "Receipt unavailable" }, { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntent, {
    expand: ["latest_charge"],
  });
  const charge =
    typeof intent.latest_charge === "string" ? null : intent.latest_charge;
  const receiptUrl = charge?.receipt_url;
  if (!receiptUrl) {
    return NextResponse.json({ error: "Receipt unavailable" }, { status: 404 });
  }

  return NextResponse.redirect(receiptUrl);
}
