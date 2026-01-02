import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
