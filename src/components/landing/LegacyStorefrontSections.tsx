import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import DisplayProducts from "@/components/DisplayProducts";
import type { Product } from "@/data/types";
import { buildCategoryHref } from "@/lib/seoPages";
import { buildGrowvaultAnalyzerUrl } from "@/lib/growvaultPublicStorefront";

type LegacyStorefrontSectionsProps = {
  showcasedProducts: Product[];
  featuredLightDeals: Product[];
};

const analyzerRecommendations = [
  "CalMag & Basisdünger",
  "pH- und EC-Messgeräte",
  "Bewässerung & Wurzelpflege",
] as const;

export function LegacyStorefrontSections({
  showcasedProducts,
  featuredLightDeals,
}: LegacyStorefrontSectionsProps) {
  return (
    <div className="space-y-10 sm:space-y-14 lg:space-y-18">
      <section className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="gv-chip">Empfohlene Produkte</span>
            <h2 className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.06em] text-[color:var(--gv-text)] sm:text-4xl">
              Direkte Empfehlungen für dein Setup
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--gv-text-muted)] sm:text-base">
              Produkte, die schnell verständlich sind: Preis, Bestand,
              Einsatzbereich und passende nächste Schritte auf einen Blick.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-[color:var(--gv-border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/40 hover:bg-[color:var(--gv-lime)]/10 sm:px-5 sm:py-3 lg:self-auto"
          >
            Alle Produkte ansehen
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <DisplayProducts
          products={showcasedProducts}
          cols={4}
          mobileCols={2}
          showManufacturer
          hideCartLabel
        />
      </section>

      {featuredLightDeals.length > 0 ? (
        <section className="space-y-5 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="gv-chip">Aktuelle Auswahl</span>
              <h2 className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.06em] text-[color:var(--gv-text)] sm:text-4xl">
                Weitere Empfehlungen von Smokeify.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--gv-text-muted)] sm:text-base">
                Die Auswahl folgt den Homepage-Einstellungen im Admin und
                bleibt vollständig im aktiven MAIN-Sortiment.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-[color:var(--gv-border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/40 hover:bg-[color:var(--gv-lime)]/10 sm:px-5 sm:py-3 lg:self-auto"
            >
              Sortiment ansehen
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <DisplayProducts
            products={featuredLightDeals}
            cols={4}
            mobileCols={2}
            showManufacturer
            hideCartLabel
          />
        </section>
      ) : null}

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#c76a34,#8f4420)] px-5 py-5 text-white shadow-[var(--gv-shadow-lg)] sm:rounded-[32px] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <span className="relative inline-flex rounded-full bg-white/15 px-3 py-1 font-[family:var(--font-jetbrains-mono)] text-xs uppercase text-white">
            Pflanzen-Analyzer
          </span>
          <h2 className="relative mt-3 font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.06em] text-white sm:mt-4 sm:text-4xl">
            Foto hochladen. Besser einordnen. Passende Hilfe finden.
          </h2>
          <p className="relative mt-3 max-w-xl text-sm leading-6 text-white/78 sm:mt-4 sm:text-base sm:leading-7">
            Symptome, mögliche Ursachen und passende nächste Schritte klar
            getrennt dargestellt.
          </p>
          <div className="relative mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
            <Link
              href={buildGrowvaultAnalyzerUrl()}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#8f4420] transition hover:brightness-105 sm:min-h-12 sm:px-5 sm:py-3"
            >
              Pflanzenfoto analysieren
            </Link>
            <Link
              href={buildCategoryHref("duenger")}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:min-h-12 sm:px-5 sm:py-3"
            >
              Dünger & Messgeräte ansehen
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-4 shadow-[var(--gv-shadow-lg)] sm:rounded-[32px] sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,var(--gv-lime-glow),transparent_34%)]" />
          <div className="relative space-y-4 sm:space-y-5">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                  Beispielauswertung
                </p>
                <h3 className="mt-1.5 font-[family:var(--font-syne)] text-xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)] sm:mt-2 sm:text-2xl">
                  Möglicher Nährstoffmangel erkannt
                </h3>
              </div>
              <span className="rounded-full border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-lime)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--gv-lime)]">
                Mangel festgestellt
              </span>
            </div>

            <div className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3.5 sm:rounded-[24px] sm:p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[color:var(--gv-text-muted)]">
                  Einordnungssicherheit
                </span>
                <span className="font-[family:var(--font-jetbrains-mono)] font-semibold text-[color:var(--gv-text)]">
                  78%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--gv-border)]">
                <div
                  className="hero-progress h-full rounded-full bg-[linear-gradient(90deg,#34d399,var(--gv-lime))]"
                  style={{ width: "78%" }}
                />
              </div>
              <p className="mt-3 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
                Die Hinweise sprechen eher für ein Versorgungs- oder
                Messproblem als für Schädlingsdruck.
              </p>
            </div>

            <div className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3.5 sm:rounded-[24px] sm:p-4">
              <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                Passende nächste Schritte
              </p>
              <ul className="mt-3 grid gap-2">
                {analyzerRecommendations.map((entry) => (
                  <li
                    key={entry}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-3 text-sm text-[color:var(--gv-text)]"
                  >
                    <span>{entry}</span>
                    <ArrowRightIcon
                      className="h-4 w-4 text-[color:var(--gv-lime)]"
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
