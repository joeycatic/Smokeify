import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode, hashToken } from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const RESET_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `reset:request:ip:${ip}`,
    limit: 5,
    windowMs: RESET_WINDOW_MS,
  });
  const emailLimit = await checkRateLimit({
    key: `reset:request:email:${email}`,
    limit: 3,
    windowMs: RESET_WINDOW_MS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ ok: true });
  }

  const code = generateVerificationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await prisma.verificationCode.deleteMany({
    where: { userId: user.id, purpose: "PASSWORD_RESET" },
  });

  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email,
      codeHash,
      purpose: "PASSWORD_RESET",
      expiresAt,
    },
  });

  await sendVerificationCodeEmail({ email, code, purpose: "PASSWORD_RESET" });

  return NextResponse.json({ ok: true });
}
