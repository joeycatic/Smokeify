import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export type EditorialLinkCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  ctaLabel?: string;
};

export type EditorialGuideCard = {
  slug: string;
  title: string;
  excerpt: string;
  href: string;
  publishedAt: string;
  readingTimeMin: number;
  eyebrow?: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function EditorialLinkGrid({
  eyebrow,
  title,
  description,
  links,
  columnsClassName = "lg:grid-cols-3",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  links: EditorialLinkCard[];
  columnsClassName?: string;
}) {
  if (links.length === 0) return null;

  return (
    <section className="smk-surface rounded-[30px] px-5 py-6 sm:px-6">
      {eyebrow ? (
        <p className="font-[family:var(--font-manrope)] text-xs uppercase tracking-[0.22em] text-[color:var(--smk-accent-2)]">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-[family:var(--font-fraunces)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)] sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className={`mt-5 grid gap-4 ${columnsClassName}`}>
        {links.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className="group rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/88 p-4 transition hover:-translate-y-1 hover:border-[color:var(--smk-accent-2)]/45"
          >
            {link.eyebrow ? (
              <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent-2)]">
                {link.eyebrow}
              </p>
            ) : null}
            <p className="mt-2 text-base font-semibold text-[color:var(--smk-text)]">
              {link.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {link.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--smk-accent-2)]">
              {link.ctaLabel ?? "Jetzt öffnen"}
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function EditorialGuideGrid({
  eyebrow,
  title,
  description,
  guides,
  columnsClassName = "lg:grid-cols-3",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  guides: EditorialGuideCard[];
  columnsClassName?: string;
}) {
  if (guides.length === 0) return null;

  return (
    <section className="smk-surface rounded-[30px] px-5 py-6 sm:px-6">
      {eyebrow ? (
        <p className="font-[family:var(--font-manrope)] text-xs uppercase tracking-[0.22em] text-[color:var(--smk-accent-2)]">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-[family:var(--font-fraunces)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)] sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className={`mt-5 grid gap-4 ${columnsClassName}`}>
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={guide.href}
            className="group rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)]/88 p-4 transition hover:-translate-y-1 hover:border-[color:var(--smk-accent-2)]/45"
          >
            <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent-2)]">
              {guide.eyebrow ?? `${formatDate(guide.publishedAt)} · ${guide.readingTimeMin} Min`}
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[color:var(--smk-text)]">
              {guide.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--smk-text-muted)]">
              {guide.excerpt}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--smk-accent-2)]">
              Guide lesen
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

