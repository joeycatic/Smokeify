import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { resolveOrderSourceFromRequest } from "@/lib/orderSource";
import { buildBackInStockEmail } from "@/lib/storefrontNotificationEmail";
import { parseStorefront } from "@/lib/storefronts";

type BackInStockPayload = {
  email?: string;
  productId?: string;
  productTitle?: string;
  variantId?: string;
  variantTitle?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `back-in-stock:ip:${ip}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const body = (await request.json()) as BackInStockPayload;
  const email = body.email?.trim() || "";
  const productId = body.productId?.trim() || "";
  const productTitle = body.productTitle?.trim() || "";
  const variantId = body.variantId?.trim() || "";
  const variantTitle = body.variantTitle?.trim() || "";

  if (!email || !productId || !variantId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const emailLimit = await checkRateLimit({
    key: `back-in-stock:email:${email.toLowerCase()}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Diese E-Mail wurde kürzlich angemeldet." },
      { status: 429 }
    );
  }

  await prisma.backInStockRequest.upsert({
    where: { email_variantId: { email, variantId } },
    update: {
      productId,
      productTitle,
      variantTitle,
      ...(userId ? { userId } : {}),
    },
    create: {
      email,
      productId,
      productTitle,
      variantId,
      variantTitle,
      ...(userId ? { userId } : {}),
    },
  });

  const orderSource = resolveOrderSourceFromRequest(request);
  const storefront = parseStorefront(orderSource.sourceStorefront ?? null) ?? "MAIN";
  const notificationEmail = buildBackInStockEmail({
    storefront,
    recipientEmail: email.toLowerCase(),
    productTitle,
    variantTitle,
    fallbackOrigin: orderSource.sourceOrigin ?? request.url,
  });

  await sendResendEmail({
    to: email,
    subject: notificationEmail.subject,
    html: notificationEmail.html,
    text: notificationEmail.text,
  });

  return NextResponse.json({ ok: true });
}
