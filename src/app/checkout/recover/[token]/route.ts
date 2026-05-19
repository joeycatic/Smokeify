import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyCheckoutRecoveryToken,
} from "@/lib/checkoutRecovery";
import { getCheckoutRecoveryRestorePayload } from "@/lib/checkoutRecoveryService";
import { getAppOrigin } from "@/lib/appOrigin";

const CART_COOKIE_NAME = "smokeify_cart";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<unknown> },
) {
  const { token } = (await context.params) as { token: string };
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session")?.trim() ?? "";
  const expiresAt = Number(url.searchParams.get("expires") ?? "");
  const stepIndex = Number(url.searchParams.get("step") ?? "");
  const promoCode = url.searchParams.get("promo")?.trim() ?? null;

  const redirectUrl = new URL("/cart", getAppOrigin(request));

  if (
    !token ||
    !sessionId ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(stepIndex) ||
    !verifyCheckoutRecoveryToken({
      sessionId,
      stepIndex: Math.floor(stepIndex),
      expiresAt,
      promoCode,
      token,
    })
  ) {
    redirectUrl.searchParams.set("recovery", "invalid");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const payload = await getCheckoutRecoveryRestorePayload(sessionId);
    const store = await cookies();
    store.set(CART_COOKIE_NAME, JSON.stringify(payload.cartItems), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });

    const checkoutUrl = new URL("/checkout/start", getAppOrigin(request));
    checkoutUrl.searchParams.set("recoverySession", payload.id);
    if (payload.shippingCountry?.trim()) {
      checkoutUrl.searchParams.set("country", payload.shippingCountry.trim());
    }
    if (promoCode?.trim()) {
      checkoutUrl.searchParams.set("discountCode", promoCode.trim());
    } else if (payload.discountCode?.trim()) {
      checkoutUrl.searchParams.set("discountCode", payload.discountCode.trim());
    }
    return NextResponse.redirect(checkoutUrl);
  } catch {
    redirectUrl.searchParams.set("recovery", "missing");
    return NextResponse.redirect(redirectUrl);
  }
}
