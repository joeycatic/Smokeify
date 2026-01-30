// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import ProductReviews from "./ProductReviews";
import PageLayout from "@/components/PageLayout";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

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
  const featureItems = [
    "Schnelle Lieferung",
    "100% geprüft",
    "Diskret verpackt",
  ];

  return (
    <PageLayout>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-[32px] border border-black/5 bg-[radial-gradient(120%_120%_at_50%_40%,rgba(63,92,80,0.55)_0%,rgba(47,62,54,0.38)_35%,rgba(168,199,154,0.22)_70%,rgba(255,255,255,0)_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="relative rounded-[20px] bg-white/80 p-3 shadow-sm">
                <ProductImageCarousel images={images} alt={product.title} />
                {hasDiscount && (
                  <span className="absolute left-6 top-6 rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black shadow">
                    Sale
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-black/70">
                {featureItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-6 w-6 text-emerald-800" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>

              {product.description && (
                <div className="rounded-2xl border border-black/10 bg-white/85 shadow-sm">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                        <InformationCircleIcon className="h-5 w-5 text-black/60" />
                        Produktbeschreibung
                      </span>
                      <span className="text-xxs font-semibold text-emerald-800/80">
                        Mehr erfahren
                      </span>
                    </summary>
                    <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                      <div className="overflow-hidden px-5 pb-5">
                        <div
                          className="product-description product-description-compact text-xxs leading-6 text-black/60"
                          dangerouslySetInnerHTML={{
                            __html: product.description,
                          }}
                        />
                      </div>
                    </div>
                  </details>
                </div>
              )}
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
