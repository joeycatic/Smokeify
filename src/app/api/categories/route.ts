import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      handle: true,
      parentId: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}
