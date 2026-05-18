import { NextResponse } from "next/server";

import {
  getDiscordBotAuthError,
  getOrderByLookup,
  parseBotCustomerId,
  serializeBotOrder,
} from "@/lib/discordBotOrders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const authError = getDiscordBotAuthError(request);
  if (authError) {
    return authError;
  }

  const customerId = parseBotCustomerId(request);
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }

  const { orderId } = await params;
  const order = await getOrderByLookup(customerId, orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    order: serializeBotOrder(order),
  });
}
