import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
    },
  });

  return NextResponse.json({ user });
}

export async function POST(request: Request) {
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
  };

  const email = body.email?.trim().toLowerCase() || undefined;
  const name = body.name?.trim() || undefined;
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

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      email,
      firstName: body.firstName?.trim() || undefined,
      lastName: body.lastName?.trim() || undefined,
      street: body.street?.trim() || undefined,
      houseNumber: body.houseNumber?.trim() || undefined,
      postalCode: body.postalCode?.trim() || undefined,
      city: body.city?.trim() || undefined,
      country: body.country?.trim() || undefined,
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
    },
  });

  return NextResponse.json({ user });
}
