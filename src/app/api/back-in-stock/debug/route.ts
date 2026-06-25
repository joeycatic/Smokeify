import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await prisma.backInStockRequest.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    count: rows.length,
    rows: rows.map((row) => ({
      id: row.id,
      email: row.email,
      productId: row.productId,
      productTitle: row.productTitle,
      variantId: row.variantId,
      variantTitle: row.variantTitle,
      createdAt: row.createdAt,
    })),
  });
}
