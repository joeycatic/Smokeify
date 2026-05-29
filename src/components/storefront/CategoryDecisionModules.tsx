import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type {
  CategoryDecisionCard,
  CategoryDecisionGuide,
  CategoryDecisionPrompt,
  ListingGuidance,
} from "@/lib/categoryDecision";

export function CategoryDecisionCardsSection({
  categoryTitle,
  cards,
}: {
  categoryTitle: string;
  cards: CategoryDecisionCard[];
}) {
  if (cards.length === 0) return null;

  return (
    <section className="smk-surface rounded-[30px] px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family:var(--font-manrope)] text-xs uppercase tracking-[0.22em] text-[color:var(--smk-accent-2)]">
            Beste Wahl je Bedarf
          </p>
          <h2 className="mt-2 font-[family:var(--font-fraunces)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)] sm:text-3xl">
            Schneller zur passenden {categoryTitle}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[color:var(--smk-text-muted)]">
          Statt nur Datenpunkte zu lesen, kannst du direkt über typische Kaufmuster einsteigen.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="group rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/85 p-4 transition hover:-translate-y-1 hover:border-[color:var(--smk-accent-2)]/45"
          >
            <span className="inline-flex rounded-full bg-[color:var(--smk-accent-2)]/12 px-3 py-1 font-[family:var(--font-manrope)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--smk-accent-2)]">
              {card.label}
            </span>
            <h3 className="mt-4 text-base font-semibold text-[color:var(--smk-text)]">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {card.reason}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--smk-accent-2)]">
              Produkt ansehen
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CategoryDecisionGuideSection({
  guide,
  comparePrompt,
  supportPrompt,
  trustNote,
}: {
  guide: CategoryDecisionGuide;
  comparePrompt?: CategoryDecisionPrompt | null;
  supportPrompt?: CategoryDecisionPrompt | null;
  trustNote?: string | null;
}) {
  return (
    <section className="smk-surface rounded-[30px] px-5 py-6 sm:px-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/85 p-4">
            <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent-2)]">
              So wählst du besser
            </p>
            <ul className="mt-4 space-y-3">
              {guide.criteria.map((item) => (
                <li
                  key={item}
                  className="rounded-[18px] border border-[color:var(--smk-border)] bg-[color:var(--smk-panel)] px-4 py-3 text-sm leading-6 text-[color:var(--smk-text)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/85 p-4">
            <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent-2)]">
              Wichtige Unterschiede
            </p>
            <ul className="mt-4 space-y-3">
              {guide.differences.map((item) => (
                <li
                  key={item}
                  className="rounded-[18px] border border-[color:var(--smk-border)] bg-[color:var(--smk-panel)] px-4 py-3 text-sm leading-6 text-[color:var(--smk-text)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {[comparePrompt, supportPrompt].filter(Boolean).map((prompt) => (
            <Link
              key={prompt?.href}
              href={prompt?.href ?? "/products"}
              className="group block rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/88 p-5 transition hover:border-[color:var(--smk-accent-2)]/45"
            >
              <p className="text-base font-semibold text-[color:var(--smk-text)]">
                {prompt?.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--smk-text-muted)]">
                {prompt?.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--smk-accent-2)]">
                {prompt?.ctaLabel}
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}

          {trustNote ? (
            <div className="rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-panel)] px-4 py-4 text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {trustNote}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ListingGuidanceSection({
  guidance,
}: {
  guidance: ListingGuidance;
}) {
  if (guidance.actions.length === 0) return null;

  return (
    <section className="smk-surface rounded-[30px] px-5 py-6 sm:px-6">
      {guidance.eyebrow ? (
        <p className="font-[family:var(--font-manrope)] text-xs uppercase tracking-[0.22em] text-[color:var(--smk-accent-2)]">
          {guidance.eyebrow}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-[family:var(--font-fraunces)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)] sm:text-3xl">
            {guidance.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--smk-text-muted)]">
            {guidance.description}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {guidance.actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="group rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/88 p-4 transition hover:-translate-y-1 hover:border-[color:var(--smk-accent-2)]/45"
          >
            <p className="text-base font-semibold text-[color:var(--smk-text)]">{action.title}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {action.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--smk-accent-2)]">
              Jetzt öffnen
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

