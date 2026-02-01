import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode, hashToken } from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RESEND_WINDOW_MS = 10 * 60 * 1000;
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const RECENT_NEW_DEVICE_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as { identifier?: string };
  const identifier = body.identifier?.trim();

  if (!identifier) {
    return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `resend:ip:${ip}`,
    limit: 5,
    windowMs: RESEND_WINDOW_MS,
  });
  const identifierLimit = await checkRateLimit({
    key: `resend:identifier:${identifier}`,
    limit: 5,
    windowMs: RESEND_WINDOW_MS,
  });

  if (!ipLimit.allowed || !identifierLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const identifierLower = identifier.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: identifierLower },
    select: { id: true, email: true, emailVerified: true },
  });
  const resolvedUser =
    user ??
    (await prisma.user.findUnique({
      where: { name: identifier },
      select: { id: true, email: true, emailVerified: true },
    }));

  if (!resolvedUser || !resolvedUser.email) {
    return NextResponse.json({ ok: true });
  }

  let purpose: "SIGNUP" | "NEW_DEVICE" | null = null;
  if (!resolvedUser.emailVerified) {
    purpose = "SIGNUP";
  } else {
    const recentNewDevice = await prisma.verificationCode.findFirst({
      where: {
        userId: resolvedUser.id,
        email: resolvedUser.email,
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
      userId: resolvedUser.id,
      email: resolvedUser.email,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  await sendVerificationCodeEmail({
    email: resolvedUser.email,
    code,
    purpose,
  });

  return NextResponse.json({ ok: true });
}
