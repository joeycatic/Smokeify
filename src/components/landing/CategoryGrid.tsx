import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import type { CategoryCard } from "@/components/landing/data/landingPageData";
import { getCategoryIconName } from "@/components/navbar/categoryIcons";

export function CategoryGrid({ categories }: { categories: CategoryCard[] }) {
  return (
    <section aria-labelledby="kategorien" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase text-[color:var(--gv-lime)]">
            Sortiment
          </p>
          <h2 id="kategorien" className="mt-2 font-[family:var(--font-syne)] text-3xl font-bold text-[color:var(--gv-text)] sm:text-4xl">
            Nach Aufgabe einkaufen
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[color:var(--gv-text-muted)]">
          Jede Kategorie ist auf klare Entscheidungen zugeschnitten: zuerst
          Aufgabe klären, dann das passende Produkt auswählen.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {categories.map((category) => {
          const iconName = getCategoryIconName(category.name);
          const toneGradient =
            category.tone === "clay"
              ? "linear-gradient(145deg,#d17b45,#a34d21)"
              : category.tone === "sky"
                ? "linear-gradient(145deg,#3f7ea3,#234f6a)"
                : "linear-gradient(145deg,#2c7350,#1a4a30)";

          return (
            <Link
              key={category.href}
              href={category.href}
              className={[
                "group relative min-h-28 overflow-hidden rounded-[18px] border bg-[color:var(--gv-surface)] p-3 shadow-[var(--gv-shadow)]",
                "outline-none transition duration-300 ease-out hover:bg-[color:var(--gv-brand-soft)] hover:shadow-[var(--gv-shadow-lg)] motion-safe:hover:-translate-y-1",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] active:translate-y-0",
                "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_12%,var(--gv-lime-glow),transparent_34%)] before:opacity-0 before:transition-opacity hover:before:opacity-100",
                "sm:min-h-40 sm:rounded-[26px] sm:p-5",
                category.highlighted
                  ? "border-[color:var(--gv-lime)]/50 shadow-[0_18px_60px_var(--gv-lime-glow)]"
                  : "border-[color:var(--gv-border)] hover:border-[color:var(--gv-lime)]/38",
              ].join(" ")}
            >
              {category.highlighted ? <div className="absolute inset-x-0 top-0 h-1 bg-[color:var(--gv-lime)]" /> : null}
              <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition duration-300 motion-safe:group-hover:scale-105 motion-safe:group-hover:-rotate-3 sm:h-12 sm:w-12 sm:rounded-2xl" style={{ backgroundImage: toneGradient }}>
                  <GrowvaultIcon name={iconName} className="h-5 w-5 sm:h-[23px] sm:w-[23px]" aria-hidden="true" />
                </span>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)] transition group-hover:bg-[color:var(--gv-lime)] group-hover:text-white sm:h-10 sm:w-10">
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="relative mt-3 sm:mt-5">
                <h3 className="font-[family:var(--font-syne)] text-sm font-bold leading-tight text-[color:var(--gv-text)] sm:text-lg">
                  {category.name}
                </h3>
                <p className="mt-1 font-[family:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--gv-text-muted)] sm:mt-2 sm:text-xs">
                  {category.count} {category.count === 1 ? "Produkt" : "Produkte"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
