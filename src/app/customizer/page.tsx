"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCart } from "@/components/CartProvider";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";

type Option = {
  id: string;
  label: string;
  price: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
  outOfStock?: boolean;
  lowStock?: boolean;
  note?: string;
  size?: string;
  diameterMm?: number;
  diametersMm?: number[];
  variantId?: string;
  isSet?: boolean;
};

type StepId = "size" | "light" | "vent" | "extras" | "check";

type StepItem = {
  id: StepId;
  label: string;
  caption: string;
};

type CompatTone = "perfect" | "good" | "bad";

type ProductCardProps = {
  title: string;
  price: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
  outOfStock?: boolean;
  lowStock?: boolean;
  imageHeightClass?: string;
  badges?: string[];
  selected?: boolean;
  compatTone?: CompatTone;
  compatLabel?: string;
  reason?: string;
  onSelect?: () => void;
};

type FiltersBarProps = {
  title: string;
  subtitle?: string;
  chips?: Array<{ id: string; label: string }>;
  activeChipId?: string | null;
  onChipSelect?: (id: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

type SetupSidebarProps = {
  statusTone: CompatTone;
  statusLabel: string;
  items: Array<{
    id: StepId;
    title: string;
    price?: number | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
  }>;
  total: number;
  onEdit: (id: StepId) => void;
  onPrimary: () => void;
  onAddToCart: () => void;
  onCheckout: () => void;
  saving: boolean;
  saved: boolean;
  cartActionStatus: "idle" | "loading" | "ok" | "error";
  cartActionMessage: string;
};

type MobileSetupBottomBarProps = {
  total: number;
  selectedCount: number;
  onOpen: () => void;
};

const STEPS: StepItem[] = [
  { id: "size", label: "Zelt", caption: "Größe wählen" },
  { id: "light", label: "Licht", caption: "Licht finden" },
  { id: "vent", label: "Abluft", caption: "Luftführung" },
  { id: "extras", label: "Extras", caption: "Add-ons" },
  { id: "check", label: "Setup Check", caption: "Prüfen" },
];

const SIZE_OPTIONS: Option[] = [
  { id: "s", label: "60x60 cm (Starter)", price: 149 },
  { id: "m", label: "80x80 cm (Balanced)", price: 219 },
  { id: "l", label: "100x100 cm (Pro)", price: 299 },
];

const LIGHT_OPTIONS: Option[] = [
  { id: "led-200", label: "LED 200W", price: 169 },
  { id: "led-300", label: "LED 300W", price: 249 },
  { id: "led-400", label: "LED 400W", price: 329 },
];

const VENT_OPTIONS: Option[] = [
  { id: "vent-basic", label: "Basis-Abluft + Filter", price: 129 },
  { id: "vent-silent", label: "Leise Abluft + Filter", price: 189 },
];

const EXTRA_OPTIONS: Option[] = [
  { id: "timer", label: "Timer", price: 19 },
  { id: "hygro", label: "Hygrometer", price: 29 },
  { id: "fan", label: "Clip-Ventilator", price: 35 },
  { id: "tray", label: "Gießwanne", price: 22 },
];

const CUSTOMIZER_FAQ = [
  {
    question: "Wie finde ich die richtige Zeltgröße für mich?",
    answer:
      "Orientiere dich am verfügbaren Platz in deinem Anbaubereich und daran, wie viele Pflanzen du anbauen möchtest. Kleine Zelte (z.B. 60×60 cm) eignen sich für 1–2 Pflanzen und den Einstieg. Mittelgroße Zelte (80×80 bis 100×100 cm) bieten Platz für 4–6 Pflanzen und mehr Flexibilität bei Licht und Abluft. Achte außerdem auf die Höhe des Zelts – Pflanzen brauchen mindestens 30–40 cm Abstand zur Lichtquelle.",
  },
  {
    question: "Welches Licht passt zu meinem Pflanzenzelt?",
    answer:
      "Als Faustregel gilt: Für die Vegetationsphase benötigst du ca. 200–300 W/m², für die Blütephase 400–600 W/m² (bezogen auf die tatsächliche Leistungsaufnahme, nicht den Maximalwert). Der Konfigurator empfiehlt dir passende LEDs direkt zur gewählten Zeltgröße. Achte auch auf den PPFD-Wert des Leuchtmittels – je höher, desto mehr Lichtenergie kommt bei den Pflanzen an.",
  },
  {
    question: "Wie stark muss die Abluftanlage sein?",
    answer:
      "Die Abluft sollte das Luftvolumen deines Zelts mindestens 60× pro Stunde austauschen. Bei einem 100×100×200 cm Zelt (200 m³) brauchst du also mindestens einen Ventilator mit 200 m³/h. Mit Aktivkohlefilter plane 20–30 % Mehrleistung ein, da der Filter den Luftwiderstand erhöht. Der Konfigurator wählt automatisch eine passende Kombination aus Ventilator und Filter für dein Zelt.",
  },
  {
    question: "Was bedeuten die Kompatibilitäts-Hinweise?",
    answer:
      "Der Konfigurator prüft automatisch, ob Licht und Abluft zum gewählten Pflanzenzelt passen. Erscheint ein Hinweis, bedeutet das, dass die Kombination technisch funktioniert, aber möglicherweise nicht optimal ist – zum Beispiel wenn ein Ventilator für das gewählte Zelt überdimensioniert ist. Du kannst solche Kombinationen trotzdem in den Warenkorb legen.",
  },
  {
    question: "Welche Extras lohnen sich wirklich?",
    answer:
      "Ein digitales Thermo-/Hygrometer ist für jeden Indoor-Anbau unverzichtbar – du musst Temperatur und Luftfeuchtigkeit im Blick behalten. Eine Zeitschaltuhr für das Licht ist ebenfalls Pflicht, um den Tag-Nacht-Rhythmus zu automatisieren. CO₂-Messgeräte und pH-Meter sind besonders ab dem zweiten Anbaudurchgang sinnvoll. Gießwannen schützen deinen Boden vor Feuchtigkeit.",
  },
  {
    question: "Kann ich das Setup speichern und später kaufen?",
    answer:
      "Ja. Dein konfiguriertes Setup bleibt im Browser gespeichert, solange du die Seite nicht verlässt. Du kannst alle Produkte mit einem Klick in den Warenkorb legen und dann direkt zur Kasse gehen oder weiter shoppen. Einzelne Komponenten kannst du auch jederzeit direkt im Shop finden und separat bestellen.",
  },
  {
    question: "Kann ich einzelne Komponenten auch ohne Konfigurator kaufen?",
    answer:
      "Natürlich. Alle im Konfigurator enthaltenen Produkte sind auch einzeln in unserem Shop erhältlich. Wenn du gezielt nach einem Artikel suchst oder dein bestehendes Setup erweitern möchtest, kannst du direkt im Sortiment stöbern oder die Suche nutzen.",
  },
] as const;

function CustomizerFaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="mt-5 divide-y divide-black/[0.06]">
      {CUSTOMIZER_FAQ.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:opacity-80"
            >
              <span className="text-[15px] font-semibold" style={{ color: "#1a2a22" }}>
                {item.question}
              </span>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200"
                style={{
                  background: isOpen ? "#2f3e36" : "rgba(47,62,54,0.08)",
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1v8M1 5h8"
                    stroke={isOpen ? "#E4C56C" : "#2f3e36"}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-in-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="pb-4 text-sm leading-relaxed text-stone-600">
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

const CUSTOMIZER_FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CUSTOMIZER_FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

function formatPrice(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function StepHeader({
  activeStep,
  onStepChange,
  completedSteps,
  canAccessStep,
}: {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  completedSteps: Set<StepId>;
  canAccessStep: (step: StepId) => boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Record<StepId, HTMLButtonElement | null>>({
    size: null,
    light: null,
    vent: null,
    extras: null,
    check: null,
  });
  const progressCount = Math.min(completedSteps.size, STEPS.length);
  const stepDisplay = Math.max(1, progressCount);
  const activeTone = "#7aa38f";

  useEffect(() => {
    const node = stepRefs.current[activeStep];
    if (!node) return;
    node.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeStep]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-600">
            Konfigurator
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
            Pflanzenzelt-Konfigurator
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Stelle dein Setup zusammen und prüfe Passform, Preis und Status.
          </p>
        </div>
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
            <span>Fortschritt</span>
            <span>
              Schritt {stepDisplay} / {STEPS.length}
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-emerald-50">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                backgroundColor: activeTone,
                width: `${(progressCount / STEPS.length) * 100}%`,
              }}
            />
          </div>
          <div className="mt-4 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-2 shadow-inner overflow-hidden">
            <div className="no-scrollbar flex w-full overflow-x-auto overflow-y-visible py-1 pl-3 pr-8 scroll-pl-3 scroll-pr-8">
              <div ref={listRef} className="flex w-max items-center gap-2">
                {STEPS.map((step, index) => {
                  const isActive = step.id === activeStep;
                  const isCompleted = completedSteps.has(step.id);
                  const isCheckComplete =
                    step.id === "check" &&
                    completedSteps.has("size") &&
                    completedSteps.has("light") &&
                    completedSteps.has("vent");
                  const isLocked = !canAccessStep(step.id);
                  return (
                    <div
                      key={step.id}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isLocked) return;
                          onStepChange(step.id);
                        }}
                        disabled={isLocked}
                        ref={(el) => {
                          stepRefs.current[step.id] = el;
                        }}
                        className={`flex min-w-[96px] flex-col items-start justify-center rounded-full px-3 py-2 text-left transition sm:min-w-[120px] sm:px-4 sm:py-2.5 ${
                          isCompleted || isCheckComplete
                            ? "border border-emerald-700 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white shadow"
                            : "text-neutral-600"
                        } ${isActive && !isCompleted ? "ring-1 ring-neutral-300" : ""} ${
                          isLocked
                            ? "cursor-not-allowed opacity-50"
                            : "hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-200 hover:text-neutral-900"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[10px] sm:text-[11px] ${
                              isCompleted || isCheckComplete
                                ? "text-white/70"
                                : "text-neutral-400"
                            }`}
                          >
                            {index + 1}.
                          </span>
                          <span
                            className={`whitespace-nowrap text-[10px] font-semibold sm:text-[11px] ${
                              isCompleted || isCheckComplete
                                ? "text-white"
                                : "text-neutral-700"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {step.id !== "check" && (
                          <span
                            className={`text-[9px] sm:text-[10px] ${
                              isCompleted || isCheckComplete
                                ? "text-white/70"
                                : "text-neutral-400"
                            }`}
                          >
                            {step.label}
                          </span>
                        )}
                      </button>
                      {index < STEPS.length - 1 && (
                        <span className="hidden text-lg text-neutral-300 sm:inline">
                          ›
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FiltersBar({
  title,
  subtitle,
  chips,
  activeChipId,
  onChipSelect,
  searchValue,
  onSearchChange,
}: FiltersBarProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange && (
            <div className="relative">
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Suchen..."
                className="h-10 w-52 rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-700 outline-none transition focus:border-neutral-400"
              />
            </div>
          )}
        </div>
      </div>
      {chips && chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = chip.id === activeChipId;
            const hoverClasses = active
              ? ""
              : "hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-100 hover:border-neutral-300";
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChipSelect?.(chip.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${hoverClasses} ${
                  active
                    ? "border-emerald-700 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white shadow-sm"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReasonPopover({ reason }: { reason?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const canPortal = typeof document !== "undefined";
  const hasReason = Boolean(reason);

  useEffect(() => {
    if (!open || !canPortal || !hasReason) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0] ?? null;
    const last = focusable?.[focusable.length - 1] ?? null;
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousActive && previousActive.focus) previousActive.focus();
    };
  }, [open, canPortal]);
  if (!hasReason) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="text-xs font-semibold text-neutral-500 underline decoration-dotted"
        ref={triggerRef}
      >
        Warum?
      </button>
      {open &&
        canPortal &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Dialog schließen"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div
              role="dialog"
              aria-modal="true"
              ref={dialogRef}
              className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Nicht kompatibel (nicht empfohlen)
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Dieses Produkt passt nicht optimal zu deiner aktuellen
                    Auswahl (z. B. Zeltgröße/Leistung/Anschluss). Dadurch kann
                    es zu schlechterer Effizienz oder Problemen beim Setup
                    kommen.
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">
                    Du kannst den Artikel trotzdem auswählen und kaufen – wir
                    empfehlen jedoch eine kompatible Alternative.
                  </p>
                  {reason && (
                    <p className="mt-3 text-xs text-neutral-500">{reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xl text-neutral-500"
                  aria-label="Schließen"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-700 hover:shadow-sm"
                >
                  Verstanden
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ProductCard({
  title,
  price,
  imageUrl,
  imageAlt,
  outOfStock,
  lowStock,
  imageHeightClass = "h-60 sm:h-32",
  badges = [],
  selected,
  compatTone,
  compatLabel,
  reason,
  onSelect,
}: ProductCardProps) {
  const toneStyles: Record<CompatTone, string> = {
    perfect: "border-emerald-200 bg-emerald-50 text-emerald-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bad: "border-orange-200 bg-orange-50 text-orange-700",
  };
  const isDisabled = Boolean(outOfStock);
  const hoverStyles = selected
    ? ""
    : "hover:border-neutral-300 hover:shadow-md hover:bg-neutral-50 hover:-translate-y-0.5";

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (isDisabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      className={`group relative flex h-full flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f3e36]/40 ${
        selected
          ? "border-emerald-700 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white shadow-md"
          : "border-neutral-200 bg-white text-neutral-800"
      } ${compatTone === "bad" ? "opacity-70" : "opacity-100"} ${
        isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${hoverStyles}`}
      aria-disabled={isDisabled}
    >
      {imageUrl ? (
        (() => {
          return (
            <div
              className={`relative mb-4 w-full overflow-hidden rounded-xl bg-white ${imageHeightClass}`}
            >
              {lowStock && !outOfStock && (
                <span className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-4 py-2 text-[13px] font-semibold text-white shadow sm:px-2 sm:py-1 sm:text-[11px]">
                  Niedriger Bestand
                </span>
              )}
              <img
                src={imageUrl}
                alt={imageAlt ?? title}
                className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            </div>
          );
        })()
      ) : (
        <div
          className={`mb-4 w-full rounded-xl bg-white ${imageHeightClass}`}
        />
      )}
      <div className="flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold">{title}</p>
          {selected && (
            <span className="whitespace-nowrap rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
              Selected
            </span>
          )}
        </div>
        <p
          className={`mt-2 text-sm ${
            selected ? "text-neutral-200" : "text-neutral-600"
          }`}
        >
          {formatPrice(price)}
        </p>
        {badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.slice(0, 3).map((badge) => (
              <span
                key={badge}
                className={`rounded-full border px-4 py-2 text-[13px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${
                  selected
                    ? "border-white/40 text-white/80"
                    : "border-neutral-200 text-neutral-500"
                }`}
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      {(compatTone || compatLabel || outOfStock) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {outOfStock ? (
            <span
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${
                selected
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              Ausverkauft
            </span>
          ) : null}
          {compatTone && (
            <span
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${
                selected
                  ? "border-white/30 bg-white/10 text-white"
                  : toneStyles[compatTone]
              }`}
            >
              {compatLabel ?? "Passend"}
            </span>
          )}
          <ReasonPopover reason={reason} />
        </div>
      )}
    </div>
  );
}

function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}

function SetupSidebar({
  statusTone,
  statusLabel,
  items,
  total,
  onEdit,
  onPrimary,
  onAddToCart,
  onCheckout,
  saving,
  saved,
  cartActionStatus,
  cartActionMessage,
}: SetupSidebarProps) {
  const toneStyles: Record<CompatTone, string> = {
    perfect: "border-emerald-200 bg-emerald-50 text-emerald-700",
    good: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Dein Setup</p>
          <p className="text-sm text-neutral-500">Status & Preis im Blick</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            toneStyles[statusTone]
          }`}
        >
          <span>{statusTone === "perfect" ? "✓" : "!"}</span>
          <span>{statusLabel}</span>
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
            Noch keine Auswahl.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.id}-${item.title}`}
              className="w-full max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="flex w-full max-w-full items-center justify-between gap-3 overflow-hidden">
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white text-xs text-neutral-400">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt ?? item.title}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      "▢"
                    )}
                  </span>
                  <div className="max-w-[11rem] min-w-0 flex-1 overflow-hidden">
                    <div
                      className="max-w-[11rem] truncate text-sm font-semibold text-neutral-800 sm:max-w-[14rem]"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    {typeof item.price === "number" && (
                      <div className="text-xs text-neutral-500">
                        {formatPrice(item.price)}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="flex-none text-xs font-semibold text-neutral-500 underline"
                >
                  Ändern
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Zwischensumme</span>
          <span>{formatPrice(total)}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Preis ist eine Schätzung. Produkte werden später verknüpft.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={onPrimary}
          disabled={saving}
          className="w-full rounded-xl bg-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:-translate-y-0.5 hover:bg-neutral-300 hover:shadow-sm disabled:opacity-60"
        >
          {saving ? "Speichern..." : saved ? "Gespeichert" : "Setup speichern"}
        </button>
        {saved && (
          <p className="text-xs text-emerald-700">Setup gespeichert.</p>
        )}
        <button
          type="button"
          onClick={onAddToCart}
          className="w-full rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-black/70 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          In den Warenkorb
        </button>
        <button
          type="button"
          onClick={onCheckout}
          className="w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Zur Kasse
        </button>
        <PaymentMethodLogos
          className="justify-center gap-[2px] sm:gap-2"
          pillClassName="h-7 px-2 border-black/10 bg-white sm:h-8 sm:px-3"
          logoClassName="h-4 sm:h-5"
        />
        {cartActionMessage && (
          <p
            className={`text-xs ${
              cartActionStatus === "error"
                ? "text-red-600"
                : cartActionStatus === "ok"
                  ? "text-emerald-700"
                  : "text-neutral-500"
            }`}
          >
            {cartActionMessage}
          </p>
        )}
      </div>
    </aside>
  );
}

function MobileSetupBottomBar({
  total,
  selectedCount,
  onOpen,
}: MobileSetupBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 z-40 w-full border-t border-neutral-200 bg-white px-4 py-3 shadow-lg lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between rounded-full bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-emerald-900/25"
      >
        <span>Setup ansehen ({selectedCount})</span>
        <span>{formatPrice(total)}</span>
      </button>
    </div>
  );
}

export default function CustomizerPage() {
  const { status } = useSession();
  const sessionLoading = status === "loading";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToCart } = useCart();
  const hasCustomizerAccess = true;
  const [sizeId, setSizeId] = useState("");
  const [lightIds, setLightIds] = useState<string[]>([]);
  const [ventIds, setVentIds] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sizeOptions, setSizeOptions] = useState<Option[]>([]);
  const [sizeLoading, setSizeLoading] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [sizeGroupKey, setSizeGroupKey] = useState<string | null>(null);
  const [lightOptions, setLightOptions] = useState<Option[]>([]);
  const [lightLoading, setLightLoading] = useState(false);
  const [lightError, setLightError] = useState("");
  const [ventOptions, setVentOptions] = useState<Option[]>([]);
  const [ventLoading, setVentLoading] = useState(false);
  const [ventError, setVentError] = useState("");
  const [extrasWateringOptions, setExtrasWateringOptions] = useState<Option[]>(
    [],
  );
  const [extrasSeedlingOptions, setExtrasSeedlingOptions] = useState<Option[]>(
    [],
  );
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [extrasError, setExtrasError] = useState("");
  const [activeStep, setActiveStep] = useState<StepId>("size");
  const [sizeSearch, setSizeSearch] = useState("");
  const [lightSearch, setLightSearch] = useState("");
  const [ventSearch, setVentSearch] = useState("");
  const [extrasSearch, setExtrasSearch] = useState("");
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [nextButtonVisible, setNextButtonVisible] = useState(false);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const nextButtonRefs = useRef<Record<StepId, HTMLButtonElement | null>>({
    size: null,
    light: null,
    vent: null,
    extras: null,
    check: null,
  });
  const [cartActionStatus, setCartActionStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [cartActionMessage, setCartActionMessage] = useState("");
  const appliedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const queryKey = searchParams.toString();
    if (appliedQueryRef.current === queryKey) return;
    const sizeParam = searchParams.get("sizeId");
    const lightParam = searchParams.get("lightId");
    const ventParam = searchParams.get("ventId");
    const extrasParam = searchParams.get("extras");
    const sourceParam = searchParams.get("source");

    if (sizeParam) setSizeId(sizeParam);
    if (sourceParam === "pdp") {
      setLightIds([]);
      setVentIds([]);
      setExtras([]);
    } else if (lightParam) {
      setLightIds(
        lightParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    }
    if (sourceParam !== "pdp" && ventParam) {
      setVentIds(
        ventParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    }
    if (sourceParam !== "pdp" && extrasParam) {
      setExtras(
        extrasParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    }
    if (sourceParam === "pdp") {
      setActiveStep("size");
    } else if (lightParam || ventParam || extrasParam) {
      setActiveStep("check");
    } else if (sizeParam) {
      setActiveStep("size");
    }
    appliedQueryRef.current = queryKey;
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setSizeLoading(true);
    setLightLoading(true);
    setVentLoading(true);
    setExtrasLoading(true);
    setSizeError("");
    setLightError("");
    setVentError("");
    setExtrasError("");

    fetch(
      "/api/customizer/options?categories=zelte,Licht,Luft,Bewaesserung,Anzucht",
    )
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Konnte Produkte nicht laden.");
        }
        return (await res.json()) as {
          optionsByCategory?: Record<string, Option[]>;
        };
      })
      .then((data) => {
        if (!active) return;
        const optionsByCategory = data.optionsByCategory ?? {};
        setSizeOptions(optionsByCategory.zelte ?? []);
        setLightOptions(optionsByCategory.licht ?? []);
        setVentOptions(optionsByCategory.luft ?? []);
        setExtrasWateringOptions(optionsByCategory.bewaesserung ?? []);
        setExtrasSeedlingOptions(optionsByCategory.anzucht ?? []);
      })
      .catch((err: Error) => {
        if (!active) return;
        const message = err.message || "Konnte Produkte nicht laden.";
        setSizeError(message);
        setLightError(message);
        setVentError(message);
        setExtrasError(message);
      })
      .finally(() => {
        if (!active) return;
        setSizeLoading(false);
        setLightLoading(false);
        setVentLoading(false);
        setExtrasLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lightOptions.length) return;
    setLightIds((prev) =>
      prev.filter((id) => lightOptions.some((opt) => opt.id === id)),
    );
  }, [lightOptions]);

  useEffect(() => {
    if (!ventOptions.length) return;
    setVentIds((prev) =>
      prev.filter((id) => ventOptions.some((opt) => opt.id === id)),
    );
  }, [ventOptions]);

  const extrasOptions = useMemo(
    () => [...extrasWateringOptions, ...extrasSeedlingOptions],
    [extrasWateringOptions, extrasSeedlingOptions],
  );

  useEffect(() => {
    if (!extrasOptions.length) return;
    setExtras((prev) =>
      prev.filter((id) => extrasOptions.some((opt) => opt.id === id)),
    );
  }, [extrasOptions]);

  const sizeBase = sizeOptions.length ? sizeOptions : SIZE_OPTIONS;
  const lightBase = lightOptions.length ? lightOptions : LIGHT_OPTIONS;
  const ventBase = ventOptions.length ? ventOptions : VENT_OPTIONS;
  const extrasBase = extrasOptions.length ? extrasOptions : EXTRA_OPTIONS;

  const selectedSize = sizeBase.find((o) => o.id === sizeId);
  const selectedLightOptions = lightBase.filter((o) => lightIds.includes(o.id));
  const selectedVentOptions = ventBase.filter((o) => ventIds.includes(o.id));

  const parseSize = (value?: string) => {
    if (!value) return null;
    const matches = value.match(/(\d+(?:[.,]\d+)?)/g);
    if (!matches || matches.length < 2) return null;
    const numbers = matches
      .map((match) => Number(match.replace(",", ".")))
      .filter((num) => Number.isFinite(num));
    if (numbers.length < 2) return null;
    return { width: numbers[0], depth: numbers[1], height: numbers[2] ?? null };
  };

  const compareSizes = (a?: string, b?: string) => {
    const aSize = parseSize(a);
    const bSize = parseSize(b);
    if (aSize && bSize) {
      if (aSize.width !== bSize.width) return aSize.width - bSize.width;
      if (aSize.depth !== bSize.depth) return aSize.depth - bSize.depth;
      if ((aSize.height ?? 0) !== (bSize.height ?? 0)) {
        return (aSize.height ?? 0) - (bSize.height ?? 0);
      }
      return 0;
    }
    if (aSize && !bSize) return -1;
    if (!aSize && bSize) return 1;
    return (a ?? "").localeCompare(b ?? "");
  };

  const isCompleteSetOption = (opt: Option) => Boolean(opt.isSet);

  const sizeKeyFrom = (value?: string) => {
    const parsed = parseSize(value);
    if (!parsed) return null;
    const base = `${parsed.width}x${parsed.depth}`;
    return parsed.height ? `${base}x${parsed.height}` : base;
  };

  const sizeGroups = useMemo(() => {
    const groups = new Map<string, Option[]>();
    sizeOptions.forEach((opt) => {
      if (isCompleteSetOption(opt)) return;
      const key = sizeKeyFrom(opt.size ?? opt.label);
      if (!key) return;
      const list = groups.get(key) ?? [];
      list.push(opt);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort((a, b) =>
      compareSizes(a[0], b[0]),
    );
  }, [sizeOptions]);

  const sizeGroupsWithStock = useMemo(
    () =>
      sizeGroups.filter(([, options]) =>
        options.some((opt) => !opt.outOfStock),
      ),
    [sizeGroups],
  );

  useEffect(() => {
    if (!sizeOptions.length) return;
    const availableGroups = sizeGroupsWithStock;
    if (!availableGroups.length) return;
    const firstGroupKey =
      availableGroups[0]?.[0] ??
      sizeKeyFrom(sizeOptions[0].size ?? sizeOptions[0].label);
    if (!firstGroupKey) return;
    const selectedOption = sizeOptions.find((opt) => opt.id === sizeId);
    const selectedGroupKey = sizeKeyFrom(
      selectedOption?.size ?? selectedOption?.label,
    );
    if (selectedGroupKey && sizeGroupKey !== selectedGroupKey) {
      setSizeGroupKey(selectedGroupKey);
    } else {
      setSizeGroupKey((prev) => prev ?? firstGroupKey);
    }
    const resolvedGroupKey = selectedGroupKey ?? sizeGroupKey ?? firstGroupKey;
    const groupOptions =
      sizeGroups.find(([key]) => key === resolvedGroupKey)?.[1] ?? sizeOptions;
    setSizeId((prev) => {
      if (!prev) return prev;
      const selected = sizeOptions.find((opt) => opt.id === prev);
      if (selected && isCompleteSetOption(selected)) return "";
      if (!groupOptions.some((opt) => opt.id === prev)) return "";
      return prev;
    });
  }, [sizeGroupKey, sizeGroups, sizeGroupsWithStock, sizeOptions]);

  const tentSize = parseSize(selectedSize?.size ?? selectedSize?.label);
  const tentDiameters = selectedSize?.diametersMm ?? [];

  const isLightOptionCompatible = (opt: Option) => {
    if (!tentSize) return true;
    const optSize = parseSize(opt.size ?? opt.label);
    if (!optSize) return true;
    return optSize.width <= tentSize.width && optSize.depth <= tentSize.depth;
  };

  const isVentOptionCompatible = (opt: Option) => {
    if (tentDiameters.length === 0) return true;
    if (!opt.diameterMm) return true;
    return tentDiameters.includes(opt.diameterMm);
  };

  const lightCompatible =
    selectedLightOptions.length > 0 &&
    selectedLightOptions.every((opt) => isLightOptionCompatible(opt));
  const airCompatible =
    selectedVentOptions.length > 0 &&
    selectedVentOptions.every((opt) => isVentOptionCompatible(opt));

  const sizeBaseOptions = sizeBase.filter((opt) => !isCompleteSetOption(opt));
  const lightBaseOptions = lightBase;
  const ventBaseOptions = ventBase;
  const extrasBaseOptions = extrasBase;

  const extrasTotal = useMemo(() => {
    return extras
      .map((id) => extrasBaseOptions.find((o) => o.id === id)?.price ?? 0)
      .reduce((a, b) => a + b, 0);
  }, [extras, extrasBaseOptions]);

  const total =
    (selectedSize?.price ?? 0) +
    selectedLightOptions.reduce((sum, opt) => sum + (opt.price ?? 0), 0) +
    selectedVentOptions.reduce((sum, opt) => sum + (opt.price ?? 0), 0) +
    extrasTotal;

  const scrollToStep = (stepId: StepId) => {
    setActiveStep(stepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setupStatusTone: CompatTone =
    lightCompatible && airCompatible ? "perfect" : "bad";
  const setupStatusLabel =
    lightCompatible && airCompatible ? "Alles passt" : "Check erforderlich";

  const canProceedToLight = Boolean(sizeId);
  const canProceedToVent = Boolean(sizeId && lightIds.length > 0);
  const canProceedToExtras = Boolean(
    sizeId && lightIds.length > 0 && ventIds.length > 0,
  );
  const canProceedToCheck = Boolean(
    sizeId || lightIds.length > 0 || ventIds.length > 0 || extras.length > 0,
  );

  const nextStepFor = (stepId: StepId): StepId | null => {
    switch (stepId) {
      case "size":
        return "light";
      case "light":
        return "vent";
      case "vent":
        return "extras";
      case "extras":
        return "check";
      default:
        return null;
    }
  };

  const canAccessStep = (stepId: StepId) => {
    switch (stepId) {
      case "size":
        return true;
      case "light":
        return canProceedToLight;
      case "vent":
        return canProceedToVent;
      case "extras":
        return canProceedToExtras;
      case "check":
        return canProceedToCheck;
      default:
        return false;
    }
  };

  const lightLocked = !canProceedToLight;
  const ventLocked = !canProceedToVent;
  const extrasLocked = !canProceedToExtras;
  const checkLocked = !canProceedToCheck;

  const selectedCount =
    (selectedSize ? 1 : 0) + lightIds.length + ventIds.length + extras.length;

  const nextStep = nextStepFor(activeStep);
  const nextButtonRef = nextButtonRefs.current[activeStep];
  const canProceedToNextStep = nextStep ? canAccessStep(nextStep) : false;

  useEffect(() => {
    const target = nextButtonRefs.current[activeStep];
    if (!target) {
      setNextButtonVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNextButtonVisible(entry.isIntersecting);
      },
      { threshold: 0.6 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeStep]);

  useEffect(() => {
    const onScroll = () => setHasScrolledDown(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sizeGroupOptions =
    sizeGroupKey === "all"
      ? sizeBaseOptions
      : (sizeGroups.find(([key]) => key === sizeGroupKey)?.[1] ??
        sizeBaseOptions);

  const sortByStock = (items: Option[]) =>
    [...items].sort(
      (a, b) => Number(Boolean(a.outOfStock)) - Number(Boolean(b.outOfStock)),
    );

  const sortSizesByStock = (items: Option[]) =>
    [...items].sort((a, b) => {
      const aOos = Boolean(a.outOfStock);
      const bOos = Boolean(b.outOfStock);
      if (aOos !== bOos) return aOos ? 1 : -1;
      return compareSizes(a.size ?? a.label, b.size ?? b.label);
    });

  const sortByFitThenStock = (
    items: Option[],
    isCompatible: (opt: Option) => boolean,
  ) =>
    [...items].sort((a, b) => {
      const aOos = Boolean(a.outOfStock);
      const bOos = Boolean(b.outOfStock);
      if (aOos !== bOos) return aOos ? 1 : -1;
      const aBad = !isCompatible(a);
      const bBad = !isCompatible(b);
      if (aBad !== bBad) return aBad ? 1 : -1;
      return 0;
    });

  const filteredSizeOptions = sortSizesByStock(
    sizeGroupOptions.filter((opt) =>
      opt.label.toLowerCase().includes(sizeSearch.toLowerCase()),
    ),
  );

  const filteredLightOptions = sortByFitThenStock(
    lightBaseOptions.filter((opt) =>
      opt.label.toLowerCase().includes(lightSearch.toLowerCase()),
    ),
    isLightOptionCompatible,
  );

  const filteredVentOptions = sortByFitThenStock(
    ventBaseOptions.filter((opt) =>
      opt.label.toLowerCase().includes(ventSearch.toLowerCase()),
    ),
    isVentOptionCompatible,
  );

  const filteredExtras = extrasBaseOptions.filter((opt) =>
    opt.label.toLowerCase().includes(extrasSearch.toLowerCase()),
  );
  const filteredWateringExtras = extrasWateringOptions.filter((opt) =>
    opt.label.toLowerCase().includes(extrasSearch.toLowerCase()),
  );
  const filteredSeedlingExtras = extrasSeedlingOptions.filter((opt) =>
    opt.label.toLowerCase().includes(extrasSearch.toLowerCase()),
  );

  const extrasSelectedOptions = extrasBaseOptions.filter((opt) =>
    extras.includes(opt.id),
  );
  const setupItems = [
    ...(selectedSize
      ? [
          {
            id: "size" as StepId,
            title: selectedSize.label,
            price: selectedSize.price,
            imageUrl: selectedSize.imageUrl ?? null,
            imageAlt: selectedSize.imageAlt ?? selectedSize.label,
          },
        ]
      : []),
    ...selectedLightOptions.map((opt) => ({
      id: "light" as StepId,
      title: opt.label,
      price: opt.price,
      imageUrl: opt.imageUrl ?? null,
      imageAlt: opt.imageAlt ?? opt.label,
    })),
    ...selectedVentOptions.map((opt) => ({
      id: "vent" as StepId,
      title: opt.label,
      price: opt.price,
      imageUrl: opt.imageUrl ?? null,
      imageAlt: opt.imageAlt ?? opt.label,
    })),
    ...extrasSelectedOptions.map((opt) => ({
      id: "extras" as StepId,
      title: opt.label,
      price: opt.price,
      imageUrl: opt.imageUrl ?? null,
      imageAlt: opt.imageAlt ?? opt.label,
    })),
  ];

  const getOptionBadges = (opt: Option) => {
    const badges: string[] = [];
    if (opt.size) badges.push(opt.size);
    if (!opt.size && opt.diameterMm) badges.push(`Ø ${opt.diameterMm} mm`);
    if (opt.diametersMm && opt.diametersMm.length > 0) {
      badges.push(`Ø ${opt.diametersMm.join(" / ")} mm`);
    }
    if (opt.note) badges.push(opt.note);
    return badges;
  };

  const handleAddToCart = async (mode: "cart" | "checkout") => {
    if (cartActionStatus === "loading") return;
    if (!canProceedToCheck) {
      setCartActionStatus("error");
      setCartActionMessage("Bitte mindestens einen Artikel auswählen.");
      return;
    }
    const selectedOptions = [
      ...(selectedSize ? [selectedSize] : []),
      ...selectedLightOptions,
      ...selectedVentOptions,
      ...extrasSelectedOptions,
    ];
    const missingVariant = selectedOptions.find((opt) => !opt.variantId);
    if (missingVariant) {
      setCartActionStatus("error");
      setCartActionMessage(
        "Diese Auswahl kann nicht in den Warenkorb gelegt werden.",
      );
      return;
    }
    setCartActionStatus("loading");
    setCartActionMessage(
      mode === "checkout"
        ? "Bereite Checkout vor..."
        : "Warenkorb wird aktualisiert...",
    );
    try {
      for (const opt of selectedOptions) {
        await addToCart(opt.variantId as string, 1);
      }
      setCartActionStatus("ok");
      setCartActionMessage(
        mode === "checkout"
          ? "Weiterleitung zur Kasse..."
          : "Artikel zum Warenkorb hinzugefügt.",
      );
      if (mode === "checkout") {
        router.push("/cart?startCheckout=1");
      } else {
        router.push("/cart");
      }
    } catch {
      setCartActionStatus("error");
      setCartActionMessage("Konnte Artikel nicht in den Warenkorb legen.");
    }
  };

  if (!hasCustomizerAccess && !sessionLoading) {
    const previewSize = SIZE_OPTIONS[1];
    const previewLight = LIGHT_OPTIONS[1];
    const previewVent = VENT_OPTIONS[0];
    const previewExtras = [EXTRA_OPTIONS[0], EXTRA_OPTIONS[2]];
    const previewTotal =
      (previewSize?.price ?? 0) +
      (previewLight?.price ?? 0) +
      (previewVent?.price ?? 0) +
      previewExtras.reduce((sum, opt) => sum + opt.price, 0);

    return (
      <PageLayout>
        <div className="mx-auto w-full max-w-7xl px-0.5 sm:px-1 py-12 text-stone-800">
          <div className="rounded-2xl border border-[#E4C56C]/70 bg-white p-8 shadow-[0_20px_50px_rgba(58,75,65,0.18)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-widest text-[#2f3e36]">
                  CUSTOMIZER
                </p>
                <h1
                  className="mt-2 text-4xl font-bold"
                  style={{ color: "#2f3e36" }}
                >
                  Demnächst verfügbar
                </h1>
                <p className="mt-3 text-sm text-stone-600">
                  Unser interaktiver Setup-Builder ist bald live. Bis dahin
                  kannst du hier einen Ausblick auf die Konfiguration sehen.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E4C56C] bg-[#E4C56C]/40 px-3 py-1 text-xs font-semibold text-[#2f3e36]">
                  Vorschau aktiv
                </div>
              </div>
              <div className="rounded-xl border border-[#E4C56C]/60 bg-[#f9f4dd] p-5">
                <p className="text-xs font-semibold tracking-widest text-[#2f3e36]">
                  WAS KOMMT
                </p>
                <ul className="mt-3 space-y-2 text-sm text-stone-600">
                  <li>Live-Preis-Updates</li>
                  <li>Setup speichern & teilen</li>
                  <li>Empfehlungen pro Raumgroesse</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-[#E4C56C]/60 bg-white p-6 shadow-[0_18px_40px_rgba(58,75,65,0.16)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-widest text-[#2f3e36]">
                PREVIEW
              </p>
              <span className="text-xs font-semibold text-stone-500">
                Nicht interaktiv
              </span>
            </div>

            <div className="pointer-events-none select-none">
              <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-6">
                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      1. ZELT-GRÖSSE
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {SIZE_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewSize?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      2. LICHT
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {LIGHT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewLight?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      3. ABLUFT
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {VENT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewVent?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      4. EXTRAS
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {EXTRA_OPTIONS.map((opt) => {
                        const active = previewExtras.some(
                          (extra) => extra.id === opt.id,
                        );
                        return (
                          <div
                            key={opt.id}
                            className={`rounded-lg border px-4 py-3 text-left ${
                              active
                                ? "border-[#3a4b41] bg-[#E4C56C]/30 text-[#2f3e36]"
                                : "border-black/10 bg-white"
                            }`}
                          >
                            <div className="text-sm font-semibold">
                              {opt.label}
                            </div>
                            <div className="text-xs opacity-80">
                              {formatPrice(opt.price)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <aside className="rounded-xl border border-black/10 bg-white p-6 h-fit">
                  <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                    DEIN SETUP
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Zelt</span>
                      <span>{previewSize?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Licht</span>
                      <span>{previewLight?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abluft</span>
                      <span>{previewVent?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Extras</span>
                      <span>{previewExtras.length} gewählt</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-black/10 pt-4">
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Gesamt</span>
                      <span>{formatPrice(previewTotal)}</span>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      Vorschau: Preise können später abweichen.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const handleSave = async () => {
    if (status !== "authenticated") {
      await signIn();
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedSize?.label ?? "Setup"} / ${
            selectedLightOptions.map((opt) => opt.label).join(", ") ?? ""
          }`.trim(),
          data: {
            sizeId,
            lightId: lightIds,
            ventId: ventIds,
            extras,
            total,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto w-full max-w-7xl px-0.5 sm:px-1 pb-20 pt-8 text-stone-800">
        <StepHeader
          activeStep={activeStep}
          onStepChange={scrollToStep}
          completedSteps={
            new Set<StepId>([
              ...(sizeId ? (["size"] as StepId[]) : []),
              ...(lightIds.length ? (["light"] as StepId[]) : []),
              ...(ventIds.length ? (["vent"] as StepId[]) : []),
              ...(extras.length ? (["extras"] as StepId[]) : []),
            ])
          }
          canAccessStep={canAccessStep}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-start lg:overflow-visible">
          <div className="space-y-8">
            {activeStep === "size" && (
              <section id="step-size" className="space-y-6">
                <FiltersBar
                  title="1. Zelt"
                  subtitle="Größe wählen & filtern"
                  chips={[
                    { id: "all", label: "Alle Zelte" },
                    ...sizeGroupsWithStock.map(([key]) => ({
                      id: key,
                      label: key,
                    })),
                  ]}
                  activeChipId={sizeGroupKey}
                  onChipSelect={(key) => {
                    setSizeGroupKey(key);
                  }}
                  searchValue={sizeSearch}
                  onSearchChange={setSizeSearch}
                />

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {sizeError && (
                    <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {sizeError}
                    </p>
                  )}
                  {sizeLoading || sessionLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {[...Array(3)].map((_, index) => (
                        <div
                          key={`size-skeleton-${index}`}
                          className="h-[260px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
                        />
                      ))}
                    </div>
                  ) : sizeOptions.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      Keine Zelte gefunden.
                    </p>
                  ) : (
                    <ProductGrid>
                      {filteredSizeOptions.map((opt) => (
                        <ProductCard
                          key={opt.id}
                          title={opt.label}
                          price={opt.price}
                          imageUrl={opt.imageUrl ?? null}
                          imageAlt={opt.imageAlt ?? opt.label}
                          imageHeightClass="h-72 sm:h-52 lg:h-64 xl:h-72"
                          outOfStock={opt.outOfStock}
                          lowStock={opt.lowStock}
                          badges={getOptionBadges(opt)}
                          selected={sizeId === opt.id}
                          onSelect={() =>
                            setSizeId((prev) => (prev === opt.id ? "" : opt.id))
                          }
                        />
                      ))}
                    </ProductGrid>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => scrollToStep("light")}
                    disabled={!canProceedToLight}
                    ref={(el) => {
                      nextButtonRefs.current.size = el;
                    }}
                    className="rounded-full bg-[#2f3e36] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    Nächster Schritt
                  </button>
                </div>
              </section>
            )}

            {activeStep === "light" && (
              <section id="step-light" className="space-y-6">
                <FiltersBar
                  title="2. Licht"
                  subtitle="Passend zur Zelt-Größe"
                  searchValue={lightSearch}
                  onSearchChange={setLightSearch}
                />

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {lightLocked && (
                    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Bitte zuerst eine Zeltgröße auswählen.
                    </p>
                  )}
                  <div
                    className={
                      lightLocked ? "pointer-events-none opacity-60" : ""
                    }
                  >
                    {lightError && (
                      <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {lightError}
                      </p>
                    )}
                    {lightLoading || sessionLoading ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {[...Array(3)].map((_, index) => (
                          <div
                            key={`light-skeleton-${index}`}
                            className="h-[220px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
                          />
                        ))}
                      </div>
                    ) : filteredLightOptions.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        Kein Licht gefunden.
                      </p>
                    ) : (
                      <>
                        <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                          <span className="font-semibold text-neutral-900">
                            Top Produkte
                          </span>{" "}
                          für dein Setup
                        </div>
                        <ProductGrid>
                          {filteredLightOptions.map((opt) => {
                            const compatible = isLightOptionCompatible(opt);
                            return (
                              <ProductCard
                                key={opt.id}
                                title={opt.label}
                                price={opt.price}
                                imageUrl={opt.imageUrl ?? null}
                                imageAlt={opt.imageAlt ?? opt.label}
                                outOfStock={opt.outOfStock}
                                lowStock={opt.lowStock}
                                badges={getOptionBadges(opt)}
                                selected={lightIds.includes(opt.id)}
                                compatTone={compatible ? "good" : "bad"}
                                compatLabel={
                                  compatible ? "Passt" : "Nicht empfohlen"
                                }
                                reason={
                                  compatible
                                    ? undefined
                                    : "Nicht passend zur Zelt-Größe."
                                }
                                onSelect={() =>
                                  setLightIds((prev) =>
                                    prev.includes(opt.id)
                                      ? prev.filter((id) => id !== opt.id)
                                      : [...prev, opt.id],
                                  )
                                }
                              />
                            );
                          })}
                        </ProductGrid>
                      </>
                    )}
                    {!lightCompatible && selectedSize && (
                      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Das ausgewählte Licht passt nicht zur Zelt-Größe.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => scrollToStep("size")}
                    className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-50"
                  >
                    Letzter Schritt
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToStep("vent")}
                    disabled={!canProceedToVent}
                    ref={(el) => {
                      nextButtonRefs.current.light = el;
                    }}
                    className="rounded-full bg-[#2f3e36] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    Nächster Schritt
                  </button>
                </div>
              </section>
            )}

            {activeStep === "vent" && (
              <section id="step-vent" className="space-y-6">
                <FiltersBar
                  title="3. Abluft"
                  subtitle="Durchmesser & Luftflow"
                  searchValue={ventSearch}
                  onSearchChange={setVentSearch}
                />

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {ventLocked && (
                    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Bitte zuerst ein Licht auswählen.
                    </p>
                  )}
                  <div
                    className={
                      ventLocked ? "pointer-events-none opacity-60" : ""
                    }
                  >
                    {ventError && (
                      <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {ventError}
                      </p>
                    )}
                    {ventLoading || sessionLoading ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {[...Array(2)].map((_, index) => (
                          <div
                            key={`vent-skeleton-${index}`}
                            className="h-[220px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
                          />
                        ))}
                      </div>
                    ) : filteredVentOptions.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        Keine Abluft gefunden.
                      </p>
                    ) : (
                      <ProductGrid>
                        {filteredVentOptions.map((opt) => {
                          const compatible = isVentOptionCompatible(opt);
                          return (
                            <ProductCard
                              key={opt.id}
                              title={opt.label}
                              price={opt.price}
                              imageUrl={opt.imageUrl ?? null}
                              imageAlt={opt.imageAlt ?? opt.label}
                              imageHeightClass="h-64 sm:h-44"
                              outOfStock={opt.outOfStock}
                              lowStock={opt.lowStock}
                              badges={getOptionBadges(opt)}
                              selected={ventIds.includes(opt.id)}
                              compatTone={compatible ? "good" : "bad"}
                              compatLabel={
                                compatible ? "Passt" : "Nicht empfohlen"
                              }
                              reason={
                                compatible
                                  ? undefined
                                  : "Durchmesser passt nicht."
                              }
                              onSelect={() =>
                                setVentIds((prev) =>
                                  prev.includes(opt.id)
                                    ? prev.filter((id) => id !== opt.id)
                                    : [...prev, opt.id],
                                )
                              }
                            />
                          );
                        })}
                      </ProductGrid>
                    )}
                    {!airCompatible && selectedSize && (
                      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Die Abluft passt nicht zum Anschlussdurchmesser der
                        Pflanzenzelt.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => scrollToStep("light")}
                    className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-50"
                  >
                    Letzte Seite
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToStep("extras")}
                    disabled={!canProceedToExtras}
                    ref={(el) => {
                      nextButtonRefs.current.vent = el;
                    }}
                    className="rounded-full bg-[#2f3e36] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    Nächste Seite
                  </button>
                </div>
              </section>
            )}

            {activeStep === "extras" && (
              <section id="step-extras" className="space-y-6">
                <FiltersBar
                  title="4. Extras"
                  subtitle="Optionales Zubehör"
                  searchValue={extrasSearch}
                  onSearchChange={setExtrasSearch}
                />

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {extrasLocked && (
                    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Bitte zuerst eine Abluft auswählen.
                    </p>
                  )}
                  <div
                    className={
                      extrasLocked ? "pointer-events-none opacity-60" : ""
                    }
                  >
                    {extrasLoading || sessionLoading ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {[...Array(6)].map((_, index) => (
                          <div
                            key={`extras-skeleton-${index}`}
                            className="h-[220px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
                          />
                        ))}
                      </div>
                    ) : extrasError ? (
                      <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {extrasError}
                      </p>
                    ) : (
                      <div className="space-y-8">
                        {[
                          {
                            id: "watering",
                            title: "Bewässerung",
                            options: filteredWateringExtras,
                          },
                          {
                            id: "seedling",
                            title: "Anzucht",
                            options: filteredSeedlingExtras,
                          },
                        ].map((section) => (
                          <div key={section.id} className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-neutral-900">
                                {section.title}
                              </h3>
                              <span className="text-xs text-neutral-500">
                                {section.options.length} Artikel
                              </span>
                            </div>
                            {section.options.length === 0 ? (
                              <p className="text-xs text-neutral-500">
                                Keine Produkte gefunden.
                              </p>
                            ) : (
                              <ProductGrid>
                                {section.options.map((opt) => {
                                  const active = extras.includes(opt.id);
                                  return (
                                    <ProductCard
                                      key={opt.id}
                                      title={opt.label}
                                      price={opt.price}
                                      imageUrl={opt.imageUrl ?? null}
                                      imageAlt={opt.imageAlt ?? opt.label}
                                      badges={getOptionBadges(opt)}
                                      outOfStock={opt.outOfStock}
                                      lowStock={opt.lowStock}
                                      selected={active}
                                      onSelect={() =>
                                        setExtras((prev) =>
                                          prev.includes(opt.id)
                                            ? prev.filter((id) => id !== opt.id)
                                            : [...prev, opt.id],
                                        )
                                      }
                                    />
                                  );
                                })}
                              </ProductGrid>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => scrollToStep("vent")}
                    className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-50"
                  >
                    Letzte Seite
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToStep("check")}
                    disabled={!canProceedToCheck}
                    ref={(el) => {
                      nextButtonRefs.current.extras = el;
                    }}
                    className="rounded-full bg-[#2f3e36] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    Nächste Seite
                  </button>
                </div>
              </section>
            )}

            {activeStep === "check" && (
              <section id="step-check" className="space-y-6">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {checkLocked && (
                    <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Bitte zuerst Zelt, Licht und Abluft auswählen.
                    </p>
                  )}
                  <div className={checkLocked ? "opacity-60" : ""}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">
                          5. Setup Check
                        </p>
                        <p className="text-sm text-neutral-500">
                          Prüfe Kompatibilität und letzte Details.
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          setupStatusTone === "perfect"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {setupStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div
                        className={`rounded-xl border p-4 ${
                          lightCompatible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            lightCompatible
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          Licht
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {lightCompatible
                            ? "✓ Passt zur Zelt-Größe"
                            : "✕ Bitte kompatibles Licht wählen"}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl border p-4 ${
                          airCompatible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            airCompatible ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          Abluft
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {airCompatible
                            ? "✓ Durchmesser passt"
                            : "✕ Bitte passenden Durchmesser wählen"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => scrollToStep("extras")}
                    className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:-translate-y-0.5 hover:shadow-sm hover:bg-neutral-50"
                  >
                    Letzte Seite
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="hidden lg:block sticky top-40 self-start h-fit overflow-visible">
            <SetupSidebar
              statusTone={setupStatusTone}
              statusLabel={setupStatusLabel}
              items={setupItems}
              total={total}
              onEdit={scrollToStep}
              onPrimary={handleSave}
              onAddToCart={() => handleAddToCart("cart")}
              onCheckout={() => handleAddToCart("checkout")}
              saving={saving}
              saved={saved}
              cartActionStatus={cartActionStatus}
              cartActionMessage={cartActionMessage}
            />
          </div>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/[0.06] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full" style={{ background: "#E4C56C" }} />
            <h2 className="text-lg font-bold" style={{ color: "#2f3e36" }}>
              FAQ zum Pflanzenzelt-Konfigurator
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-stone-500">
            Die wichtigsten Fragen rund um Zelte, Licht, Abluft und den Konfigurator.
          </p>
        </div>
        <div className="px-6 sm:px-8">
          <CustomizerFaqAccordion />
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: CUSTOMIZER_FAQ_JSON_LD }}
      />

      <MobileSetupBottomBar
        total={total}
        selectedCount={selectedCount}
        onOpen={() => setMobileSummaryOpen(true)}
      />
      {nextStep &&
        nextButtonRef &&
        !nextButtonVisible &&
        !mobileSummaryOpen && (
          <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 lg:hidden">
            {hasScrolledDown && (
              <button
                type="button"
                onClick={() =>
                  nextButtonRef.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2f3e36] text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label="Nächster Schritt"
              >
                ↓
              </button>
            )}
            {selectedCount > 0 && canProceedToNextStep && (
              <button
                type="button"
                onClick={() =>
                  nextButtonRef.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className="flex items-center justify-center rounded-full bg-[#2f3e36] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Nächster Schritt
              </button>
            )}
          </div>
        )}

      {mobileSummaryOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close setup"
            onClick={() => setMobileSummaryOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-neutral-900">
                Dein Setup
              </p>
              <button
                type="button"
                onClick={() => setMobileSummaryOpen(false)}
                className="text-2xl text-neutral-500"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {setupItems.map((item) => (
                <div
                  key={`${item.id}-${item.title}`}
                  className="w-full max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex w-full max-w-full items-center justify-between gap-3 overflow-hidden">
                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white text-xs text-neutral-400">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt ?? item.title}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          "▢"
                        )}
                      </span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className="max-w-[10rem] truncate text-sm font-semibold text-neutral-800 sm:max-w-[14rem]"
                          title={item.title}
                        >
                          {item.title}
                        </div>
                        {typeof item.price === "number" && (
                          <div className="text-xs text-neutral-500">
                            {formatPrice(item.price)}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSummaryOpen(false);
                        scrollToStep(item.id);
                      }}
                      className="flex-none text-xs font-semibold text-neutral-500 underline"
                    >
                      Ändern
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Zwischensumme</span>
                <span>{formatPrice(total)}</span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Preis ist eine Schätzung. Produkte werden später verknüpft.
              </p>
            </div>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-sm"
              >
                {saving
                  ? "Speichern..."
                  : saved
                    ? "Gespeichert"
                    : "Setup speichern"}
              </button>
              {saved && (
                <p className="text-xs text-emerald-700">Setup gespeichert.</p>
              )}
              <button
                type="button"
                onClick={() => handleAddToCart("cart")}
                className="w-full rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-black/70 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                In den Warenkorb
              </button>
              <button
                type="button"
                onClick={() => handleAddToCart("checkout")}
                className="w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Zur Kasse
              </button>
              <PaymentMethodLogos
                className="justify-center gap-[2px] sm:gap-2"
                pillClassName="h-7 px-2 border-black/10 bg-white sm:h-8 sm:px-3"
                logoClassName="h-4 sm:h-5"
              />
              {cartActionMessage && (
                <p
                  className={`text-xs ${
                    cartActionStatus === "error"
                      ? "text-red-600"
                      : cartActionStatus === "ok"
                        ? "text-emerald-700"
                        : "text-neutral-500"
                  }`}
                >
                  {cartActionMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
