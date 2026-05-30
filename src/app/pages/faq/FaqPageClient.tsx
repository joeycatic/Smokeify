"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type FaqItem = { question: string; answer: string };
type FaqCategory = { label: string; items: FaqItem[] };

type Props = {
  categories: FaqCategory[];
};

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className="smk-surface rounded-[22px] px-4 py-3 transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-[color:var(--smk-text)] sm:text-base">
                {item.question}
              </span>
              <ChevronDownIcon
                className={`h-5 w-5 shrink-0 text-[color:var(--smk-accent)] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="border-t border-[color:var(--smk-border)] pt-3 text-sm leading-relaxed text-[color:var(--smk-text-muted)]">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FaqPageClient({ categories }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl py-12">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center rounded-full border border-[color:var(--smk-border)] bg-[color:var(--smk-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--smk-accent)]">
          Hilfe
        </div>
        <h1 className="mt-4 font-[family:var(--font-fraunces)] text-3xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)] sm:text-4xl">
          Häufige Fragen
        </h1>
        <p className="mt-3 text-base text-[color:var(--smk-text-muted)]">
          Alles Wichtige rund um Bestellung, Versand und Indoor-Gartenbau.
        </p>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <section
            key={category.label}
            className="smk-panel rounded-[28px] px-5 py-5 shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
          >
            <h2 className="border-b border-[color:var(--smk-border)] pb-4 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--smk-accent)]">
              {category.label}
            </h2>
            <div className="pt-4">
              <FaqAccordion items={category.items} />
            </div>
          </section>
        ))}
      </div>

      <div className="smk-panel mt-10 rounded-[28px] px-6 py-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <p className="text-base font-semibold text-[color:var(--smk-text)]">
          Deine Frage ist nicht dabei?
        </p>
        <p className="mt-1 text-sm text-[color:var(--smk-text-muted)]">
          Unser Support hilft dir direkt weiter.
        </p>
        <Link
          href="/pages/contact"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-[color:var(--smk-accent)] px-6 text-sm font-semibold text-[color:var(--smk-bg)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--smk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--smk-bg)]"
        >
          Kontakt aufnehmen
        </Link>
      </div>
    </main>
  );
}
