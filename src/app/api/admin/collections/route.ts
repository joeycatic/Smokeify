import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, slugify } from "@/lib/adminCatalog";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    handle?: string;
    description?: string | null;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const handle = slugify(body.handle?.trim() || name);
  const existing = await prisma.collection.findUnique({ where: { handle } });
  if (existing) {
    return NextResponse.json({ error: "Handle already exists" }, { status: 409 });
  }

  const collection = await prisma.collection.create({
    data: {
      name,
      handle,
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ collection });
}
