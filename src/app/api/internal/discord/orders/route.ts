import { NextResponse } from "next/server";

import {
  getDiscordBotAuthError,
  getOrdersByCustomerId,
  parseBotCustomerId,
  parseBotOrderLimit,
  serializeBotOrder,
} from "@/lib/discordBotOrders";

export async function GET(request: Request) {
  const authError = getDiscordBotAuthError(request);
  if (authError) {
    return authError;
  }

  const customerId = parseBotCustomerId(request);
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }

  const limit = parseBotOrderLimit(request);
  const orders = await getOrdersByCustomerId(customerId, limit);

  return NextResponse.json({
    orders: orders.map(serializeBotOrder),
  });
}
