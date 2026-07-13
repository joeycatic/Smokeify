import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type { Product } from "@/data/types";
import { buildGrowvaultCustomizerUrl } from "@/lib/growvaultPublicStorefront";

function formatPrice(product: Product) {
  const amount = Number(product.priceRange.minVariantPrice.amount);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: product.priceRange.minVariantPrice.currencyCode,
  }).format(amount);
}

export function HeroSection({ products }: { products: Product[] }) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-6 shadow-[var(--gv-shadow)] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute -right-24 top-12 h-72 w-72 rounded-full bg-[color:var(--gv-lime)]/10 blur-3xl" />
      <div className="relative grid gap-7 xl:grid-cols-[0.7fr_1.3fr] xl:items-center">
        <div className="max-w-2xl">
          <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase text-[color:var(--gv-lime)]">
            Smokeify.de
          </p>
          <h1 className="mt-5 font-[family:var(--font-syne)] text-5xl font-extrabold leading-none text-[color:var(--gv-text)] sm:text-6xl lg:text-7xl">
            Dein Setup ist keine Doktorarbeit.
            <br />
            <span className="text-[color:var(--gv-lime)]">
              Auch wenn&apos;s sich so anfühlt.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--gv-text-muted)] sm:text-lg">
            Finde Produkte nach Aufgabe, Marke und Budget. Smokeify zeigt dir
            Bestand, Preis und passende nächste Schritte, bevor du dich durch
            einzelne Produktseiten klickst.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-5 py-3 text-sm font-bold text-white hover:bg-[color:var(--gv-lime-dim)] focus:outline-none focus:ring-2 focus:ring-[color:var(--gv-lime)]/50 focus:ring-offset-2"
            >
              Produkte entdecken
            </Link>
            <a
              href={buildGrowvaultCustomizerUrl()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-5 py-3 text-sm font-bold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40 hover:bg-[color:var(--gv-brand-soft)] focus:outline-none focus:ring-2 focus:ring-[color:var(--gv-lime)]/40 focus:ring-offset-2"
            >
              Setup konfigurieren
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-2 rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-2">
            {["MAIN Sortiment", "Aktiver Bestand", "Ohne Konto"].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-[color:var(--gv-dark)] px-3 py-3 text-center text-xs font-semibold text-[color:var(--gv-text)] sm:text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[28px] border border-[color:var(--gv-border)] bg-[linear-gradient(145deg,var(--gv-brand-soft),#f7e4d6)] p-4 sm:min-h-[430px] sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/70 blur-3xl" />
          <div className="relative grid h-full min-h-[328px] grid-cols-2 gap-3 sm:min-h-[382px] sm:grid-cols-3 sm:gap-4">
            {products.slice(0, 3).map((product, index) => (
              <Link
                key={product.id}
                href={`/products/${product.handle}`}
                className={`group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/92 p-3 shadow-[0_18px_55px_rgba(31,95,63,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(31,95,63,0.18)] ${index === 0 ? "col-span-2 sm:col-span-1 sm:row-span-2" : ""}`}
              >
                <div className={`relative overflow-hidden rounded-[18px] bg-[#f4f6f3] ${index === 0 ? "aspect-[16/9] sm:h-[270px] sm:aspect-auto" : "aspect-square"}`}>
                  {product.featuredImage?.url ? (
                    <Image
                      src={product.featuredImage.url}
                      alt={product.featuredImage.altText ?? product.title}
                      fill
                      sizes={index === 0 ? "(min-width: 640px) 22vw, 80vw" : "(min-width: 640px) 18vw, 42vw"}
                      className="object-contain p-3 transition duration-500 group-hover:scale-105"
                      priority={index === 0}
                    />
                  ) : (
                    <div className="grid h-full place-items-center font-[family:var(--font-syne)] text-sm font-bold text-[color:var(--gv-text-muted)]">
                      Smokeify
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <p className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--gv-text)]">{product.title}</p>
                  <p className="mt-1 font-[family:var(--font-jetbrains-mono)] text-xs font-semibold text-[color:var(--gv-lime)]">{formatPrice(product)}</p>
                </div>
              </Link>
            ))}
            {products.length === 0 ? (
              <div className="col-span-full grid min-h-[328px] place-items-center rounded-[24px] border border-dashed border-[color:var(--gv-border)] bg-white/70 p-8 text-center text-sm text-[color:var(--gv-text-muted)]">
                Aktive Homepage-Produkte werden hier aus dem Smokeify-Admin geladen.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
