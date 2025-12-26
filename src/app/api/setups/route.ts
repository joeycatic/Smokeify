import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ setups: [] }, { status: 401 });
  }

  const setups = await prisma.savedSetup.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ setups });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; data?: unknown };
  if (!body.data) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const setup = await prisma.savedSetup.create({
    data: {
      userId: session.user.id,
      name: body.name ?? "Saved setup",
      data: body.data,
    },
  });

  return NextResponse.json({ setup });
}
