import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CURRENCY_MULTIPLIER = 100;

const getMinPriceCents = (prices: number[]) => {
  if (!prices.length) return 0;
  return prices.reduce((min, value) => (value < min ? value : min), prices[0]);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryHandle = searchParams.get("category");

  if (!categoryHandle) {
    return NextResponse.json(
      { error: "Missing category handle." },
      { status: 400 },
    );
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      categories: {
        some: { category: { handle: { equals: categoryHandle, mode: "insensitive" } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      variants: { select: { priceCents: true }, orderBy: { position: "asc" } },
    },
  });

  const options = products.map((product) => {
    const minPriceCents = getMinPriceCents(
      product.variants.map((variant) => variant.priceCents),
    );
    return {
      id: product.id,
      label: product.title,
      price: minPriceCents / CURRENCY_MULTIPLIER,
      size: product.growboxSize ?? product.lightSize ?? undefined,
      diameterMm: product.airSystemDiameterMm ?? undefined,
      diametersMm:
        product.growboxConnectionDiameterMm.length > 0
          ? product.growboxConnectionDiameterMm
          : undefined,
    };
  });

  return NextResponse.json({ options });
}
