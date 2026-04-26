import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  normalizeShippingAddress,
  validateShippingAddress,
} from "@/lib/shippingAddress";
import {
  isMissingCheckoutAddressColumnError,
  loadCheckoutUser,
} from "@/lib/checkoutUser";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await loadCheckoutUser(session.user.id);

  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `account-profile:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    shippingAddressType?: string;
    packstationNumber?: string;
    postNumber?: string;
  };

  const email = body.email?.trim().toLowerCase() || undefined;
  const name = body.name?.trim() || undefined;
  const firstName = body.firstName?.trim() || "";
  const lastName = body.lastName?.trim() || "";
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Vorname und Nachname sind erforderlich." },
      { status: 400 }
    );
  }
  const shippingAddress = normalizeShippingAddress(body);
  const shippingAddressError = validateShippingAddress(shippingAddress);
  if (shippingAddressError) {
    return NextResponse.json({ error: shippingAddressError }, { status: 400 });
  }
  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }
  if (name) {
    const existing = await prisma.user.findFirst({
      where: { name, NOT: { id: session.user.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already in use" }, { status: 409 });
    }
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email,
        firstName,
        lastName,
        street: shippingAddress.street,
        houseNumber: shippingAddress.houseNumber,
        postalCode: shippingAddress.postalCode,
        city: shippingAddress.city,
        country: shippingAddress.country,
        shippingAddressType: shippingAddress.shippingAddressType,
        packstationNumber: shippingAddress.packstationNumber,
        postNumber: shippingAddress.postNumber,
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        shippingAddressType: true,
        packstationNumber: true,
        postNumber: true,
        loyaltyPointsBalance: true,
      },
    });
  } catch (error) {
    if (!isMissingCheckoutAddressColumnError(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email,
        firstName,
        lastName,
        street: shippingAddress.street,
        houseNumber: shippingAddress.houseNumber,
        postalCode: shippingAddress.postalCode,
        city: shippingAddress.city,
        country: shippingAddress.country,
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        loyaltyPointsBalance: true,
      },
    });

    user = {
      ...legacyUser,
      shippingAddressType: null,
      packstationNumber: null,
      postNumber: null,
    };
  }

  return NextResponse.json({ user });
}
