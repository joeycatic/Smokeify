import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/adminCatalog";

export async function GET() {
  const session = await requireAdminOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await requireAdminOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; role?: string };
  if (!body.id || !body.role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const role = body.role.toUpperCase();
  if (!["USER", "ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: body.id },
    data: { role: role as "USER" | "ADMIN" | "STAFF" },
  });

  return NextResponse.json({ ok: true });
}
