import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode, hashToken } from "@/lib/security";
import { sendVerificationCodeEmail } from "@/lib/email";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const street = body.street?.trim();
  const houseNumber = body.houseNumber?.trim();
  const postalCode = body.postalCode?.trim();
  const city = body.city?.trim();
  const country = body.country?.trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
  if (name) {
    const existingName = await prisma.user.findFirst({
      where: { name },
      select: { id: true },
    });
    if (existingName) {
      return NextResponse.json({ error: "Username already in use" }, { status: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      firstName,
      lastName,
      street,
      houseNumber,
      postalCode,
      city,
      country,
      passwordHash,
    },
  });

  const code = generateVerificationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email,
      codeHash,
      purpose: "SIGNUP",
      expiresAt,
    },
  });

  await sendVerificationCodeEmail({ email, code, purpose: "SIGNUP" });

  return NextResponse.json({ ok: true });
}
