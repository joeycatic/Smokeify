import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode, hashToken } from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RESEND_WINDOW_MS = 60 * 60 * 1000;
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const RECENT_NEW_DEVICE_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `resend:ip:${ip}`,
    limit: 5,
    windowMs: RESEND_WINDOW_MS,
  });
  const emailLimit = await checkRateLimit({
    key: `resend:email:${email}`,
    limit: 3,
    windowMs: RESEND_WINDOW_MS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user || !user.email) {
    return NextResponse.json({ ok: true });
  }

  let purpose: "SIGNUP" | "NEW_DEVICE" | null = null;
  if (!user.emailVerified) {
    purpose = "SIGNUP";
  } else {
    const recentNewDevice = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        email,
        purpose: "NEW_DEVICE",
        createdAt: { gt: new Date(Date.now() - RECENT_NEW_DEVICE_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentNewDevice) {
      purpose = "NEW_DEVICE";
    }
  }

  if (!purpose) {
    return NextResponse.json({ ok: true });
  }

  const code = generateVerificationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  await sendVerificationCodeEmail({ email, code, purpose });

  return NextResponse.json({ ok: true });
}
