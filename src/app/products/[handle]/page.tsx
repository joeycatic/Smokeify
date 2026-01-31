// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import ProductReviews from "./ProductReviews";
import PageLayout from "@/components/PageLayout";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return notFound();
  const groupProducts = product.productGroup
    ? await prisma.product.findMany({
        where: { productGroup: product.productGroup, status: "ACTIVE" },
        select: { id: true, title: true, handle: true, growboxSize: true },
        orderBy: { title: "asc" },
      })
    : [];

  const images = product.images ?? [];
  const primaryImage = images[0] ?? null;
  const hasDiscount = product.variants.some((variant) => variant.compareAt);
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-7xl px-0 sm:px-2 py-6">
        <div className="rounded-[32px] border border-black/5 bg-[radial-gradient(120%_120%_at_50%_40%,rgba(38,62,52,0.6)_0%,rgba(32,52,45,0.45)_35%,rgba(120,150,130,0.25)_70%,rgba(255,255,255,0)_100%)] p-2 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="relative rounded-[18px] bg-white/80 p-2 shadow-sm">
                <ProductImageCarousel images={images} alt={product.title} />
                {hasDiscount && (
                  <span className="absolute left-6 top-6 rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black shadow">
                    Sale
                  </span>
                )}
              </div>

            </div>

            <ProductDetailClient
              product={{
                id: product.id,
                title: product.title,
                descriptionHtml: product.description ?? "",
                technicalDetailsHtml: product.technicalDetails ?? "",
                shortDescription: product.shortDescription ?? null,
                manufacturer: product.manufacturer ?? null,
                growboxSize: product.growboxSize ?? null,
              }}
              productGroupItems={groupProducts}
              currentHandle={product.handle}
              variants={product.variants}
              imageUrl={primaryImage?.url ?? null}
              imageAlt={primaryImage?.altText ?? product.title}
            />
          </div>
        </div>

        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
      </main>
    </PageLayout>
  );
}
