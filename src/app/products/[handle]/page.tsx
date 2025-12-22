// src/app/products/[handle]/page.tsx
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/shopify";
import ProductDetailClient from "./ProductDetailClient";
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

  const variants =
    (product as any).variants?.edges?.map((e: any) => e.node) ??
    (product as any).variants ??
    [];

  return (
    <PageLayout>
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                        <Image
                        src={product.featuredImage?.url ?? images[0]?.url}
                        alt={product.featuredImage?.altText ?? product.title}
                        width={900}
                        height={900}
                        className="h-auto w-full object-cover"
                        priority
                        />
                    </div>

                    {images.length > 1 && (
                        <div className="grid grid-cols-4 gap-3">
                        {images.slice(0, 8).map((img: any) => (
                            <div
                            key={img.url}
                            className="overflow-hidden rounded-xl border border-black/10"
                            >
                            <Image
                                src={img.url}
                                alt={img.altText ?? product.title}
                                width={200}
                                height={200}
                                className="h-24 w-full object-cover"
                            />
                            </div>
                        ))}
                        </div>
                    )}
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
