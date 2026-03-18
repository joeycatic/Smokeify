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
import type { PlantAnalyzerHealthStatus } from "@/lib/plantAnalyzerTypes";

const formatDate = (value: string, locale: Locale) =>
  new Date(value).toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
    return "border-red-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)]";
  }
  if (value === "healthy") {
    return "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)]";
  }
  return "border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_100%)]";
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
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
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
          className="group rounded-[22px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40"
        >
          <div className="flex gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.imageAlt}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-stone-300">
                  <PhotoIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="line-clamp-2 text-base font-semibold leading-6 text-stone-900 sm:text-[1.05rem]">
                {product.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {product.reason}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-lg font-bold tracking-tight text-emerald-800">
                  {product.price
                    ? formatPrice(
                        product.price.amount,
                        product.price.currencyCode,
                        locale,
                      )
                    : ""}
                </p>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm transition group-hover:translate-x-0.5 group-hover:border-emerald-300 group-hover:bg-emerald-50">
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
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
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
          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
        >
          <p className="text-sm font-semibold text-stone-900">{guide.title}</p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
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
    <section className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-600">
          <span className="h-2 w-2 rounded-full bg-[#E4C56C]" />
          {isGerman ? "Smokeify Pflanzenhilfe" : "Smokeify Plant Care"}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={() => onLocaleChange("de")}
            aria-label="Deutsch"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
              isGerman
                ? "bg-[#E4C56C] text-[#20342b]"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <GermanyFlag />
            <span>DE</span>
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange("en")}
            aria-label="English"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
              !isGerman
                ? "bg-[#E4C56C] text-[#20342b]"
                : "text-stone-600 hover:bg-stone-100"
            }`}
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
        <h1 className="mt-2 max-w-4xl text-3xl font-extrabold leading-[1.08] tracking-tight text-stone-950 sm:text-[3rem]">
          {isGerman
            ? "Foto hochladen, klare Empfehlung erhalten, komplett kostenlos"
            : "Upload a photo, add context, get a clear recommendation."}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600 sm:text-base">
          {isGerman
            ? "Die Analyse bezieht dein Bild und optionale Angaben wie Temperatur, pH, Luftfeuchtigkeit oder Medium mit ein und macht die Ersteinschätzung deutlich brauchbarer."
            : "The analysis uses your image plus optional details like temperature, pH, humidity or medium and makes the first assessment much more useful."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="#plant-analyzer-upload"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#E4C56C] px-4 py-2.5 text-sm font-semibold text-[#20342b] shadow-[0_10px_24px_rgba(228,197,108,0.22)] transition hover:bg-[#edd48f]"
          >
            {isGerman ? "Jetzt Foto hochladen" : "Upload photo now"}
          </a>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#20342b] bg-[#eef3f0] px-4 py-2.5 text-sm font-semibold text-[#20342b] transition hover:bg-[#e3ebe6]"
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
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-950">
            {isGerman
              ? "Foto und Kontext für die Analyse"
              : "Photo and context for analysis"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
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
        className={`mt-4 flex w-full min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-4 py-6 text-center transition ${
          isDraggingFile
            ? "border-[#1f5a45] bg-[#edf6f1] shadow-[0_0_0_4px_rgba(31,90,69,0.08)]"
            : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
        }`}
      >
        {imagePreview ? (
          <div className="w-full">
            <div className="mx-auto h-56 w-full max-w-md overflow-hidden rounded-[22px] border border-stone-200 bg-white">
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
              <p className="mt-1 text-xs text-stone-500">{imageName}</p>
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
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          onFileChange(nextFile);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />

      {imagePreview ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              {imageName || (isGerman ? "Ausgewähltes Foto" : "Selected photo")}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {isGerman
                ? "Dieses Bild wird komprimiert hochgeladen und als Bericht gespeichert."
                : "This image is uploaded in a compressed form and saved with the report."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearImage}
            aria-label={isGerman ? "Foto entfernen" : "Remove photo"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : null}

      <div
        className="mt-4 w-full rounded-[28px] border border-[#244136] p-4 text-white shadow-[0_18px_36px_rgba(15,23,42,0.14)] sm:p-5"
        style={{ backgroundColor: "#16382d", color: "#ffffff" }}
      >
        <div
          className="flex min-h-[220px] items-start gap-4 rounded-[24px] border border-white/8 px-4 py-4 sm:px-5"
          style={{ backgroundColor: "#143428" }}
        >
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
              style={{ backgroundColor: "#0f2b22", color: "#ffffff" }}
            />
            <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-3">
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
                  className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-2xl border border-[#f1d98f] bg-[linear-gradient(135deg,#f2d36f_0%,#e4c56c_45%,#d9b754_100%)] px-5 py-3 text-sm font-semibold text-[#173126] shadow-[0_14px_30px_rgba(228,197,108,0.26)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(228,197,108,0.34)] active:translate-y-0 active:scale-[0.99] sm:ml-auto sm:w-auto disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
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
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
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
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#1d4d3a] bg-[#1f5a45] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,90,69,0.18)] transition hover:bg-[#184a39]"
              >
                {isGerman ? "Anmelden" : "Sign in"}
              </Link>
              <Link
                href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-stone-100"
              >
                {isGerman ? "Registrieren" : "Register"}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-amber-200 bg-white p-2 text-amber-700">
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
  imagePreview,
  loadingSteps,
  loadingStepIndex,
  onCancelAnalysis,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  locale: Locale;
  status: AnalyzerStatus;
  result: AnalyzerResponse | null;
  imagePreview: string | null;
  loadingSteps: LoadingStep[];
  loadingStepIndex: number;
  onCancelAnalysis: () => void;
}) {
  const isGerman = locale === "de";
  const showAnalysisPanel = status === "loading" || result !== null;

  if (!showAnalysisPanel) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="w-full overflow-hidden rounded-[28px] border border-[#d4dbd2] bg-[linear-gradient(180deg,#ffffff_0%,#f4f5ef_100%)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5"
    >
      {status === "loading" ? (
        <div className="relative isolate overflow-hidden rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,#16382d_0%,#23483b_45%,#d3be8f_100%)] px-4 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:px-6 sm:py-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-8 h-36 w-36 rounded-full bg-[#E4C56C]/16 blur-3xl animate-pulse" />
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-200/12 blur-3xl animate-[pulse_5s_ease-in-out_infinite]" />
            <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-white/8 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
          </div>
          <div className="relative z-10 mb-4 inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f5e8bc] backdrop-blur-sm">
            {isGerman ? "Live-Analyse" : "Live analysis"}
          </div>
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5e8bc]">
                {isGerman ? "Analyse läuft" : "Analysis running"}
              </p>
              <h3 className="mt-2 text-2xl font-bold">
                {isGerman
                  ? "Wir prüfen gerade dein Pflanzenfoto"
                  : "We are checking your plant photo"}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
                {isGerman
                  ? "Das Bild wird ausgewertet, Probleme werden geschätzt und passende Schritte sowie Produkthinweise werden vorbereitet."
                  : "The image is being reviewed, likely issues are being estimated and next steps plus product hints are being prepared."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-[#f5e8bc] shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <BeakerIcon className="h-7 w-7 animate-pulse" />
            </div>
          </div>
          <div className="relative z-10 mt-6 grid gap-3">
            {loadingSteps.map((step, index) => {
              const isActive = loadingStepIndex === index;

              return (
                <div
                  key={step.title}
                  className={`rounded-2xl border px-4 py-4 transition duration-500 ${
                    isActive
                      ? "translate-y-[-2px] border-white/20 bg-white/16 shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
                      : "border-white/10 bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
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
                      className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                        isActive
                          ? "bg-white/16 text-[#f5e8bc]"
                          : "bg-white/8 text-white/55"
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
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {step.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="relative z-10 mt-6">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              <span>{isGerman ? "Fortschritt" : "Progress"}</span>
              <span>
                {Math.round(((loadingStepIndex + 1) / loadingSteps.length) * 100)}
                %
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#E4C56C] via-[#f5e8bc] to-[#E4C56C] shadow-[0_0_18px_rgba(228,197,108,0.45)] transition-all duration-700"
                style={{
                  width: `${((loadingStepIndex + 1) / loadingSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelAnalysis}
            className="relative z-10 mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            <XMarkIcon className="mr-2 h-4 w-4" />
            {isGerman ? "Analyse abbrechen" : "Cancel analysis"}
          </button>
        </div>
      ) : result ? (
        <div className="space-y-5 sm:space-y-6">
          <div
            className={`rounded-[24px] border px-5 py-4 ${healthStatusClasses(
              result.diagnosis.healthStatus,
            )}`}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                    {isGerman ? "Analyse" : "Analysis"}
                  </p>
                  <h3
                    className={`mt-2 text-3xl font-bold tracking-tight ${
                      result.diagnosis.issues.length > 0
                        ? "text-red-700"
                        : "text-emerald-800"
                    }`}
                  >
                    {healthStatusLabel(result.diagnosis.healthStatus, locale)}
                  </h3>
                  <p
                    className={`mt-2 text-lg ${
                      result.diagnosis.issues.length > 0
                        ? "text-red-700"
                        : "text-stone-800"
                    }`}
                  >
                    {isGerman ? "Erkannt" : "Detected"}:{" "}
                    {result.diagnosis.species || (isGerman ? "Unbekannt" : "Unknown")} ·{" "}
                    {isGerman ? "Sicherheit" : "Confidence"}{" "}
                    {confidenceLabel(result.diagnosis.confidence)}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/70 px-3 py-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {isGerman ? "Befunde" : "Findings"}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">
                      {result.diagnosis.issues.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-3 py-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {isGerman ? "Schritte" : "Steps"}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">
                      {result.diagnosis.recommendations.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center overflow-hidden rounded-[22px] border border-white/70 bg-white/70 p-4">
                {imagePreview ? (
                  <div className="h-[220px] w-[220px] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-100">
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
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-[18px] border border-stone-200 bg-stone-100 text-stone-400">
                    <PhotoIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>
          </div>

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
                    <div className="flex items-start gap-3">
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
                      <div>
                        <p className="text-base font-semibold text-stone-900">
                          {issue.label}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                          {confidenceLabel(issue.confidence)}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                      {severityLabel(issue.severity, locale)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                {isGerman
                  ? "Kein klarer Befund erkannt."
                  : "No clear finding detected."}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-[#d7ddd4] bg-white/90 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold text-stone-900">
              {isGerman ? "Konkrete nächste Schritte" : "Concrete next steps"}
            </h3>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
              {result.diagnosis.recommendations.map((entry, index) => (
                <li
                  key={entry}
                  className="flex gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <span className="pt-1">{entry}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[24px] border border-[#d7ddd4] bg-white/90 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold text-stone-900">
              {isGerman
                ? "Passende Produkte aus dem Shop"
                : "Relevant products from the shop"}
            </h3>
            <div className="mt-4">
              <ProductSuggestionGrid
                locale={locale}
                productSuggestions={result.productSuggestions}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7ddd4] bg-white/90 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold text-stone-900">
              {isGerman ? "Weiterführende Guides" : "Further guides"}
            </h3>
            <div className="mt-4">
              <GuideSuggestionList
                locale={locale}
                guideSuggestions={result.guideSuggestions}
              />
            </div>
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
    <section className="overflow-hidden rounded-[28px] border border-[#d4dbd2] bg-[linear-gradient(180deg,#ffffff_0%,#f6f4ec_100%)] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="flex items-start justify-between gap-3 rounded-[24px] border border-[#d8dfd4] bg-white/80 px-4 py-4 sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            {isGerman ? "Analyseverlauf" : "Analysis history"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {isGerman
              ? "Dein persönliches Pflanzenjournal"
              : "Your personal plant journal"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {isGerman
              ? "Frühere Analysen bleiben sichtbar, damit du Symptome, Trends und Empfehlungen später ruhiger vergleichen kannst."
              : "Earlier analyses stay visible so you can compare symptoms, trends and recommendations more calmly later on."}
          </p>
        </div>
        <div className="rounded-2xl border border-[#d8dfd4] bg-stone-50 p-3 text-stone-700">
          <ClockIcon className="h-6 w-6" />
        </div>
      </div>

      {!hasHydrated || effectiveSessionStatus === "loading" ? (
        <div className="mt-6 rounded-[24px] border border-black/10 bg-stone-50 px-6 py-8 text-sm text-stone-500">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : !isAuthenticated ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[#b8c7ba] bg-[linear-gradient(180deg,#fffef9_0%,#f3f5ef_100%)] px-6 py-10 text-center">
          <UserCircleIcon className="mx-auto h-8 w-8 text-stone-400" />
          <p className="mt-4 text-base font-semibold text-stone-800">
            {isGerman ? "Verlauf nach Login verfügbar" : "History after login"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {isGerman
              ? "Melde dich an oder registriere dich, damit neue Analysen in deinem Verlauf gespeichert werden."
              : "Sign in or create an account so new analyses are saved to your history."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
              className="inline-flex items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#24312b]"
            >
              {isGerman ? "Anmelden" : "Sign in"}
            </Link>
            <Link
              href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50"
            >
              {isGerman ? "Registrieren" : "Register"}
            </Link>
          </div>
        </div>
      ) : !historyRequested ? (
        <div className="mt-6 rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-base font-semibold text-stone-900">
            {isGerman
              ? "Verlauf bei Bedarf laden"
              : "Load your history when you need it"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {isGerman
              ? "Der Verlauf wird nicht mehr direkt beim Seitenaufruf geladen. Öffne ihn erst, wenn du frühere Berichte vergleichen willst."
              : "History is no longer loaded on initial page view. Open it only when you want to compare previous reports."}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#184a39] bg-[#1f5a45] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,90,69,0.18)] transition hover:bg-[#184a39]"
          >
            {isGerman ? "Verlauf laden" : "Load history"}
          </button>
        </div>
      ) : historyStatus === "loading" ? (
        <div className="mt-6 rounded-[24px] border border-black/10 bg-stone-50 px-6 py-8 text-sm text-stone-500">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : historyStatus === "error" ? (
        <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-base font-semibold text-red-900">
            {isGerman
              ? "Verlauf konnte nicht geladen werden"
              : "History could not be loaded"}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            {isGerman ? "Erneut versuchen" : "Try again"}
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-[#b8c7ba] bg-[linear-gradient(180deg,#fffef9_0%,#f3f5ef_100%)] px-6 py-10 text-center">
          <ClockIcon className="mx-auto h-8 w-8 text-stone-400" />
          <p className="mt-4 text-base font-semibold text-stone-800">
            {isGerman
              ? "Noch keine gespeicherten Analysen"
              : "No saved analyses yet"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
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
              className="rounded-[26px] border border-[#d8dfd4] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf7_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-[22px] border border-stone-200 bg-stone-100 shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:h-28 sm:w-28">
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
                    <div className="flex h-full items-center justify-center text-stone-300">
                      <PhotoIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-stone-950">
                        {entry.species || (isGerman ? "Unbekannt" : "Unknown")}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
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
                        className="rounded-[18px] border border-stone-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900">
                              {issue.label}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                              {confidenceLabel(issue.confidence)}
                            </p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                            {severityLabel(issue.severity, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {entry.recommendations[0] ? (
                    <div className="mt-4 rounded-[18px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                        {isGerman ? "Erster Schritt" : "First step"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-emerald-950/85">
                        {entry.recommendations[0]}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onOpenHistoryReport(entry)}
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#184a39] bg-[#1f5a45] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,90,69,0.24)] transition hover:bg-[#184a39]"
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

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-[#d8dfd4] bg-[linear-gradient(180deg,#fffef9_0%,#ffffff_100%)] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.30)] sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {isGerman ? "Analyse mit Verlauf" : "Analysis with history"}
        </div>
        <h3 className="text-xl font-semibold text-stone-900">
          {isGerman
            ? "Bitte anmelden oder registrieren"
            : "Please sign in or register"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          {isGerman
            ? "Damit deine Pflanzenanalysen gespeichert werden und im Verlauf sichtbar bleiben, brauchst du ein Smokeify Konto."
            : "You need a Smokeify account so your plant analyses are saved and stay visible in your history."}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24312b]"
          >
            {isGerman ? "Anmelden" : "Sign in"}
          </Link>
          <Link
            href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50"
          >
            {isGerman ? "Registrieren" : "Register"}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600"
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
  onClose,
}: {
  locale: Locale;
  entry: AnalysisHistoryEntry;
  detail: HistoryReportDetail | null;
  detailStatus: AsyncStatus;
  onClose: () => void;
}) {
  const isGerman = locale === "de";

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto overscroll-contain bg-black/50 px-4 pb-4 pt-6 backdrop-blur-[6px] sm:pb-6">
      <button
        type="button"
        className="absolute inset-0 z-0"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative z-10 mx-auto w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.20)] sm:my-6 sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        <div className="-mx-4 -mt-4 overflow-hidden rounded-t-3xl border-b border-[#244136] bg-[#16382d] px-4 py-4 text-white sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-5">
          <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
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

        <div className="mt-6 space-y-6">
          {detail?.imageUri ? (
            <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {isGerman ? "Analysiertes Foto" : "Analyzed photo"}
                </h4>
                <span className="text-xs text-stone-400">
                  {isGerman ? "Gespeichert im Bericht" : "Saved in report"}
                </span>
              </div>
              <div className="mt-3 flex justify-center p-2">
                <div className="h-[260px] w-[260px] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-100 sm:h-[320px] sm:w-[320px]">
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
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
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
                    <div className="flex items-start gap-3">
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
                      <div>
                        <p className="text-base font-semibold text-stone-900">
                          {issue.label}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                          {confidenceLabel(issue.confidence)}
                        </p>
                      </div>
                    </div>
                    <span className="self-start rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700">
                      {severityLabel(issue.severity, locale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {isGerman ? "Empfehlungen" : "Recommendations"}
            </h4>
            <ul className="mt-3 grid gap-3">
              {entry.recommendations.map((recommendation, index) => (
                <li
                  key={recommendation}
                  className="flex gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm leading-6 text-stone-700">
                    {recommendation}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {isGerman ? "Produktempfehlungen" : "Product recommendations"}
            </h4>
            <div className="mt-3">
              {detailStatus === "loading" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className="rounded-[22px] border border-stone-200 bg-stone-50 p-3"
                    >
                      <div className="flex gap-3">
                        <div className="h-20 w-20 rounded-2xl bg-stone-200 animate-pulse" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-4 w-3/4 rounded bg-stone-200 animate-pulse" />
                          <div className="h-3 w-full rounded bg-stone-100 animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-stone-100 animate-pulse" />
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
                  productSuggestions={detail?.productSuggestions ?? []}
                />
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {isGerman ? "Weiterführende Guides" : "Further guides"}
            </h4>
            <div className="mt-3">
              <GuideSuggestionList
                locale={locale}
                guideSuggestions={detail?.guideSuggestions ?? []}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 sm:w-auto"
          >
            {isGerman ? "Schließen" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
