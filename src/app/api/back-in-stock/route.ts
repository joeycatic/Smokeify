import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";

type BackInStockPayload = {
  email?: string;
  productId?: string;
  productTitle?: string;
  variantId?: string;
  variantTitle?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
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

  const subject = "Benachrichtigung bei Verfugbarkeit";
  const lineTitle = productTitle || "Dein Artikel";
  const variantLine = variantTitle ? ` (${variantTitle})` : "";
  const text = `${lineTitle}${variantLine}\n\nWir benachrichtigen dich, sobald der Artikel wieder verfugbar ist.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p><strong>${lineTitle}${variantLine}</strong></p>
      <p>Wir benachrichtigen dich, sobald der Artikel wieder verfugbar ist.</p>
    </div>
  `;

  await sendResendEmail({ to: email, subject, html, text });

  return NextResponse.json({ ok: true });
}
