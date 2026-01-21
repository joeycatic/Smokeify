// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/catalog";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import ProductReviews from "./ProductReviews";
import PageLayout from "@/components/PageLayout";
import { DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return notFound();

  const images = product.images ?? [];
  const primaryImage = images[0] ?? null;
  const hasDiscount = product.variants.some((variant) => variant.compareAt);

  return (
    <PageLayout>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-stone-100">
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
              technicalDetailsHtml: product.technicalDetails ?? "",
              shortDescription: product.shortDescription ?? null,
            }}
            variants={product.variants}
            imageUrl={primaryImage?.url ?? null}
            imageAlt={primaryImage?.altText ?? product.title}
          />
        </div>

        {product.description && (
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-6xl rounded-xl border border-black/10 bg-white">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                    <DocumentTextIcon className="h-5 w-5 text-black/60" />
                    Detaillierte Beschreibung
                  </span>
                  <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                  <div className="overflow-hidden px-5 pb-5 transition-all duration-500 ease-out">
                    <div
                      className="product-description"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                </div>
              </details>
            </div>
          </section>
        )}

        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
      </main>
    </PageLayout>
  );
}
