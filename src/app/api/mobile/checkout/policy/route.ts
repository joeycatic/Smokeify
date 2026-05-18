import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
} from "@/lib/checkoutPolicy";

const SHIPPING_BASE_EUR = {
  DE: 7.9,
  AT: 7.9,
  CH: 9.9,
  EU: 8.9,
  UK: 9.9,
  US: 12.9,
  OTHER: 12.9,
} as const;

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-checkout-policy:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.json({
    freeShippingThresholdEur: FREE_SHIPPING_THRESHOLD_EUR,
    minOrderTotalEur: MIN_ORDER_TOTAL_EUR,
    shippingBaseEur: SHIPPING_BASE_EUR,
  });
}
