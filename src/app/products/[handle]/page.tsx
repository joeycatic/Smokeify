// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/catalog";
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

  const images = product.images ?? [];
  const hasDiscount = product.variants.some((variant) => variant.compareAt);

  return (
    <PageLayout>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-stone-100">
              <ProductImageCarousel images={images} alt={product.title} />
              {hasDiscount && (
                <span className="absolute left-4 top-4 rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black shadow">
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
            }}
            variants={product.variants}
          />
        </div>

        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
      </main>
    </PageLayout>
  );
}
