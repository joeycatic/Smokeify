import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDeviceToken, hashToken } from "@/lib/security";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const DEVICE_COOKIE = "smokeify_device";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const body = (await request.json()) as {
    email?: string;
    code?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();

  if (!email || !code) {
    return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
  }

  const verifyLimit = await checkRateLimit({
    key: `verify:${email}:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!verifyLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const now = new Date();
  const codeHash = hashToken(code);
  const record = await prisma.verificationCode.findFirst({
    where: {
      email,
      codeHash,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  if (record.purpose === "SIGNUP" && !user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: now },
    });
  }

  const deviceToken = generateDeviceToken();
  const tokenHash = hashToken(deviceToken);
  await prisma.device.upsert({
    where: {
      userId_tokenHash: {
        userId: user.id,
        tokenHash,
      },
    },
    update: { lastSeenAt: now },
    create: {
      userId: user.id,
      tokenHash,
      lastSeenAt: now,
    },
  });

  await prisma.verificationCode.deleteMany({
    where: { userId: user.id, purpose: record.purpose },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEVICE_COOKIE, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
