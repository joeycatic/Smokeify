// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/shopify";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import PageLayout from "@/components/PageLayout";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return notFound();

  // supports both shapes: edges OR array
  const images =
    (product as any).images?.edges?.map((e: any) => e.node) ??
    (product as any).images ??
    [];
  const featuredImage = product.featuredImage ?? null;
  const galleryImages = featuredImage && !images.some((img: any) => img?.url === featuredImage.url)
    ? [featuredImage, ...images]
    : images;

  const variants =
    (product as any).variants?.edges?.map((e: any) => e.node) ??
    (product as any).variants ??
    [];

  return (
    <PageLayout>
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-stone-100">
                        <ProductImageCarousel
                          images={galleryImages}
                          alt={product.title}
                        />
                    </div>

                    </div>

                <ProductDetailClient
                    product={{
                        title: product.title,
                        vendor: product.vendor,
                        descriptionHtml: product.descriptionHtml,
                    }}
                    variants={variants}
                    options={product.options ?? []}
                />
            </div>
        </main>
    </PageLayout>
  );
}
