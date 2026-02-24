import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDeviceToken, hashToken } from "@/lib/security";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import crypto from "crypto";

const DEVICE_COOKIE = "smokeify_device";
const VERIFY_LOGIN_COOKIE = "smokeify_verify_login";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const body = (await request.json()) as {
    identifier?: string;
    code?: string;
  };

  const identifier = body.identifier?.trim();
  const code = body.code?.trim();

  if (!identifier || !code) {
    return NextResponse.json(
      { error: "Missing identifier or code" },
      { status: 400 }
    );
  }

  const verifyLimit = await checkRateLimit({
    key: `verify:${identifier}:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!verifyLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const identifierLower = identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifierLower }, { name: identifier }],
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const now = new Date();
  const codeHash = hashToken(code);
  const record = await prisma.verificationCode.findFirst({
    where: {
      email: user.email ?? identifierLower,
      codeHash,
      expiresAt: { gt: now },
      purpose: { in: ["SIGNUP", "NEW_DEVICE"] },
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
  const loginToken = crypto.randomBytes(32).toString("hex");
  const loginTokenHash = hashToken(loginToken);
  const loginTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email: user.email ?? identifierLower,
      codeHash: loginTokenHash,
      purpose: record.purpose,
      expiresAt: loginTokenExpiresAt,
    },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEVICE_COOKIE, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  response.cookies.set(VERIFY_LOGIN_COOKIE, loginToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
