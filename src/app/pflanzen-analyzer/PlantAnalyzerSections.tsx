import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
  PhotoIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type {
  AnalysisHistoryEntry,
  AnalyzerResponse,
  AnalyzerSessionStatus,
  AnalyzerStatus,
  AsyncStatus,
  HistoryReportDetail,
  LoadingStep,
  Locale,
} from "@/app/pflanzen-analyzer/types";
import type {
  PlantAnalyzerAnalysisContext,
  PlantAnalyzerHealthStatus,
} from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerFeedbackClassification,
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerStoredFeedback,
} from "@/lib/plantAnalyzerRemediationTypes";

const formatDate = (value: string, locale: Locale) =>
  new Date(value).toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const lightFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5a45] focus-visible:ring-offset-2";
const darkFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C56C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#16382d]";
const smokeifyPanelClass =
  "rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] sm:px-5";
const smokeifyInsetCardClass =
  "rounded-2xl border border-[var(--smk-border)] bg-[rgba(0,0,0,0.18)] px-4 py-3";
const smokeifyMutedCopyClass = "text-[var(--smk-text-muted)]";
const smokeifyBodyCopyClass = "text-[var(--smk-text)]";

export function detectPreferredLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(
      "smokeify-plant-analyzer-locale",
    );
    if (stored === "de" || stored === "en") {
      return stored;
    }
  }

  if (typeof navigator !== "undefined") {
    const languages = [navigator.language, ...(navigator.languages ?? [])];
    if (languages.some((entry) => entry?.toLowerCase().startsWith("de"))) {
      return "de";
    }
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (
    timeZone === "Europe/Berlin" ||
    timeZone === "Europe/Vienna" ||
    timeZone === "Europe/Zurich" ||
    timeZone === "Europe/Luxembourg"
  ) {
    return "de";
  }

  return "en";
}

export function getLocalizedUploadTips(locale: Locale) {
  return locale === "de"
    ? ["Nah dran", "Ohne Filter", "Gutes Licht"]
    : ["Close up", "No filters", "Good light"];
}

export function getLoadingSteps(locale: Locale): LoadingStep[] {
  return locale === "de"
    ? [
        {
          title: "Bilddetails werden gelesen",
          detail: "Format, Schärfe und sichtbare Blattbereiche werden geprüft.",
          color: "#E4C56C",
        },
        {
          title: "Symptome werden abgeglichen",
          detail:
            "Farbveränderungen, Blattstruktur und Auffälligkeiten werden eingeordnet.",
          color: "#9FE3B2",
        },
        {
          title: "Empfehlungen werden gebaut",
          detail:
            "Nächste Schritte, Produktbezug und Priorität werden vorbereitet.",
          color: "#7DD3FC",
        },
      ]
    : [
        {
          title: "Reading image details",
          detail: "Checking format, sharpness, and visible leaf areas.",
          color: "#E4C56C",
        },
        {
          title: "Matching visible symptoms",
          detail:
            "Comparing color shifts, leaf structure, and visual anomalies.",
          color: "#9FE3B2",
        },
        {
          title: "Preparing recommendations",
          detail: "Building next steps, product context, and priority.",
          color: "#7DD3FC",
        },
      ];
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function confidenceBandLabel(value: AnalyzerResponse["confidenceBand"], locale: Locale) {
  if (value === "high") return locale === "de" ? "hoch" : "high";
  if (value === "low") return locale === "de" ? "niedrig" : "low";
  return locale === "de" ? "mittel" : "medium";
}

function renderContextSummary(
  context: PlantAnalyzerAnalysisContext | null,
  locale: Locale,
) {
  if (!context) return [];

  const items: string[] = [];
  if (context.medium && context.medium !== "unknown") {
    items.push(`${locale === "de" ? "Medium" : "Medium"}: ${context.medium}`);
  }
  if (context.growthStage && context.growthStage !== "unknown") {
    items.push(`${locale === "de" ? "Phase" : "Stage"}: ${context.growthStage}`);
  }
  if (typeof context.ph === "number") items.push(`pH: ${context.ph}`);
  if (typeof context.ec === "number") items.push(`EC: ${context.ec}`);
  if (typeof context.temperatureC === "number") {
    items.push(
      `${locale === "de" ? "Temperatur" : "Temperature"}: ${context.temperatureC} C`,
    );
  }
  if (typeof context.humidityPercent === "number") {
    items.push(
      `${locale === "de" ? "Luftfeuchte" : "Humidity"}: ${context.humidityPercent}%`,
    );
  }
  if (typeof context.lightDistanceCm === "number") {
    items.push(
      `${locale === "de" ? "Lichtabstand" : "Light distance"}: ${context.lightDistanceCm} cm`,
    );
  }
  if (context.lightType) {
    items.push(`${locale === "de" ? "Lichttyp" : "Light"}: ${context.lightType}`);
  }
  if (context.tentOrRoomSize) {
    items.push(
      `${locale === "de" ? "Raum / Zelt" : "Space"}: ${context.tentOrRoomSize}`,
    );
  }
  if (context.wateringCadence) {
    items.push(
      `${locale === "de" ? "Gießrhythmus" : "Watering"}: ${context.wateringCadence}`,
    );
  }
  return items;
}

function healthStatusLabel(value: PlantAnalyzerHealthStatus, locale: Locale) {
  if (value === "healthy") {
    return locale === "de" ? "Eher unkritisch" : "Mostly fine";
  }
  if (value === "critical") {
    return locale === "de" ? "Erhöhter Handlungsbedarf" : "Needs attention";
  }
  return locale === "de" ? "Bitte prüfen" : "Worth checking";
}

function healthStatusClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (value === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatPrice(amount: string, currencyCode: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function severityLabel(
  value: PlantAnalyzerHealthStatus,
  locale: Locale,
) {
  if (value === "critical") return locale === "de" ? "kritisch" : "critical";
  if (value === "healthy") return locale === "de" ? "unkritisch" : "low risk";
  return locale === "de" ? "prüfen" : "check";
}

function severityCardClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "border-[rgba(239,143,127,0.28)] bg-[linear-gradient(135deg,rgba(82,30,25,0.72)_0%,rgba(26,20,18,0.96)_100%)]";
  }
  if (value === "healthy") {
    return "border-[rgba(127,207,150,0.22)] bg-[linear-gradient(135deg,rgba(24,63,44,0.72)_0%,rgba(26,20,18,0.96)_100%)]";
  }
  return "border-[rgba(228,197,108,0.24)] bg-[linear-gradient(135deg,rgba(79,58,24,0.72)_0%,rgba(26,20,18,0.96)_100%)]";
}

function urgencyLabel(
  value: PlantAnalyzerRemediationPlan["urgency"],
  locale: Locale,
) {
  if (value === "high") {
    return locale === "de" ? "Heute priorisieren" : "Prioritize today";
  }
  if (value === "medium") {
    return locale === "de" ? "Zeitnah prüfen" : "Check soon";
  }
  return locale === "de" ? "Ruhig beobachten" : "Monitor calmly";
}

function resultHeroClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "border-[rgba(239,143,127,0.32)] bg-[linear-gradient(135deg,rgba(78,24,20,0.96)_0%,rgba(31,23,20,0.98)_56%,rgba(16,14,13,1)_100%)] text-[var(--smk-text)] shadow-[0_28px_70px_rgba(0,0,0,0.28)]";
  }
  if (value === "healthy") {
    return "border-[rgba(127,207,150,0.24)] bg-[linear-gradient(135deg,rgba(23,58,41,0.96)_0%,rgba(31,23,20,0.98)_56%,rgba(16,14,13,1)_100%)] text-[var(--smk-text)] shadow-[0_28px_70px_rgba(0,0,0,0.24)]";
  }
  return "border-[rgba(228,197,108,0.28)] bg-[linear-gradient(135deg,rgba(82,64,31,0.96)_0%,rgba(31,23,20,0.98)_56%,rgba(16,14,13,1)_100%)] text-[var(--smk-text)] shadow-[0_28px_70px_rgba(0,0,0,0.24)]";
}

function resultHeroAccentClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "text-[#f6b5a8]";
  }
  if (value === "healthy") {
    return "text-[#b8efc8]";
  }
  return "text-[#f5df9a]";
}

function feedbackLabel(
  feedback: PlantAnalyzerStoredFeedback,
  locale: Locale,
) {
  const labels: Record<PlantAnalyzerFeedbackClassification, string> =
    locale === "de"
      ? {
          helpful: "Als hilfreich markiert",
          issue_guess_wrong: "Problemschätzung wirkt falsch",
          product_suggestion_off: "Produkthinweise wirken unpassend",
          recommendation_relevant: "Empfehlung war relevant",
          follow_up_improved: "Verlauf später verbessert",
          follow_up_worsened: "Verlauf später verschlechtert",
          needs_recheck: "Erneute Prüfung angefragt",
        }
      : {
          helpful: "Marked as helpful",
          issue_guess_wrong: "Issue estimate seems wrong",
          product_suggestion_off: "Product hints seem off",
          recommendation_relevant: "Recommendation was relevant",
          follow_up_improved: "Marked as improved later",
          follow_up_worsened: "Marked as worsened later",
          needs_recheck: "Requested a recheck",
        };

  return labels[feedback.classification];
}

function SeverityIcon({
  severity,
}: {
  severity: PlantAnalyzerHealthStatus;
}) {
  if (severity === "critical") return <FireIcon className="h-5 w-5" />;
  if (severity === "healthy") return <CheckBadgeIcon className="h-5 w-5" />;
  return <ShieldExclamationIcon className="h-5 w-5" />;
}

function UploadedPlantImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

function GermanyFlag() {
  return (
    <svg
      viewBox="0 0 24 16"
      className="h-3.5 w-5 overflow-hidden rounded-[4px] border border-black/10"
      aria-hidden="true"
    >
      <rect width="24" height="16" fill="#ffce00" />
      <rect width="24" height="10.67" y="0" fill="#dd0000" />
      <rect width="24" height="5.33" y="0" fill="#111111" />
    </svg>
  );
}

function UkFlag() {
  return (
    <svg
      viewBox="0 0 24 16"
      className="h-3.5 w-5 overflow-hidden rounded-[4px] border border-black/10"
      aria-hidden="true"
    >
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#ffffff" strokeWidth="4" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#c8102e" strokeWidth="2" />
      <rect x="9" width="6" height="16" fill="#ffffff" />
      <rect y="5" width="24" height="6" fill="#ffffff" />
      <rect x="10" width="4" height="16" fill="#c8102e" />
      <rect y="6" width="24" height="4" fill="#c8102e" />
    </svg>
  );
}

function ProductSuggestionGrid({
  locale,
  productSuggestions,
}: {
  locale: Locale;
  productSuggestions: AnalyzerResponse["productSuggestions"];
}) {
  if (productSuggestions.length === 0) {
    return (
      <div className={`${smokeifyInsetCardClass} text-sm ${smokeifyMutedCopyClass}`}>
        {locale === "de"
          ? "Keine Produktempfehlungen verfügbar."
          : "No product recommendations available."}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {productSuggestions.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.handle}`}
          className={`group rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-3 transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] ${lightFocusRing}`}
        >
          <div className="flex flex-col gap-3 min-[420px]:flex-row">
            <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-[rgba(0,0,0,0.2)] min-[420px]:h-20 min-[420px]:w-20">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.imageAlt}
                  fill
                  sizes="(min-width: 420px) 80px, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--smk-text-dim)]">
                  <PhotoIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="line-clamp-2 break-words text-base font-semibold leading-6 text-[var(--smk-text)] sm:text-[1.05rem]">
                {product.title}
              </p>
              <p className="mt-2 break-words text-xs leading-5 text-[var(--smk-text-muted)]">
                {product.reason}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-bold tracking-tight text-[#a9e8bc]">
                  {product.price
                    ? formatPrice(
                        product.price.amount,
                        product.price.currencyCode,
                        locale,
                      )
                    : ""}
                </p>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(0,0,0,0.2)] text-[#a9e8bc] shadow-sm transition group-hover:translate-x-0.5 group-hover:border-[var(--smk-border-strong)] group-hover:bg-[rgba(255,255,255,0.08)]">
                  <ArrowUpRightIcon className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function GuideSuggestionList({
  locale,
  guideSuggestions,
}: {
  locale: Locale;
  guideSuggestions: AnalyzerResponse["guideSuggestions"];
}) {
  if (guideSuggestions.length === 0) {
    return (
      <div className={`${smokeifyInsetCardClass} text-sm ${smokeifyMutedCopyClass}`}>
        {locale === "de"
          ? "Keine weiterführenden Guides verfügbar."
          : "No further guides available."}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {guideSuggestions.map((guide) => (
        <Link
          key={guide.slug}
          href={guide.href}
          className={`rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4 transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] ${lightFocusRing}`}
        >
          <p className="break-words text-sm font-semibold text-[var(--smk-text)]">{guide.title}</p>
          <p className="mt-2 break-words text-sm leading-6 text-[var(--smk-text-muted)]">
            {guide.description}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function PlantAnalyzerHero({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const isGerman = locale === "de";

  return (
    <section className="rounded-[30px] border border-stone-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-600">
          <span className="h-2 w-2 rounded-full bg-[#E4C56C]" />
          {isGerman ? "Smokeify Pflanzenhilfe" : "Smokeify Plant Care"}
        </div>
        <div className="inline-flex w-full self-start rounded-full border border-stone-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:w-fit">
          <button
            type="button"
            onClick={() => onLocaleChange("de")}
            aria-label="Deutsch"
            aria-pressed={isGerman}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition sm:flex-none ${
              isGerman
                ? "bg-[#E4C56C] text-[#20342b]"
                : "text-stone-600 hover:bg-stone-100"
            } ${lightFocusRing}`}
          >
            <GermanyFlag />
            <span>DE</span>
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange("en")}
            aria-label="English"
            aria-pressed={!isGerman}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition sm:flex-none ${
              !isGerman
                ? "bg-[#E4C56C] text-[#20342b]"
                : "text-stone-600 hover:bg-stone-100"
            } ${lightFocusRing}`}
          >
            <UkFlag />
            <span>EN</span>
          </button>
        </div>
      </div>

      <div className="mt-5 max-w-4xl">
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {isGerman ? "Blitzschnelle Einschätzung" : "Quick first assessment"}
        </p>
        <h1 className="mt-2 max-w-4xl break-words text-[1.85rem] font-extrabold leading-[1.04] tracking-tight text-stone-950 sm:text-[3rem]">
          {isGerman
            ? "Foto hochladen, klare Empfehlung erhalten, komplett kostenlos"
            : "Upload a photo, add context, get a clear recommendation."}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">
          {isGerman
            ? "Die Analyse bezieht dein Bild und optionale Angaben wie Temperatur, pH, Luftfeuchtigkeit oder Medium mit ein und macht die Ersteinschätzung deutlich brauchbarer."
            : "The analysis uses your image plus optional details like temperature, pH, humidity or medium and makes the first assessment much more useful."}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="#plant-analyzer-upload"
            className={`smk-button-primary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
          >
            {isGerman ? "Jetzt Foto hochladen" : "Upload photo now"}
          </a>
          <Link
            href="/products"
            className={`smk-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
          >
            {isGerman ? "Produkte ansehen" : "View products"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PlantAnalyzerUploadSection({
  inputId,
  locale,
  pathname,
  imagePreview,
  imageName,
  isDraggingFile,
  isPreparingImage,
  notes,
  analysisContext,
  recheckBaseline,
  status,
  error,
  isAuthenticated,
  isPrivilegedUser,
  freeAnalysesRemaining,
  freeAnalysisUsed,
  effectiveSessionStatus,
  hasHydrated,
  onFileChange,
  onClearImage,
  onNotesChange,
  onContextChange,
  onClearRecheckBaseline,
  onAnalyze,
  onCancelAnalysis,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  inputId: string;
  locale: Locale;
  pathname: string | null;
  imagePreview: string | null;
  imageName: string;
  isDraggingFile: boolean;
  isPreparingImage: boolean;
  notes: string;
  analysisContext: PlantAnalyzerAnalysisContext;
  recheckBaseline: AnalysisHistoryEntry | null;
  status: AnalyzerStatus;
  error: string;
  isAuthenticated: boolean;
  isPrivilegedUser: boolean;
  freeAnalysesRemaining: number;
  freeAnalysisUsed: boolean;
  effectiveSessionStatus: AnalyzerSessionStatus;
  hasHydrated: boolean;
  onFileChange: (file: File | null) => void;
  onClearImage: () => void;
  onNotesChange: (value: string) => void;
  onContextChange: (
    field: keyof PlantAnalyzerAnalysisContext,
    value: string | number | null,
  ) => void;
  onClearRecheckBaseline: () => void;
  onAnalyze: () => void;
  onCancelAnalysis: () => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
}) {
  const isGerman = locale === "de";
  const uploadTips = getLocalizedUploadTips(locale);

  return (
    <section className="w-full rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            {isGerman ? "Upload" : "Upload"}
          </p>
          <h2 className="mt-2 break-words text-[1.65rem] font-bold tracking-tight text-stone-950 sm:text-2xl">
            {isGerman
              ? "Foto und Kontext für die Analyse"
              : "Photo and context for analysis"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:leading-7">
            {isGerman
              ? "Bild hochladen und optional Werte oder Beobachtungen ergänzen, direkt eine Einschätzung bekommen."
              : "Keep it simple: upload a photo and optionally add values or observations. The analysis takes both into account."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
            {isGerman ? "1 Bild" : "1 image"}
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
            {isGerman ? "Kontext optional" : "Context optional"}
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">
            {isGerman ? "Web-optimiert" : "Web optimized"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          {
            title: isGerman ? "Nah am Blatt" : "Close to leaf",
            detail: isGerman
              ? "Betroffene Stelle gut sichtbar."
              : "Keep the affected area clearly visible.",
          },
          {
            title: isGerman ? "Natürliches Licht" : "Natural light",
            detail: isGerman
              ? "Keine harten Filter oder Farbstiche."
              : "Avoid harsh filters or color casts.",
          },
          {
            title: isGerman ? "Ein klares Bild" : "One clear image",
            detail: isGerman
              ? "Nicht mehrere Pflanzen auf einmal."
              : "Avoid multiple plants in one shot.",
          },
        ].map((tip) => (
          <div
            key={tip.title}
            className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"
          >
            <p className="text-sm font-semibold text-stone-900">{tip.title}</p>
            <p className="mt-1 text-sm leading-6 text-stone-500">{tip.detail}</p>
          </div>
        ))}
      </div>

      <label
        id="plant-analyzer-upload"
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-4 flex w-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-4 py-6 text-center transition focus-within:border-[#1f5a45] focus-within:bg-[#edf6f1] focus-within:shadow-[0_0_0_4px_rgba(31,90,69,0.08)] sm:min-h-[220px] ${
          isDraggingFile
            ? "border-[#1f5a45] bg-[#edf6f1] shadow-[0_0_0_4px_rgba(31,90,69,0.08)]"
            : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
        }`}
      >
        {imagePreview ? (
          <div className="w-full">
            <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[22px] border border-stone-200 bg-white">
              <UploadedPlantImage
                src={imagePreview}
                alt={
                  isGerman
                    ? "Vorschau des hochgeladenen Pflanzenfotos"
                    : "Preview of the uploaded plant photo"
                }
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-stone-900">
              {isPreparingImage
                ? isGerman
                  ? "Bild wird optimiert ..."
                  : "Optimizing image ..."
                : isGerman
                  ? "Foto ausgewählt. Du kannst jetzt direkt analysieren."
                  : "Photo selected. You can analyze it now."}
            </p>
            {imageName ? (
              <p className="mt-1 break-words text-xs text-stone-500">{imageName}</p>
            ) : null}
          </div>
        ) : (
          <div className="max-w-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700">
              <ArrowUpTrayIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-semibold text-stone-900">
              {isGerman
                ? "Pflanzenfoto hochladen oder hineinziehen"
                : "Upload or drag in a plant photo"}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {isGerman
                ? "Am besten mit gutem Licht, nah am betroffenen Blatt und ohne Filter."
                : "Best with good light, close to the affected leaf and without filters."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {uploadTips.map((tip) => (
                <span
                  key={tip}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600"
                >
                  {tip}
                </span>
              ))}
            </div>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            onFileChange(nextFile);
            event.currentTarget.value = "";
          }}
          className="sr-only"
        />
      </label>

      {imagePreview ? (
        <div className="mt-3 flex flex-col gap-3 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">
              {imageName || (isGerman ? "Ausgewähltes Foto" : "Selected photo")}
            </p>
            <p className="mt-1 break-words text-sm text-stone-600">
              {isGerman
                ? "Dieses Bild wird komprimiert hochgeladen und als Bericht gespeichert."
                : "This image is uploaded in a compressed form and saved with the report."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearImage}
            aria-label={isGerman ? "Foto entfernen" : "Remove photo"}
            className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-10 sm:w-auto sm:rounded-full sm:px-3 sm:text-xs ${lightFocusRing}`}
          >
            <TrashIcon className="h-4.5 w-4.5" />
            <span>{isGerman ? "Foto entfernen" : "Remove photo"}</span>
          </button>
        </div>
      ) : null}

      <div
        className="mt-4 w-full rounded-[28px] border border-[#4a3428] p-4 text-white shadow-[0_18px_36px_rgba(15,23,42,0.14)] sm:p-5"
        style={{ backgroundColor: "#2a1d17", color: "#f6f0e8" }}
      >
        <div
          className="flex min-h-[220px] flex-col items-start gap-4 rounded-[24px] border border-white/8 px-4 py-4 sm:flex-row sm:px-5"
          style={{ backgroundColor: "#201511" }}
        >
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[#f4cf8f] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <BeakerIcon className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
              {isGerman ? "Kontext für die Analyse" : "Context for the analysis"}
            </label>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={
                isGerman
                  ? "Optional: Temperatur, pH, Luftfeuchtigkeit, Medium, Gießrhythmus oder Beobachtungen."
                  : "Optional: temperature, pH, humidity, medium, watering rhythm or observations."
              }
              rows={5}
              className="mt-3 min-h-[124px] w-full flex-1 resize-y rounded-[20px] border border-white/10 px-4 py-3 text-sm leading-6 text-white [color-scheme:dark] [-webkit-text-fill-color:#ffffff] caret-white outline-none transition placeholder:text-white/38 focus:border-[#E4C56C]/55 focus-visible:ring-2 focus-visible:ring-[#E4C56C]/18"
              style={{ backgroundColor: "#120d0a", color: "#f6f0e8" }}
            />
            <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-3">
              {recheckBaseline ? (
                <div className="rounded-[18px] border border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.05)] px-3.5 py-3 text-sm text-[var(--smk-text)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-accent-2)]">
                        {isGerman ? "Recheck-Basis aktiv" : "Recheck baseline active"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--smk-text-muted)]">
                        {isGerman
                          ? `Vergleich mit Bericht vom ${formatDate(recheckBaseline.analyzedAt, locale)}`
                          : `Comparing against report from ${formatDate(recheckBaseline.analyzedAt, locale)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClearRecheckBaseline}
                      className={`inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] ${darkFocusRing}`}
                    >
                      {isGerman ? "Basis entfernen" : "Clear baseline"}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={analysisContext.medium ?? ""}
                  onChange={(event) => onContextChange("medium", event.target.value)}
                  placeholder={isGerman ? "Medium: soil / coco / hydro" : "Medium: soil / coco / hydro"}
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
                <input
                  value={analysisContext.growthStage ?? ""}
                  onChange={(event) => onContextChange("growthStage", event.target.value)}
                  placeholder={isGerman ? "Phase: seedling / veg / flower" : "Stage: seedling / veg / flower"}
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
                <input
                  value={analysisContext.ph ?? ""}
                  onChange={(event) => onContextChange("ph", event.target.value)}
                  placeholder="pH"
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
                <input
                  value={analysisContext.ec ?? ""}
                  onChange={(event) => onContextChange("ec", event.target.value)}
                  placeholder="EC"
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
                <input
                  value={analysisContext.temperatureC ?? ""}
                  onChange={(event) => onContextChange("temperatureC", event.target.value)}
                  placeholder={isGerman ? "Temperatur C" : "Temperature C"}
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
                <input
                  value={analysisContext.humidityPercent ?? ""}
                  onChange={(event) => onContextChange("humidityPercent", event.target.value)}
                  placeholder={isGerman ? "Luftfeuchte %" : "Humidity %"}
                  className="smk-input h-11 rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
                />
              </div>
              <p className="rounded-full bg-white/6 px-3 py-2 text-xs leading-5 text-white/92">
                {isGerman
                  ? "Optional, aber hilfreich: Temperatur, pH, Luftfeuchtigkeit, Medium oder kurze Beobachtungen."
                  : "Optional, but helpful: temperature, pH, humidity, medium or short observations."}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={
                    !imagePreview ||
                    isPreparingImage ||
                    status === "loading" ||
                    effectiveSessionStatus === "loading" ||
                    freeAnalysisUsed
                  }
                  className={`group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-2xl border border-[#f1d98f] bg-[linear-gradient(135deg,#f2d36f_0%,#e4c56c_45%,#d9b754_100%)] px-5 py-3 text-sm font-semibold text-[#173126] shadow-[0_14px_30px_rgba(228,197,108,0.26)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(228,197,108,0.34)] active:translate-y-0 active:scale-[0.99] sm:ml-auto sm:w-auto disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none ${darkFocusRing}`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.34)_18%,transparent_36%)] opacity-70 transition-transform duration-700 group-hover:translate-x-[160%] group-hover:opacity-100" />
                  <span className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-white/45" />
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff6da]/80 ring-1 ring-black/5 transition group-hover:scale-105">
                      <ArrowUpTrayIcon className="h-4 w-4" />
                    </span>
                    <span>
                      {isPreparingImage
                        ? isGerman
                          ? "Bild wird vorbereitet ..."
                          : "Preparing image ..."
                        : status === "loading"
                          ? isGerman
                            ? "Analyse läuft ..."
                            : "Analyzing ..."
                          : !isAuthenticated
                            ? isGerman
                              ? "Anmelden für Analyse"
                              : "Sign in to analyze"
                            : freeAnalysisUsed
                              ? isGerman
                                ? "Freie Analysen verbraucht"
                                : "Free analyses used up"
                              : isGerman
                                ? "Foto analysieren"
                                : "Analyze photo"}
                    </span>
                  </span>
                </button>
                {status === "loading" ? (
                  <button
                    type="button"
                    onClick={onCancelAnalysis}
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12 sm:w-auto ${darkFocusRing}`}
                  >
                    <XMarkIcon className="mr-2 h-4 w-4" />
                    {isGerman ? "Abbrechen" : "Cancel"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isAuthenticated ? (
        <div className="mt-3 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
          <p className="font-semibold text-stone-900">
            {isPrivilegedUser
              ? isGerman
                ? "Unbegrenzte Analysen aktiv"
                : "Unlimited analyses enabled"
              : freeAnalysisUsed
                ? isGerman
                  ? "24h-Limit erreicht"
                  : "Free analyses used up"
                : isGerman
                  ? `${freeAnalysesRemaining} kostenlose Analysen in den nächsten 24h verfügbar`
                  : `${freeAnalysesRemaining} free analyses available in the next 24h`}
          </p>
          <p className="mt-1">
            {isPrivilegedUser
              ? isGerman
                ? "Dein Konto ist als Admin oder Staff freigeschaltet und kann beliebig viele Bilder analysieren."
                : "Your account is unlocked as admin or staff and can analyze as many images as needed."
              : isGerman
                ? "Mit deinem Konto werden Analysen gespeichert und später im Verlauf wieder geladen."
                : "With your account, analyses are saved and can be reopened in your history later."}
          </p>
        </div>
      ) : hasHydrated && effectiveSessionStatus !== "loading" ? (
        <div className="mt-3 rounded-[24px] border border-[#d7ddd4] bg-[linear-gradient(180deg,#f8faf8_0%,#f0f4f1_100%)] px-4 py-4 text-sm leading-6 text-stone-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                {isGerman ? "Login erforderlich" : "Login required"}
              </div>
              <p className="mt-3 text-base font-semibold text-stone-950 sm:text-[1.05rem]">
                {isGerman
                  ? "Für die Analyse bitte anmelden oder registrieren"
                  : "Please sign in or register for analysis"}
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                {isGerman
                  ? "Mit einem Smokeify Konto werden deine Analysen gespeichert und du kannst direkt mit der Auswertung starten."
                  : "With a Smokeify account your analyses are saved and you can start the evaluation directly."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-[260px] sm:flex-row sm:justify-end">
              <Link
                href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[#1d4d3a] bg-[#1f5a45] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,90,69,0.18)] transition hover:bg-[#184a39] sm:w-auto ${lightFocusRing}`}
              >
                {isGerman ? "Anmelden" : "Sign in"}
              </Link>
              <Link
                href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-stone-100 sm:w-auto ${lightFocusRing}`}
              >
                {isGerman ? "Registrieren" : "Register"}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="w-fit rounded-2xl border border-amber-200 bg-white p-2 text-amber-700">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-amber-900">
              {isGerman ? "Wichtiger Hinweis" : "Important note"}
            </p>
            <p className="mt-1">
              {isGerman
                ? "Die Analyse ist nur eine KI-gestützte Ersteinschätzung und nicht zu 100 % zuverlässig. Prüfe wichtige Entscheidungen zusätzlich selbst."
                : "This analysis is only an AI-assisted first assessment and is not 100% reliable. Double-check important decisions yourself."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlantAnalyzerResultSection({
  sectionRef,
  locale,
  status,
  result,
  comparisonEntry,
  imagePreview,
  loadingSteps,
  loadingStepIndex,
  onCancelAnalysis,
  feedbackStatus,
  feedbackMessage,
  shoppingListStatus,
  shoppingListMessage,
  onHelpful,
  onIssueGuessWrong,
  onProductSuggestionOff,
  onAddShoppingList,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  locale: Locale;
  status: AnalyzerStatus;
  result: AnalyzerResponse | null;
  comparisonEntry: AnalysisHistoryEntry | null;
  imagePreview: string | null;
  loadingSteps: LoadingStep[];
  loadingStepIndex: number;
  onCancelAnalysis: () => void;
  feedbackStatus: AsyncStatus;
  feedbackMessage: string | null;
  shoppingListStatus: AsyncStatus;
  shoppingListMessage: string | null;
  onHelpful: () => void;
  onIssueGuessWrong: () => void;
  onProductSuggestionOff: () => void;
  onAddShoppingList: () => void;
}) {
  const isGerman = locale === "de";
  const showAnalysisPanel = status === "loading" || result !== null;

  if (!showAnalysisPanel) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="w-full overflow-hidden rounded-[32px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(26,22,19,0.98),rgba(12,11,10,1))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.26)] sm:p-5"
    >
      {status === "loading" ? (
        <div className="rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(72,58,28,0.34)_0%,rgba(26,22,19,0.98)_34%,rgba(16,14,13,1)_100%)] px-4 py-6 text-[var(--smk-text)] shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:px-6 sm:py-8">
          <div className="mb-4 inline-flex items-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-[var(--smk-accent-2)] backdrop-blur-sm">
            {isGerman ? "Live-Analyse" : "Live analysis"}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--smk-accent-2)]">
                {isGerman ? "Analyse läuft" : "Analysis running"}
              </p>
              <h3 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
                {isGerman
                  ? "Wir lesen gerade das Foto und bauen den Bericht auf"
                  : "We are reading the photo and building the report"}
              </h3>
              <p className={`mt-3 max-w-xl text-sm leading-6 ${smokeifyMutedCopyClass}`}>
                {isGerman
                  ? "Danach bekommst du direkt Problemschätzung, Sicherheit, konkrete Checks und nur passende Produkthinweise."
                  : "The image is being reviewed, likely issues are being estimated and next steps plus product hints are being prepared."}
              </p>
            </div>
            <div className="w-fit rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] p-3 text-[var(--smk-accent-2)] shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm">
              <BeakerIcon className="h-7 w-7 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            {loadingSteps.map((step, index) => {
              const isActive = loadingStepIndex === index;

              return (
                <div
                  key={step.title}
                  className={`rounded-2xl border px-4 py-4 transition duration-500 ${
                    isActive
                      ? "translate-y-[-2px] border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.07)] shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                      : "border-[var(--smk-border)] bg-[rgba(0,0,0,0.16)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                      <div
                        className={`absolute inset-0 rounded-full ${
                          isActive ? "animate-ping opacity-60" : "opacity-25"
                        }`}
                        style={{ backgroundColor: step.color }}
                      />
                      <div
                        className="relative h-3 w-3 rounded-full"
                        style={{ backgroundColor: step.color }}
                      />
                    </div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:ml-auto ${
                        isActive
                          ? "bg-[rgba(255,255,255,0.08)] text-[var(--smk-accent-2)]"
                          : "bg-[rgba(255,255,255,0.05)] text-[var(--smk-text-dim)]"
                      }`}
                    >
                      {index < loadingStepIndex
                        ? isGerman
                          ? "Fertig"
                          : "Done"
                        : isActive
                          ? isGerman
                            ? "Aktiv"
                            : "Active"
                          : isGerman
                            ? "Wartet"
                            : "Queued"}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${smokeifyMutedCopyClass}`}>
                    {step.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <div className={`mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] ${smokeifyMutedCopyClass}`}>
              <span>{isGerman ? "Fortschritt" : "Progress"}</span>
              <span>
                {Math.round(((loadingStepIndex + 1) / loadingSteps.length) * 100)}
                %
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#E4C56C] via-[#f5e8bc] to-[#d97745] shadow-[0_0_18px_rgba(228,197,108,0.35)] transition-all duration-700"
                style={{
                  width: `${((loadingStepIndex + 1) / loadingSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelAnalysis}
            className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm font-semibold text-[var(--smk-text)] transition hover:bg-[rgba(255,255,255,0.09)] sm:w-auto ${darkFocusRing}`}
          >
            <XMarkIcon className="mr-2 h-4 w-4" />
            {isGerman ? "Analyse abbrechen" : "Cancel analysis"}
          </button>
        </div>
      ) : result ? (
        <div className="space-y-5 sm:space-y-6">
          <div
            className={`rounded-[26px] border px-4 py-4 sm:px-5 ${resultHeroClasses(
              result.diagnosis.healthStatus,
            )}`}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
                    {isGerman ? "Analyse" : "Analysis"}
                  </p>
                  <h3
                    className={`mt-2 text-[1.9rem] font-bold tracking-tight sm:text-3xl ${resultHeroAccentClasses(
                      result.diagnosis.healthStatus,
                    )}`}
                  >
                    {healthStatusLabel(result.diagnosis.healthStatus, locale)}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
                    {result.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-semibold text-white">
                      {isGerman ? "Erkannt" : "Detected"}:{" "}
                      {result.diagnosis.species || (isGerman ? "Unbekannt" : "Unknown")}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-semibold text-white">
                      {isGerman ? "Sicherheit" : "Confidence"}{" "}
                      {confidenceLabel(result.diagnosis.confidence)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-semibold text-white">
                      {isGerman ? "Band" : "Band"} {confidenceBandLabel(result.confidenceBand, locale)}
                    </span>
                    <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-sm font-semibold text-white">
                      {urgencyLabel(result.remediation.urgency, locale)}
                    </span>
                  </div>
                </div>
                {result.analysisContext ? (
                  <div className="flex flex-wrap gap-2">
                    {renderContextSummary(result.analysisContext, locale).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/78"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-center overflow-hidden rounded-[22px] border border-white/10 bg-black/18 p-3 sm:p-4">
                {imagePreview ? (
                  <div className="aspect-square w-full max-w-[220px] overflow-hidden rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.05)]">
                    <UploadedPlantImage
                      src={imagePreview}
                      alt={
                        isGerman
                          ? "Analysiertes Pflanzenfoto"
                          : "Analyzed plant photo"
                      }
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.05)] text-white/40">
                    <PhotoIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {comparisonEntry ? (
            <div className="rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-sm text-[var(--smk-text)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                {isGerman ? "Vergleich mit letztem Check" : "Compared with last check"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
                {isGerman
                  ? `Vorheriger Bericht vom ${formatDate(comparisonEntry.analyzedAt, locale)} ist als Vergleich verfügbar.`
                  : `Previous report from ${formatDate(comparisonEntry.analyzedAt, locale)} is available for comparison.`}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3">
            {result.diagnosis.issues.length > 0 ? (
              result.diagnosis.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-[24px] border px-4 py-4 shadow-sm ${severityCardClasses(
                    issue.severity,
                  )}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          issue.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : issue.severity === "healthy"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <SeverityIcon severity={issue.severity} />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-[var(--smk-text)]">
                          {issue.label}
                        </p>
                        <p className={`mt-1 text-sm ${smokeifyMutedCopyClass}`}>
                          {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                          {confidenceLabel(issue.confidence)}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-[var(--smk-text)]">
                      {severityLabel(issue.severity, locale)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={`${smokeifyInsetCardClass} text-sm ${smokeifyMutedCopyClass}`}>
                {isGerman
                  ? "Kein klarer Befund erkannt."
                  : "No clear finding detected."}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={smokeifyPanelClass}>
              <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
                {isGerman ? "Konkrete nächste Schritte" : "Concrete next steps"}
              </h3>
              <ul className={`mt-3 space-y-3 text-sm leading-6 ${smokeifyBodyCopyClass}`}>
                {result.immediateActions.map((entry, index) => (
                  <li
                    key={entry}
                    className={`flex items-start gap-3 ${smokeifyInsetCardClass}`}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                      {index + 1}
                    </span>
                    <span className="pt-1">{entry}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={smokeifyPanelClass}>
              <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
                {isGerman ? "Mögliche Ursachen" : "Possible causes"}
              </h3>
              <div className="mt-3 grid gap-3">
                {result.possibleCauses.map((cause) => (
                  <div key={cause.label} className={smokeifyInsetCardClass}>
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm font-semibold ${smokeifyBodyCopyClass}`}>{cause.label}</p>
                      <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs font-semibold text-[var(--smk-text)]">
                        {confidenceLabel(cause.confidence)}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${smokeifyMutedCopyClass}`}>{cause.whyThisFits}</p>
                    <p className={`mt-2 text-xs leading-5 ${smokeifyMutedCopyClass}`}>{cause.whatCouldAlsoExplainIt}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={smokeifyPanelClass}>
              <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
                {isGerman ? "Checks zur Verifikation" : "Verification checks"}
              </h3>
              <div className="mt-3 grid gap-3">
                {result.verificationChecks.map((check) => (
                  <div key={check.id} className={smokeifyInsetCardClass}>
                    <p className={`text-sm font-semibold ${smokeifyBodyCopyClass}`}>{check.title}</p>
                    <p className={`mt-2 text-sm leading-6 ${smokeifyMutedCopyClass}`}>{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={smokeifyPanelClass}>
              <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
                {isGerman ? "Recheck und Umfeld" : "Recheck and environment"}
              </h3>
              <div className="mt-3 grid gap-3">
                {[...result.deferActions, ...result.environmentConsiderations].map((item) => (
                  <div key={item} className={`${smokeifyInsetCardClass} text-sm leading-6 ${smokeifyBodyCopyClass}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-[rgba(228,197,108,0.24)] bg-[rgba(101,74,25,0.24)] px-4 py-3 text-sm text-[#f4cf8f]">
                {result.uncertaintyNote}
              </div>
            </div>
          </div>

          <div className={smokeifyPanelClass}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
                {isGerman
                  ? "Passende Produkte aus dem Shop"
                  : "Relevant products from the shop"}
              </h3>
              <button
                type="button"
                onClick={onAddShoppingList}
                disabled={shoppingListStatus === "loading" || result.productSuggestions.length === 0}
                className={`smk-button-primary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
              >
                {shoppingListStatus === "loading"
                  ? isGerman
                    ? "Wird hinzugefügt ..."
                    : "Adding ..."
                  : isGerman
                    ? "Checkliste in Warenkorb"
                    : "Add checklist to cart"}
              </button>
            </div>
            <p className={`mt-3 text-sm leading-6 ${smokeifyMutedCopyClass}`}>
              {result.remediation.productBundle.summary}
            </p>
            <div className="mt-4">
              <ProductSuggestionGrid
                locale={locale}
                productSuggestions={
                  result.remediation.productBundle.optionalProducts.length > 0 ||
                  result.remediation.productBundle.setupHelpers.length > 0
                    ? [
                        ...result.remediation.productBundle.optionalProducts,
                        ...result.remediation.productBundle.setupHelpers,
                      ]
                    : result.productSuggestions
                }
              />
            </div>
            {shoppingListMessage ? (
              <p className={`mt-3 text-sm ${smokeifyMutedCopyClass}`}>{shoppingListMessage}</p>
            ) : null}
          </div>

          <div className={smokeifyPanelClass}>
            <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
              {isGerman ? "Weiterführende Guides" : "Further guides"}
            </h3>
            <div className="mt-4">
              <GuideSuggestionList
                locale={locale}
                guideSuggestions={result.guideSuggestions}
              />
            </div>
          </div>

          <div className={smokeifyPanelClass}>
            <h3 className={`text-lg font-semibold ${smokeifyBodyCopyClass}`}>
              {isGerman ? "Feedback zur Einschätzung" : "Feedback on this assessment"}
            </h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onHelpful}
                disabled={feedbackStatus === "loading"}
                className={`smk-button-primary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
              >
                {isGerman ? "Hilfreich" : "Helpful"}
              </button>
              <button
                type="button"
                onClick={onIssueGuessWrong}
                disabled={feedbackStatus === "loading"}
                className={`smk-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
              >
                {isGerman ? "Problemschätzung unpassend" : "Issue estimate off"}
              </button>
              <button
                type="button"
                onClick={onProductSuggestionOff}
                disabled={feedbackStatus === "loading"}
                className={`smk-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
              >
                {isGerman ? "Produkthinweise unpassend" : "Product hints off"}
              </button>
            </div>
            {result.lastFeedback ? (
              <p className={`mt-3 text-sm ${smokeifyMutedCopyClass}`}>
                {feedbackLabel(result.lastFeedback, locale)}
              </p>
            ) : null}
            {feedbackMessage ? (
              <p className={`mt-3 text-sm ${smokeifyMutedCopyClass}`}>{feedbackMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PlantAnalyzerHistorySection({
  locale,
  pathname,
  hasHydrated,
  effectiveSessionStatus,
  isAuthenticated,
  historyStatus,
  historyRequested,
  history,
  onLoadHistory,
  onOpenHistoryReport,
}: {
  locale: Locale;
  pathname: string | null;
  hasHydrated: boolean;
  effectiveSessionStatus: AnalyzerSessionStatus;
  isAuthenticated: boolean;
  historyStatus: AsyncStatus;
  historyRequested: boolean;
  history: AnalysisHistoryEntry[];
  onLoadHistory: () => void;
  onOpenHistoryReport: (entry: AnalysisHistoryEntry) => void;
}) {
  const isGerman = locale === "de";

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(24,20,18,0.98),rgba(14,12,11,0.99))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
            {isGerman ? "Analyseverlauf" : "Analysis history"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--smk-text)]">
            {isGerman
              ? "Dein persönliches Pflanzenjournal"
              : "Your personal plant journal"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
            {isGerman
              ? "Frühere Analysen bleiben sichtbar, damit du Symptome, Trends und Empfehlungen später ruhiger vergleichen kannst."
              : "Earlier analyses stay visible so you can compare symptoms, trends and recommendations more calmly later on."}
          </p>
        </div>
        <div className="w-fit self-start rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] p-3 text-[var(--smk-accent-2)] sm:self-auto">
          <ClockIcon className="h-6 w-6" />
        </div>
      </div>

      {!hasHydrated || effectiveSessionStatus === "loading" ? (
        <div className="mt-6 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-8 text-sm text-[var(--smk-text-muted)] sm:px-6">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : !isAuthenticated ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.03)] px-4 py-10 text-center sm:px-6">
          <UserCircleIcon className="mx-auto h-8 w-8 text-[var(--smk-text-dim)]" />
          <p className="mt-4 text-base font-semibold text-[var(--smk-text)]">
            {isGerman ? "Verlauf nach Login verfügbar" : "History after login"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
            {isGerman
              ? "Melde dich an oder registriere dich, damit neue Analysen in deinem Verlauf gespeichert werden."
              : "Sign in or create an account so new analyses are saved to your history."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
              className={`smk-button-primary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
            >
              {isGerman ? "Anmelden" : "Sign in"}
            </Link>
            <Link
              href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
              className={`smk-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
            >
              {isGerman ? "Registrieren" : "Register"}
            </Link>
          </div>
        </div>
      ) : !historyRequested ? (
        <div className="mt-6 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:px-6">
          <p className="text-base font-semibold text-[var(--smk-text)]">
            {isGerman
              ? "Verlauf bei Bedarf laden"
              : "Load your history when you need it"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
            {isGerman
              ? "Der Verlauf wird nicht mehr direkt beim Seitenaufruf geladen. Öffne ihn erst, wenn du frühere Berichte vergleichen willst."
              : "History is no longer loaded on initial page view. Open it only when you want to compare previous reports."}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className={`smk-button-primary mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
          >
            {isGerman ? "Verlauf laden" : "Load history"}
          </button>
        </div>
      ) : historyStatus === "loading" ? (
        <div className="mt-6 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-8 text-sm text-[var(--smk-text-muted)] sm:px-6">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : historyStatus === "error" ? (
        <div className="mt-6 rounded-[24px] border border-[rgba(239,143,127,0.28)] bg-[rgba(62,26,24,0.82)] px-4 py-8 text-center sm:px-6">
          <p className="text-base font-semibold text-[#f1a395]">
            {isGerman
              ? "Verlauf konnte nicht geladen werden"
              : "History could not be loaded"}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className={`smk-button-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${darkFocusRing}`}
          >
            {isGerman ? "Erneut versuchen" : "Try again"}
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.03)] px-4 py-10 text-center sm:px-6">
          <ClockIcon className="mx-auto h-8 w-8 text-[var(--smk-text-dim)]" />
          <p className="mt-4 text-base font-semibold text-[var(--smk-text)]">
            {isGerman
              ? "Noch keine gespeicherten Analysen"
              : "No saved analyses yet"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
            {isGerman
              ? "Sobald du ein Bild analysierst, erscheint es hier in deinem Verlauf."
              : "As soon as you analyze an image, it will appear here in your history."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[26px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(31,27,24,0.98),rgba(18,16,14,0.99))] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.2)] sm:p-5"
            >
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] shadow-[0_10px_24px_rgba(0,0,0,0.08)] sm:h-28 sm:w-28">
                  {entry.imageUri ? (
                    <UploadedPlantImage
                      src={entry.imageUri}
                      alt={
                        isGerman
                          ? "Gespeichertes Pflanzenfoto"
                          : "Saved plant photo"
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--smk-text-dim)]">
                      <PhotoIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-[var(--smk-text)]">
                        {entry.species || (isGerman ? "Unbekannt" : "Unknown")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--smk-text-muted)]">
                        {formatDate(entry.analyzedAt, locale)}
                      </p>
                    </div>
                    <span
                      className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${healthStatusClasses(
                        entry.healthStatus,
                      )}`}
                    >
                      {healthStatusLabel(entry.healthStatus, locale)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {entry.issues.slice(0, 2).map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-[var(--smk-text)]">
                              {issue.label}
                            </p>
                            <p className="mt-1 text-xs text-[var(--smk-text-muted)]">
                              {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                              {confidenceLabel(issue.confidence)}
                            </p>
                          </div>
                          <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[11px] font-semibold text-[var(--smk-text)]">
                            {severityLabel(issue.severity, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {entry.recommendations[0] ? (
                    <div className="mt-4 rounded-[18px] border border-[rgba(127,207,150,0.2)] bg-[rgba(127,207,150,0.12)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9e8bc]">
                        {isGerman ? "Erster Schritt" : "First step"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--smk-text)]">
                        {entry.recommendations[0]}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onOpenHistoryReport(entry)}
                      className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#184a39] bg-[#1f5a45] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,90,69,0.24)] transition hover:bg-[#184a39] ${lightFocusRing}`}
                    >
                      {isGerman
                        ? "Vollständigen Bericht öffnen"
                        : "Open full report"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PlantAnalyzerAuthModal({
  locale,
  pathname,
  onClose,
}: {
  locale: Locale;
  pathname: string | null;
  onClose: () => void;
}) {
  const isGerman = locale === "de";
  const dialogTitleId = "plant-analyzer-auth-title";
  const dialogDescriptionId = "plant-analyzer-auth-description";

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:items-center sm:px-4 sm:pb-6 sm:pt-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] overflow-y-auto rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(28,24,21,0.98),rgba(12,11,10,1))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isGerman ? "Schließen" : "Close"}
          className={`absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 ${lightFocusRing}`}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {isGerman ? "Analyse mit Verlauf" : "Analysis with history"}
        </div>
        <h3 id={dialogTitleId} className="pr-12 text-xl font-semibold text-stone-900">
          {isGerman
            ? "Bitte anmelden oder registrieren"
            : "Please sign in or register"}
        </h3>
        <p id={dialogDescriptionId} className="mt-2 text-sm leading-relaxed text-stone-500">
          {isGerman
            ? "Damit deine Pflanzenanalysen gespeichert werden und im Verlauf sichtbar bleiben, brauchst du ein Smokeify Konto."
            : "You need a Smokeify account so your plant analyses are saved and stay visible in your history."}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
            onClick={onClose}
            className={`inline-flex w-full items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24312b] ${lightFocusRing}`}
          >
            {isGerman ? "Anmelden" : "Sign in"}
          </Link>
          <Link
            href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
            onClick={onClose}
            className={`inline-flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50 ${lightFocusRing}`}
          >
            {isGerman ? "Registrieren" : "Register"}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600 ${lightFocusRing}`}
        >
          {isGerman ? "Abbrechen" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

export function PlantAnalyzerHistoryModal({
  locale,
  entry,
  detail,
  detailStatus,
  feedbackStatus,
  feedbackMessage,
  shoppingListStatus,
  shoppingListMessage,
  onAddShoppingList,
  onFollowUpImproved,
  onFollowUpWorsened,
  onUseAsRecheckBaseline,
  onClose,
}: {
  locale: Locale;
  entry: AnalysisHistoryEntry;
  detail: HistoryReportDetail | null;
  detailStatus: AsyncStatus;
  feedbackStatus: AsyncStatus;
  feedbackMessage: string | null;
  shoppingListStatus: AsyncStatus;
  shoppingListMessage: string | null;
  onAddShoppingList: () => void;
  onFollowUpImproved: () => void;
  onFollowUpWorsened: () => void;
  onUseAsRecheckBaseline: () => void;
  onClose: () => void;
}) {
  const isGerman = locale === "de";
  const dialogTitleId = "plant-analyzer-history-title";

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto overscroll-contain bg-black/50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-[6px] sm:px-4 sm:pb-6 sm:pt-6">
      <button
        type="button"
        className="absolute inset-0 z-0"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative z-10 mx-auto flex w-full max-w-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(28,24,21,0.98),rgba(12,11,10,1))] p-4 shadow-[0_22px_50px_rgba(0,0,0,0.26)] sm:my-6 sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <div className="-mx-4 -mt-4 overflow-hidden rounded-t-3xl border-b border-[#244136] bg-[#16382d] px-4 py-4 text-white sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-5">
          <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <h3 id={dialogTitleId} className="pr-12 text-xl font-bold tracking-tight sm:text-2xl">
                {isGerman ? "Deine Pflanze" : "Your plant"}
              </h3>
              <p className="mt-2 text-sm text-white/78">
                {formatDate(entry.analyzedAt, locale)}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStatusClasses(
                entry.healthStatus,
              )}`}
            >
              {healthStatusLabel(entry.healthStatus, locale)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={isGerman ? "Schließen" : "Close"}
              className={`absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16 ${darkFocusRing}`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {isGerman ? "Sicherheit" : "Confidence"}
              </p>
              <p className="mt-1 text-xl font-bold text-[#f5e8bc]">
                {confidenceLabel(entry.confidence)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {isGerman ? "Befunde" : "Findings"}
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {entry.issues.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {isGerman ? "Empfehlungen" : "Recommendations"}
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {entry.recommendations.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6 overflow-y-auto pr-1">
          {detail?.imageUri ? (
            <div className="rounded-[26px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                  {isGerman ? "Analysiertes Foto" : "Analyzed photo"}
                </h4>
                <span className="text-xs text-[var(--smk-text-dim)]">
                  {isGerman ? "Gespeichert im Bericht" : "Saved in report"}
                </span>
              </div>
              <div className="mt-3 flex justify-center p-2">
                <div className="aspect-square w-full max-w-[320px] overflow-hidden rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)]">
                  <UploadedPlantImage
                    src={detail.imageUri}
                    alt={
                      isGerman
                        ? "Analysiertes Pflanzenfoto"
                        : "Analyzed plant photo"
                    }
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              {isGerman ? "Problemschätzungen" : "Issue estimates"}
            </h4>
            <div className="mt-3 grid gap-3">
              {entry.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-[24px] border px-4 py-4 shadow-sm ${severityCardClasses(
                    issue.severity,
                  )}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          issue.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : issue.severity === "healthy"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <SeverityIcon severity={issue.severity} />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-[var(--smk-text)]">
                          {issue.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--smk-text-muted)]">
                          {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                          {confidenceLabel(issue.confidence)}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-[var(--smk-text)]">
                      {severityLabel(issue.severity, locale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={smokeifyPanelClass}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              {isGerman ? "Zusammenfassung und nächste Schritte" : "Summary and next steps"}
            </h4>
            {detail ? (
              <p className="mt-3 text-sm leading-6 text-[var(--smk-text-muted)]">{detail.summary}</p>
            ) : null}
            <ul className="mt-3 grid gap-3">
              {(detail?.immediateActions ?? entry.recommendations).map((recommendation, index) => (
                <li
                  key={recommendation}
                  className={`flex gap-3 ${smokeifyInsetCardClass} shadow-sm`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm leading-6 text-[var(--smk-text)]">
                    {recommendation}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {detail ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={smokeifyPanelClass}>
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                  {isGerman ? "Mögliche Ursachen" : "Possible causes"}
                </h4>
                <div className="mt-3 grid gap-3">
                  {detail.possibleCauses.map((cause) => (
                    <div key={cause.label} className={smokeifyInsetCardClass}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--smk-text)]">{cause.label}</p>
                        <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs font-semibold text-[var(--smk-text)]">
                          {confidenceLabel(cause.confidence)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">{cause.whyThisFits}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={smokeifyPanelClass}>
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                  {isGerman ? "Verifikation" : "Verification"}
                </h4>
                <div className="mt-3 grid gap-3">
                  {detail.verificationChecks.map((check) => (
                    <div key={check.id} className={smokeifyInsetCardClass}>
                      <p className="text-sm font-semibold text-[var(--smk-text)]">{check.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className={smokeifyPanelClass}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              {isGerman ? "Produktempfehlungen" : "Product recommendations"}
            </h4>
            {detail ? (
              <p className="mt-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                {detail.remediation.productBundle.summary}
              </p>
            ) : null}
            <div className="mt-3">
              {detailStatus === "loading" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className="rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-3"
                    >
                      <div className="flex gap-3">
                        <div className="h-20 w-20 rounded-2xl bg-[rgba(255,255,255,0.08)] animate-pulse" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-4 w-3/4 rounded bg-[rgba(255,255,255,0.08)] animate-pulse" />
                          <div className="h-3 w-full rounded bg-[rgba(255,255,255,0.05)] animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-[rgba(255,255,255,0.05)] animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : detailStatus === "error" ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {isGerman
                    ? "Produktempfehlungen konnten nicht geladen werden."
                    : "Product recommendations could not be loaded."}
                </div>
              ) : (
                <ProductSuggestionGrid
                  locale={locale}
                  productSuggestions={
                    detail?.remediation.productBundle.optionalProducts.length ||
                    detail?.remediation.productBundle.setupHelpers.length
                      ? [
                          ...(detail?.remediation.productBundle.optionalProducts ?? []),
                          ...(detail?.remediation.productBundle.setupHelpers ?? []),
                        ]
                      : detail?.productSuggestions ?? []
                  }
                />
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAddShoppingList}
                disabled={shoppingListStatus === "loading" || !detail?.productSuggestions.length}
                className={`smk-button-primary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
              >
                {shoppingListStatus === "loading"
                  ? isGerman
                    ? "Wird hinzugefügt ..."
                    : "Adding ..."
                  : isGerman
                    ? "Checkliste in Warenkorb"
                    : "Add checklist to cart"}
              </button>
            </div>
            {shoppingListMessage ? (
              <p className="mt-3 text-sm text-[var(--smk-text-muted)]">{shoppingListMessage}</p>
            ) : null}
          </div>

          <div className={smokeifyPanelClass}>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              {isGerman ? "Weiterführende Guides" : "Further guides"}
            </h4>
            <div className="mt-3">
              <GuideSuggestionList
                locale={locale}
                guideSuggestions={detail?.guideSuggestions ?? []}
              />
            </div>
          </div>

          {detail ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={smokeifyPanelClass}>
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                  {isGerman ? "Recheck und Verlauf" : "Recheck and trend"}
                </h4>
                <p className="mt-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                  {detail.followUp.previousAnalysisId
                    ? isGerman
                      ? "Dieser Bericht ist bereits mit einem früheren Check verknüpft."
                      : "This report is already linked to an earlier check."
                    : isGerman
                      ? "Nutze diesen Bericht als Basis für einen neuen Recheck."
                    : "Use this report as a baseline for a new recheck."}
                </p>
                {detail.followUp.trendSummary ? (
                  <div className="mt-3 rounded-2xl border border-[var(--smk-border)] bg-[rgba(0,0,0,0.18)] px-4 py-3 text-sm text-[var(--smk-text)]">
                    {isGerman ? "Confidence-Differenz" : "Confidence delta"}:{" "}
                    {detail.followUp.trendSummary.confidenceDelta === null
                      ? "—"
                      : `${Math.round(detail.followUp.trendSummary.confidenceDelta * 100)}%`}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onUseAsRecheckBaseline}
                    className={`smk-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
                  >
                    {isGerman ? "Als Recheck-Basis nutzen" : "Use as recheck baseline"}
                  </button>
                </div>
              </div>

              <div className={smokeifyPanelClass}>
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                  {isGerman ? "Follow-up Feedback" : "Follow-up feedback"}
                </h4>
                <p className="mt-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                  {isGerman
                    ? "Wenn du die Schritte ausprobiert hast, markiere hier, ob der Zustand später besser oder schlechter wurde."
                    : "Once you have tried the steps, mark whether the plant later improved or worsened."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onFollowUpImproved}
                    disabled={feedbackStatus === "loading"}
                    className={`smk-button-primary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
                  >
                    {isGerman ? "Später verbessert" : "Improved later"}
                  </button>
                  <button
                    type="button"
                    onClick={onFollowUpWorsened}
                    disabled={feedbackStatus === "loading"}
                    className={`smk-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold ${darkFocusRing}`}
                  >
                    {isGerman ? "Später verschlechtert" : "Worsened later"}
                  </button>
                </div>
                {detail.lastFeedback ? (
                  <p className="mt-3 text-sm text-[var(--smk-text-muted)]">
                    {feedbackLabel(detail.lastFeedback, locale)}
                  </p>
                ) : null}
                {feedbackMessage ? (
                  <p className="mt-3 text-sm text-[var(--smk-text-muted)]">{feedbackMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 sm:w-auto ${lightFocusRing}`}
          >
            {isGerman ? "Schließen" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
