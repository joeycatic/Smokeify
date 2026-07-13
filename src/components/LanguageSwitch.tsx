"use client";

import {
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_COOKIE_NAME,
  type Language,
} from "@/lib/language";
import { useState } from "react";

const OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "de", label: "DE" },
  { value: "en", label: "EN" },
];

type LanguageSwitchProps = {
  language: Language;
  compact?: boolean;
};

function persistLanguage(language: Language) {
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = language;
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
}
function Flag({ language }: { language: Language }) {
  if (language === "de") {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-5 overflow-hidden rounded-[4px] border border-black/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        style={{
          background:
            "linear-gradient(180deg,#111111 0 33.33%,#d12f2f 33.33% 66.66%,#f0c242 66.66% 100%)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative h-3.5 w-5 overflow-hidden rounded-[4px] border border-black/15 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
    >
      <span className="absolute inset-0 bg-[#012169]" />
      <span
        className="absolute left-1/2 top-1/2 h-[160%] w-[22%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white"
      />
      <span
        className="absolute left-1/2 top-1/2 h-[160%] w-[22%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white"
      />
      <span
        className="absolute left-1/2 top-1/2 h-[160%] w-[10%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#cf2e2e]"
      />
      <span
        className="absolute left-1/2 top-1/2 h-[160%] w-[10%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[#cf2e2e]"
      />
      <span className="absolute left-0 top-1/2 h-[5px] w-full -translate-y-1/2 bg-white" />
      <span className="absolute left-1/2 top-0 h-full w-[5px] -translate-x-1/2 bg-white" />
      <span className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-[#cf2e2e]" />
      <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-[#cf2e2e]" />
    </span>
  );
}

export default function LanguageSwitch({
  language,
  compact = false,
}: LanguageSwitchProps) {
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const activeLanguage = pendingLanguage ?? language;

  return (
    <div
      className={`inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)] ${
        compact
          ? "gap-0 border-white/8 bg-white/[0.02] p-1 shadow-none"
          : "gap-1 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.14)]"
      }`}
      role="group"
      aria-label="Language switch"
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === activeLanguage;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (option.value === activeLanguage) return;
              setPendingLanguage(option.value);
              persistLanguage(option.value);
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] ${
              compact ? "min-w-[3.7rem] px-2.5 py-[0.42rem]" : "min-w-[4.5rem]"
            } ${
              isActive
                ? compact
                  ? "bg-[color:var(--gv-lime)] text-[color:var(--gv-forest)] shadow-[0_6px_14px_rgba(31,95,63,0.2)]"
                  : "bg-[color:var(--gv-lime)] text-[color:var(--gv-forest)] shadow-[0_8px_18px_rgba(31,95,63,0.24)]"
                : "text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-text)]"
            }`}
            aria-pressed={isActive}
          >
            <Flag language={option.value} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
