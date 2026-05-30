"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircleIcon,
  CubeTransparentIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";
import type {
  CustomizerCategoryHandle,
  CustomizerOption,
} from "@/lib/customizerCatalog";
import {
  isLightOptionCompatibleWithTent,
  isVentOptionCompatibleWithTent,
} from "@/lib/customizerCompatibility";
import { trackAnalyticsEvent } from "@/lib/analytics";

type CustomizerOptionsResponse = {
  options?: Partial<Record<CustomizerCategoryHandle, CustomizerOption[]>>;
};

type SelectionState = {
  sizeId: string | null;
  lightId: string | null;
  ventId: string | null;
  extras: string[];
};

type StepId = "zelte" | "licht" | "luft" | "extras" | "summary";

const SLOT_LABELS: Record<CustomizerCategoryHandle, string> = {
  zelte: "Growbox",
  licht: "Licht",
  luft: "Abluft",
  bewaesserung: "Bewässerung",
  anzucht: "Anzucht",
};

const SLOT_COPY: Record<CustomizerCategoryHandle, string> = {
  zelte: "Lege zuerst die Fläche fest. Diese Auswahl steuert Licht- und Abluft-Kompatibilität.",
  licht: "Smokeify zeigt nur Lichtoptionen, die zur ausgewählten Box sinnvoll passen.",
  luft: "Abluft wird nach Anschlussdurchmesser und Verfügbarkeit eingegrenzt.",
  bewaesserung: "Optionale Automatisierung für stabilere Routinen.",
  anzucht: "Optionale Starthelfer für Stecklinge, Keimung und frühe Phasen.",
};

const STEP_ORDER: StepId[] = ["zelte", "licht", "luft", "extras", "summary"];

const STEP_LABELS: Record<StepId, string> = {
  zelte: "Growbox",
  licht: "Licht",
  luft: "Abluft",
  extras: "Extras",
  summary: "Übersicht",
};

const STEP_COPY: Record<StepId, string> = {
  zelte: "Starte mit der passenden Fläche. Danach werden die nächsten Komponenten passend gefiltert.",
  licht: "Wähle als Nächstes das Licht, das zur Boxgröße und zum Setup-Ziel passt.",
  luft: "Schließe das Kernsetup mit passender Abluft und Filtergröße ab.",
  extras: "Ergänze optionales Zubehör für Bewässerung, Anzucht und Routine.",
  summary: "Prüfe dein Setup gesammelt, bevor es in den Warenkorb geht.",
};

const parseIdList = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatPrice = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);

const findOption = (
  options: Partial<Record<CustomizerCategoryHandle, CustomizerOption[]>>,
  id: string | null,
) => {
  if (!id) return null;
  for (const entries of Object.values(options)) {
    const match = entries?.find((option) => option.id === id);
    if (match) return match;
  }
  return null;
};

const findOptionCategory = (
  options: Partial<Record<CustomizerCategoryHandle, CustomizerOption[]>>,
  id: string | null,
) => {
  if (!id) return null;
  for (const [category, entries] of Object.entries(options) as Array<
    [CustomizerCategoryHandle, CustomizerOption[] | undefined]
  >) {
    if (entries?.some((option) => option.id === id)) {
      return category;
    }
  }
  return null;
};

const canAccessStep = (step: StepId, selection: SelectionState) => {
  const hasTent = Boolean(selection.sizeId);
  const hasLight = Boolean(selection.lightId);
  const hasVent = Boolean(selection.ventId);

  switch (step) {
    case "zelte":
      return true;
    case "licht":
      return hasTent;
    case "luft":
      return hasTent && hasLight;
    case "extras":
    case "summary":
      return hasTent && hasLight && hasVent;
    default:
      return false;
  }
};

const getInitialStep = (selection: SelectionState): StepId => {
  if (!selection.sizeId) return "zelte";
  if (!selection.lightId) return "licht";
  if (!selection.ventId) return "luft";
  return selection.extras.length > 0 ? "summary" : "extras";
};

const getClampedStep = (step: StepId, selection: SelectionState): StepId => {
  if (canAccessStep(step, selection)) return step;

  const lastAccessible = [...STEP_ORDER]
    .reverse()
    .find((entry) => canAccessStep(entry, selection));

  return lastAccessible ?? "zelte";
};

function OptionCard({
  option,
  selected,
  disabled,
  onSelect,
  eager = false,
}: {
  option: CustomizerOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  eager?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`smk-motion-card smk-highlight-ring group flex h-full flex-col overflow-hidden rounded-[26px] border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "smk-selected-pulse border-[var(--smk-accent)] bg-[rgba(241,198,132,0.14)]"
          : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.07)]"
      }`}
    >
      <div className="relative aspect-[4/3] bg-white">
        {option.imageUrl ? (
          <Image
            src={option.imageUrl}
            alt={option.imageAlt ?? option.label}
            fill
            sizes="(min-width: 1024px) 20vw, 50vw"
            loading={eager ? "eager" : "lazy"}
            className="object-contain p-4 transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-stone-300">
            <CubeTransparentIcon className="h-12 w-12" />
          </div>
        )}
        {selected ? (
          <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--smk-accent)] text-[#1a140f]">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm font-semibold leading-5 text-[var(--smk-text)]">
          {option.label}
        </p>
        {option.size || option.diameterMm ? (
          <p className="mt-1 text-xs text-[var(--smk-text-dim)]">
            {[option.size, option.diameterMm ? `${option.diameterMm} mm` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-sm font-semibold text-[var(--smk-text)]">
            {formatPrice(option.price)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              option.outOfStock
                ? "bg-red-500/12 text-red-200"
                : option.lowStock
                  ? "bg-amber-500/12 text-amber-100"
                  : "bg-emerald-500/12 text-emerald-100"
            }`}
          >
            {option.outOfStock ? "Ausverkauft" : option.lowStock ? "Knapp" : "Verfügbar"}
          </span>
        </div>
        {selected ? (
          <span className="mt-3 inline-flex w-fit rounded-full border border-[rgba(233,188,116,0.26)] bg-[rgba(233,188,116,0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--smk-accent-2)]">
            Ausgewählt
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function CustomizerClient() {
  const searchParams = useSearchParams();
  const { addManyToCart } = useCart();
  const initialSelection: SelectionState = {
    sizeId: searchParams?.get("sizeId") ?? null,
    lightId: parseIdList(searchParams?.get("lightId"))[0] ?? null,
    ventId: parseIdList(searchParams?.get("ventId"))[0] ?? null,
    extras: parseIdList(searchParams?.get("extras")),
  };
  const [options, setOptions] = useState<
    Partial<Record<CustomizerCategoryHandle, CustomizerOption[]>>
  >({});
  const [selection, setSelection] = useState<SelectionState>(initialSelection);
  const [activeStep, setActiveStep] = useState<StepId>(() =>
    getInitialStep(initialSelection),
  );
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [cartStatus, setCartStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch("/api/customizer/options", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Customizer options failed");
        return response.json();
      })
      .then((data: CustomizerOptionsResponse) => {
        setOptions(data.options ?? {});
        setStatus("idle");
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  const selectedSize = useMemo(
    () => findOption(options, selection.sizeId),
    [options, selection.sizeId],
  );

  const compatibleLights = useMemo(
    () =>
      (options.licht ?? []).filter((option) =>
        isLightOptionCompatibleWithTent(selectedSize?.size ?? selectedSize?.label, option),
      ),
    [options.licht, selectedSize],
  );

  const compatibleVents = useMemo(
    () =>
      (options.luft ?? []).filter((option) =>
        isVentOptionCompatibleWithTent(selectedSize?.diametersMm, option),
      ),
    [options.luft, selectedSize],
  );

  const selectedOptions = useMemo(
    () =>
      [
        findOption(options, selection.sizeId),
        findOption(options, selection.lightId),
        findOption(options, selection.ventId),
        ...selection.extras.map((id) => findOption(options, id)),
      ].filter((option): option is CustomizerOption => Boolean(option)),
    [options, selection],
  );

  const selectedSummaryItems = useMemo(
    () =>
      [
        {
          slotLabel: SLOT_LABELS.zelte,
          option: findOption(options, selection.sizeId),
        },
        {
          slotLabel: SLOT_LABELS.licht,
          option: findOption(options, selection.lightId),
        },
        {
          slotLabel: SLOT_LABELS.luft,
          option: findOption(options, selection.ventId),
        },
        ...selection.extras.map((id) => {
          const category = findOptionCategory(options, id);
          return {
            slotLabel: category ? SLOT_LABELS[category] : "Extra",
            option: findOption(options, id),
          };
        }),
      ].filter(
        (
          entry,
        ): entry is {
          slotLabel: string;
          option: CustomizerOption;
        } => Boolean(entry.option),
      ),
    [options, selection],
  );

  const total = selectedOptions.reduce((sum, option) => sum + option.price, 0);
  const completeCore = Boolean(selection.sizeId && selection.lightId && selection.ventId);
  const stepIndex = STEP_ORDER.indexOf(activeStep);

  useEffect(() => {
    setActiveStep((prev) => getClampedStep(prev, selection));
  }, [selection]);

  const selectSingle = (key: "sizeId" | "lightId" | "ventId", option: CustomizerOption) => {
    setCartStatus("idle");
    setSelection((prev) => {
      const nextValue = prev[key] === option.id ? null : option.id;
      return {
        ...prev,
        [key]: nextValue,
        ...(key === "sizeId" ? { lightId: null, ventId: null } : {}),
      };
    });
  };

  const toggleExtra = (option: CustomizerOption) => {
    setCartStatus("idle");
    setSelection((prev) => ({
      ...prev,
      extras: prev.extras.includes(option.id)
        ? prev.extras.filter((id) => id !== option.id)
        : [...prev.extras, option.id],
    }));
  };

  const addSetupToCart = async () => {
    const cartItems = selectedOptions
      .filter((option) => option.variantId && !option.outOfStock)
      .map((option) => ({
        variantId: option.variantId as string,
        quantity: 1,
        options: [
          { name: "Setup", value: "Smokeify Konfigurator" },
          { name: "Quelle", value: "customizer" },
        ],
      }));

    if (cartItems.length === 0) return;
    setCartStatus("loading");
    try {
      await addManyToCart(cartItems);
      trackAnalyticsEvent("add_to_cart", {
        item_list_id: "customizer",
        item_list_name: "Smokeify Konfigurator",
        value: total,
        currency: "EUR",
      });
      setCartStatus("ok");
    } catch {
      setCartStatus("error");
    }
  };

  const renderSlot = (
    category: CustomizerCategoryHandle,
    entries: CustomizerOption[],
    selectedId: string | null,
    onSelect: (option: CustomizerOption) => void,
    footer?: React.ReactNode,
  ) => (
    <section className="smk-panel rounded-[32px] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="smk-kicker">{SLOT_LABELS[category]}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
            {SLOT_LABELS[category]} auswählen
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--smk-text-muted)]">
            {SLOT_COPY[category]}
          </p>
        </div>
        <span className="smk-chip">{entries.length} Optionen</span>
      </div>
      {entries.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((option, index) => (
            <OptionCard
              key={option.id}
              option={option}
              selected={selectedId === option.id}
              disabled={option.outOfStock}
              onSelect={() => onSelect(option)}
              eager={index < 3}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-6 text-sm text-[var(--smk-text-muted)]">
          Keine passenden Optionen gefunden.
        </div>
      )}
      {footer ? <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">{footer}</div> : null}
    </section>
  );

  const stepBack = stepIndex > 0 ? STEP_ORDER[stepIndex - 1] : null;

  const renderStepControls = ({
    canContinue,
    continueLabel,
    onContinue,
  }: {
    canContinue: boolean;
    continueLabel: string;
    onContinue: () => void;
  }) => (
    <>
      <div className="flex items-center justify-between">
        {stepBack ? (
          <button
            type="button"
            onClick={() => setActiveStep(stepBack)}
            className="smk-button-secondary inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
          >
            Zurück
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="smk-button-primary inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
        >
          {continueLabel}
        </button>
      </div>
    </>
  );

  return (
    <div className="space-y-6 text-[var(--smk-text)]">
      <section className="relative overflow-hidden rounded-[42px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_12%_16%,rgba(241,198,132,0.2),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(214,134,83,0.16),transparent_26%),linear-gradient(135deg,rgba(24,20,17,0.99),rgba(12,11,10,1))] px-6 py-8 shadow-[0_32px_90px_rgba(0,0,0,0.38)] sm:px-10 sm:py-10">
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,430px)] lg:items-start xl:gap-10">
          <div className="max-w-[40rem]">
            <p className="smk-kicker">Smokeify Konfigurator</p>
            <h1 className="smk-heading mt-4 text-5xl leading-[0.95] text-[var(--smk-text)] sm:text-6xl">
              Grow-Setup bauen,
              <span className="smk-text-gradient block">ohne Teile-Raten.</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
              Wähle Box, Licht, Abluft und sinnvolles Zubehör aus dem lokalen
              Smokeify Sortiment. Kompatibilität bleibt transparent, der
              Warenkorb nutzt weiter die bestehenden serverseitigen Preis- und
              Bestandsregeln.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Katalog ansehen
              </Link>
              <Link href="/pflanzen-analyse" className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Pflanzenanalyse starten
              </Link>
            </div>
            <div className="mt-8 border-t border-[rgba(255,255,255,0.08)] pt-5">
              <p className="smk-kicker mb-3">Konfigurator Schritte</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {STEP_ORDER.map((step, index) => {
                  const reachable = canAccessStep(step, selection);
                  const active = activeStep === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      disabled={!reachable}
                      onClick={() => setActiveStep(step)}
                      className={`inline-flex min-h-[50px] w-full items-center justify-start gap-2 rounded-full border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] transition ${
                        active
                          ? "border-[rgba(233,188,116,0.34)] bg-[rgba(233,188,116,0.16)] text-[var(--smk-text)]"
                          : reachable
                            ? "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)] hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
                            : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] text-[var(--smk-text-dim)] opacity-50"
                      }`}
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px]">
                        {index + 1}
                      </span>
                      <span className="leading-tight">{STEP_LABELS[step]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="lg:pt-4 xl:pt-6">
            <div className="smk-surface mx-auto max-w-[28rem] rounded-[30px] p-5 sm:p-6">
              <p className="smk-kicker">Aktueller Schritt</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                {stepIndex + 1}. {STEP_LABELS[activeStep]}
              </h2>
              <p className="mt-2 max-w-[24rem] text-sm leading-6 text-[var(--smk-text-muted)]">
                {STEP_COPY[activeStep]}
              </p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="smk-progress-sheen h-full rounded-full bg-[linear-gradient(90deg,#f1c684_0%,#d97745_100%)] transition-all"
                  style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
                />
              </div>
              <div className="mt-6 border-t border-[rgba(255,255,255,0.08)] pt-5">
                <p className="smk-kicker">Setup Summe</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--smk-text)]">
                  {formatPrice(total)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
                  {completeCore
                    ? "Kernsetup komplett. Extras bleiben optional."
                    : "Wähle mindestens Growbox, Licht und Abluft für ein Kernsetup."}
                </p>
              </div>
              <div className="mt-5 space-y-2">
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1 no-scrollbar">
                  {selectedOptions.length > 0 ? (
                    selectedOptions.map((option) => (
                      <div
                        key={option.id}
                        className="smk-entrance flex items-center justify-between gap-3 rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs"
                      >
                        <span className="line-clamp-1 text-[var(--smk-text-muted)]">
                          {option.label}
                        </span>
                        <span className="font-semibold text-[var(--smk-text)]">
                          {formatPrice(option.price)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm text-[var(--smk-text-muted)]">
                      Noch keine Komponenten ausgewählt.
                    </p>
                  )}
                </div>
              </div>
              {completeCore && activeStep !== "summary" ? (
                <button
                  type="button"
                  onClick={() => setActiveStep("summary")}
                  className="smk-button-secondary mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Zur Übersicht springen
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)]"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-[28px] border border-red-500/24 bg-red-500/10 p-6 text-sm text-red-100">
          Der Konfigurator konnte die lokalen Smokeify Optionen nicht laden.
        </div>
      ) : null}

      {status === "idle" ? (
        <>
          {activeStep === "zelte"
            ? renderSlot(
                "zelte",
                options.zelte ?? [],
                selection.sizeId,
                (option) => selectSingle("sizeId", option),
                renderStepControls({
                  canContinue: Boolean(selection.sizeId),
                  continueLabel: "Weiter zu Licht",
                  onContinue: () => setActiveStep("licht"),
                }),
              )
            : null}

          {activeStep === "licht"
            ? renderSlot(
                "licht",
                compatibleLights,
                selection.lightId,
                (option) => selectSingle("lightId", option),
                renderStepControls({
                  canContinue: Boolean(selection.lightId),
                  continueLabel: "Weiter zu Abluft",
                  onContinue: () => setActiveStep("luft"),
                }),
              )
            : null}

          {activeStep === "luft"
            ? renderSlot(
                "luft",
                compatibleVents,
                selection.ventId,
                (option) => selectSingle("ventId", option),
                renderStepControls({
                  canContinue: Boolean(selection.ventId),
                  continueLabel: "Weiter zu Extras",
                  onContinue: () => setActiveStep("extras"),
                }),
              )
            : null}

          {activeStep === "extras" ? (
            <section className="smk-panel rounded-[32px] p-5 sm:p-6">
              <div className="mb-5">
                <p className="smk-kicker">Optionale Extras</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                  Routinen und Startphase ergänzen
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--smk-text-muted)]">
                  Wähle Zubehör einzeln dazu. Extras sind bewusst optional und
                  werden nicht automatisch in Checkout- oder Preislogik verschoben.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...(options.bewaesserung ?? []), ...(options.anzucht ?? [])].map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    selected={selection.extras.includes(option.id)}
                    disabled={option.outOfStock}
                    onSelect={() => toggleExtra(option)}
                  />
                ))}
              </div>
              <div className="mt-5">
                {renderStepControls({
                  canContinue: completeCore,
                  continueLabel: "Zur Übersicht",
                  onContinue: () => setActiveStep("summary"),
                })}
              </div>
            </section>
          ) : null}

          {activeStep === "summary" ? (
            <section className="smk-panel rounded-[32px] p-5 sm:p-6">
              <div className="mb-5">
                <p className="smk-kicker">Setup Übersicht</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                  Alles geprüft, jetzt gesammelt übernehmen
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--smk-text-muted)]">
                  Dein Kernsetup ist vollständig. Prüfe die ausgewählten
                  Komponenten und lege sie anschließend gesammelt in den Warenkorb.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {selectedSummaryItems.map(({ slotLabel, option }) => (
                  <div
                    key={option.id}
                    className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--smk-text-dim)]">
                      {slotLabel}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--smk-text)]">
                      {option.label}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[var(--smk-accent-2)]">
                      {formatPrice(option.price)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--smk-text-dim)]">
                    Finale Summe
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                    {formatPrice(total)}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setActiveStep("extras")}
                    className="smk-button-secondary inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
                  >
                    Extras anpassen
                  </button>
                  <button
                    type="button"
                    onClick={() => void addSetupToCart()}
                    disabled={!completeCore || cartStatus === "loading"}
                    className="smk-button-primary inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <ShoppingBagIcon className="h-5 w-5" />
                    {cartStatus === "loading" ? "Wird hinzugefügt..." : "Setup in den Warenkorb"}
                  </button>
                </div>
              </div>

              {cartStatus === "ok" ? (
                <p className="mt-3 text-xs font-semibold text-[var(--smk-success)]">
                  Setup wurde in den Warenkorb gelegt.
                </p>
              ) : null}
              {cartStatus === "error" ? (
                <p className="mt-3 text-xs font-semibold text-[var(--smk-error)]">
                  Setup konnte nicht hinzugefügt werden. Bitte prüfe Bestand und Auswahl.
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
