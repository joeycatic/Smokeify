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
    <div className="divide-y divide-black/6">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-stone-900 sm:text-base">
                {item.question}
              </span>
              <ChevronDownIcon
                className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200 ${
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
                <p className="text-sm leading-relaxed text-stone-600">
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
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Häufige Fragen
        </h1>
        <p className="mt-3 text-base text-stone-500">
          Alles Wichtige rund um Bestellung, Versand und Indoor-Gartenbau.
        </p>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <section
            key={category.label}
            className="rounded-2xl border border-black/8 bg-white px-5 shadow-sm"
          >
            <h2 className="border-b border-black/6 py-4 text-xs font-bold uppercase tracking-widest text-emerald-800">
              {category.label}
            </h2>
            <FaqAccordion items={category.items} />
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-[#2f3e36] px-6 py-8 text-center text-white">
        <p className="text-base font-semibold">Deine Frage ist nicht dabei?</p>
        <p className="mt-1 text-sm text-white/70">
          Unser Support hilft dir direkt weiter.
        </p>
        <Link
          href="/pages/contact"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#2f3e36] transition hover:bg-white/90"
        >
          Kontakt aufnehmen
        </Link>
      </div>
    </main>
  );
}
