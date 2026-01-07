import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RESET_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    code?: string;
    newPassword?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  const newPassword = body.newPassword ?? "";

  if (!email || !code || !newPassword) {
    return NextResponse.json(
      { error: "Missing reset data" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password too short" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request.headers);
  const resetLimit = await checkRateLimit({
    key: `reset:confirm:${email}:${ip}`,
    limit: 5,
    windowMs: RESET_WINDOW_MS,
  });
  if (!resetLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const codeHash = hashToken(code);
  const record = await prisma.verificationCode.findFirst({
    where: {
      email,
      codeHash,
      purpose: "PASSWORD_RESET",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.verificationCode.deleteMany({
    where: { userId: user.id, purpose: "PASSWORD_RESET" },
  });

  return NextResponse.json({ ok: true });
}
