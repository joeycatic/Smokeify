import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, LOGIN_RATE_LIMIT } from "@/lib/rateLimit";
import { signMobileToken } from "@/lib/mobileToken";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-login:ip:${ip}`,
    limit: LOGIN_RATE_LIMIT.ipLimit,
    windowMs: LOGIN_RATE_LIMIT.windowMs,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    identifier?: string;
    email?: string;
    password?: string;
  };

  const identifier = (body.identifier ?? body.email ?? "").trim();
  const identifierLower = identifier.toLowerCase();
  const password = body.password ?? "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "Missing identifier or password" }, { status: 400 });
  }

  const identifierLimit = await checkRateLimit({
    key: `mobile-login:identifier:${identifierLower}`,
    limit: LOGIN_RATE_LIMIT.identifierLimit,
    windowMs: LOGIN_RATE_LIMIT.windowMs,
  });
  if (!identifierLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifierLower, mode: "insensitive" } },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      customerGroup: true,
      passwordHash: true,
      emailVerified: true,
    },
  });

  if (!user?.passwordHash || !user.email) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: "Email not verified" }, { status: 403 });
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  let token: string;
  try {
    token = signMobileToken({
      sub: user.id,
      email: user.email,
      name: displayName,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    });
  } catch {
    return NextResponse.json(
      { error: "Mobile auth is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName,
      role:
        user.role === "ADMIN"
          ? "admin"
          : user.customerGroup === "VIP"
            ? "premium"
            : "user",
    },
  });
}
