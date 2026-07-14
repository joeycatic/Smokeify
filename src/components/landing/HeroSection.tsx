import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import GrowTentViewerLoader from "@/components/three/GrowTentViewerLoader";
import type { GrowTentViewerProductProps } from "@/components/three/growTentViewerTypes";
import { buildGrowvaultCustomizerUrl } from "@/lib/growvaultPublicStorefront";

export function HeroSection({
  growTentProducts,
}: {
  growTentProducts: GrowTentViewerProductProps;
}) {
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

        <GrowTentViewerLoader products={growTentProducts} compact />
      </div>
    </section>
  );
}
