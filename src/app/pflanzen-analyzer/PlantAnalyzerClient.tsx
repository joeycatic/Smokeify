"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowUpTrayIcon,
  ArrowUpRightIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  ClockIcon,
  UserCircleIcon,
  TrashIcon,
  BeakerIcon,
  ShieldExclamationIcon,
  CheckBadgeIcon,
  FireIcon,
} from "@heroicons/react/24/outline";

type AnalyzerResponse = {
  diagnosis: {
    healthStatus: "healthy" | "warning" | "critical";
    species: string;
    confidence: number;
    issues: Array<{
      id: string;
      label: string;
      confidence: number;
      severity: "healthy" | "warning" | "critical";
    }>;
    recommendations: string[];
  };
  productSuggestions: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
    imageAlt: string;
    price: { amount: string; currencyCode: "EUR" } | null;
    reason: string;
  }>;
  guideSuggestions: Array<{
    slug: string;
    title: string;
    description: string;
    href: string;
  }>;
};

type AnalysisHistoryEntry = {
  id: string;
  imageUri: string;
  species: string;
  confidence: number;
  healthStatus: "healthy" | "warning" | "critical";
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: "healthy" | "warning" | "critical";
  }>;
  recommendations: string[];
  analyzedAt: string;
  modelVersion: string;
};

type HistoryReportDetail = {
  id: string;
  imageUri: string;
  diagnosis: {
    healthStatus: "healthy" | "warning" | "critical";
    species: string;
    confidence: number;
    issues: Array<{
      id: string;
      label: string;
      confidence: number;
      severity: "healthy" | "warning" | "critical";
    }>;
    recommendations: string[];
  };
  productSuggestions: AnalyzerResponse["productSuggestions"];
  guideSuggestions: AnalyzerResponse["guideSuggestions"];
};

type Locale = "de" | "en";

const FREE_ANALYSIS_LIMIT = 3;
const FREE_ANALYSIS_WINDOW_HOURS = 24;
const FREE_ANALYSIS_WINDOW_MS = FREE_ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000;

function detectPreferredLocale(): Locale {
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

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function healthStatusLabel(
  value: AnalyzerResponse["diagnosis"]["healthStatus"],
  locale: Locale,
) {
  if (value === "healthy")
    return locale === "de" ? "Eher unkritisch" : "Mostly fine";
  if (value === "critical") {
    return locale === "de" ? "Erhöhter Handlungsbedarf" : "Needs attention";
  }
  return locale === "de" ? "Bitte prüfen" : "Worth checking";
}

function healthStatusClasses(
  value: AnalyzerResponse["diagnosis"]["healthStatus"],
) {
  if (value === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (value === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

function formatPrice(amount: string, currencyCode: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function severityLabel(
  value: "healthy" | "warning" | "critical",
  locale: Locale,
) {
  if (value === "critical") return locale === "de" ? "kritisch" : "critical";
  if (value === "healthy") return locale === "de" ? "unkritisch" : "low risk";
  return locale === "de" ? "prüfen" : "check";
}

function severityCardClasses(value: "healthy" | "warning" | "critical") {
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
  severity: "healthy" | "warning" | "critical";
}) {
  if (severity === "critical") {
    return <FireIcon className="h-5 w-5" />;
  }
  if (severity === "healthy") {
    return <CheckBadgeIcon className="h-5 w-5" />;
  }
  return <ShieldExclamationIcon className="h-5 w-5" />;
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

export default function PlantAnalyzerClient() {
  const inputId = useId();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [locale, setLocale] = useState<Locale>("de");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [notes, setNotes] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzerResponse | null>(null);
  const [historyStatus, setHistoryStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] =
    useState<AnalysisHistoryEntry | null>(null);
  const [selectedHistoryDetail, setSelectedHistoryDetail] =
    useState<HistoryReportDetail | null>(null);
  const [selectedHistoryDetailStatus, setSelectedHistoryDetailStatus] =
    useState<"idle" | "loading" | "error">("idle");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const analysisSectionRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollToAnalysisRef = useRef(false);
  const effectiveSessionStatus = hasHydrated ? sessionStatus : "loading";
  const isAuthenticated = effectiveSessionStatus === "authenticated";
  const userRole = hasHydrated ? (session?.user?.role ?? "USER") : "USER";
  const isPrivilegedUser = userRole === "ADMIN" || userRole === "STAFF";
  const recentAnalysisCount = history.filter((entry) => {
    const analyzedAt = new Date(entry.analyzedAt).getTime();
    return Number.isFinite(analyzedAt)
      ? Date.now() - analyzedAt < FREE_ANALYSIS_WINDOW_MS
      : false;
  }).length;
  const freeAnalysesRemaining = isPrivilegedUser
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_ANALYSIS_LIMIT - recentAnalysisCount);
  const freeAnalysisUsed = !isPrivilegedUser && freeAnalysesRemaining <= 0;
  const isGerman = locale === "de";
  const showAnalysisPanel = status === "loading" || result !== null;
  const localizedUploadTips = isGerman
    ? ["Nah dran", "Ohne Filter", "Gutes Licht"]
    : ["Close up", "No filters", "Good light"];
  const loadingSteps = isGerman
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

  useEffect(() => {
    setHasHydrated(true);
    setLocale(detectPreferredLocale());
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    window.localStorage.setItem("smokeify-plant-analyzer-locale", locale);
  }, [hasHydrated, locale]);

  useEffect(() => {
    if (
      !showAnalysisPanel ||
      status !== "loading" ||
      typeof window === "undefined" ||
      !shouldAutoScrollToAnalysisRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const sectionTop =
        (analysisSectionRef.current?.getBoundingClientRect().top ?? 0) +
        window.scrollY;
      shouldAutoScrollToAnalysisRef.current = false;
      window.scrollTo({
        top: Math.max(0, sectionTop - 128),
        behavior: "smooth",
      });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [showAnalysisPanel, status]);

  useEffect(() => {
    if (status !== "loading") {
      setLoadingStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [loadingSteps.length, status]);

  const clearSelectedImage = () => {
    setImagePreview(null);
    setImageName("");
    setImageUri("");
    setError("");
    setStatus("idle");
    setResult(null);
  };

  const loadHistory = async () => {
    if (effectiveSessionStatus !== "authenticated") {
      setHistory([]);
      return;
    }

    setHistoryStatus("loading");
    try {
      const res = await fetch("/api/plant-analyzer/history?limit=8", {
        method: "GET",
      });
      if (!res.ok) {
        setHistoryStatus("error");
        return;
      }
      const data = (await res.json()) as { analyses?: AnalysisHistoryEntry[] };
      setHistory(data.analyses ?? []);
      setHistoryStatus("idle");
    } catch {
      setHistoryStatus("error");
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSessionStatus, hasHydrated]);

  const handleFileChange = (file: File | null) => {
    setIsDraggingFile(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(
        isGerman ? "Bitte ein Bild hochladen." : "Please upload an image.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = typeof reader.result === "string" ? reader.result : "";
      setImageUri(nextValue);
      setImagePreview(nextValue);
      setImageName(file.name);
      setError("");
      setStatus("idle");
      setResult(null);
    };
    reader.onerror = () => {
      setError(
        isGerman
          ? "Das Bild konnte nicht gelesen werden."
          : "The image could not be read.",
      );
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFile(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    setIsDraggingFile(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFileChange(event.dataTransfer.files?.[0] ?? null);
  };

  const analyzeImage = async () => {
    if (!imageUri) {
      setError(
        isGerman
          ? "Bitte zuerst ein Foto hochladen."
          : "Please upload a photo first.",
      );
      return;
    }
    if (effectiveSessionStatus === "loading") {
      return;
    }
    if (effectiveSessionStatus !== "authenticated") {
      setShowAuthPrompt(true);
      return;
    }
    if (freeAnalysisUsed) {
      setError(
        isGerman
          ? "Deine 3 kostenlosen Analysen in den letzten 24 Stunden wurden bereits verwendet. Das Limit setzt sich nach 24 Stunden zurück."
          : "Your 3 free analyses in the last 24 hours have already been used. The limit resets after 24 hours.",
      );
      return;
    }

    shouldAutoScrollToAnalysisRef.current = true;
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/plant-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUri,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as AnalyzerResponse & { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(
          data.error ??
            (isGerman ? "Analyse fehlgeschlagen." : "Analysis failed."),
        );
        return;
      }
      setResult(data);
      setStatus("success");
      void loadHistory();
    } catch {
      setStatus("error");
      setError(isGerman ? "Analyse fehlgeschlagen." : "Analysis failed.");
    }
  };

  const openHistoryReport = async (entry: AnalysisHistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setSelectedHistoryDetail(null);
    setSelectedHistoryDetailStatus("loading");

    try {
      const res = await fetch(`/api/plant-analyzer/history/${entry.id}`, {
        method: "GET",
      });
      if (!res.ok) {
        setSelectedHistoryDetailStatus("error");
        return;
      }
      const data = (await res.json()) as HistoryReportDetail;
      setSelectedHistoryDetail(data);
      setSelectedHistoryDetailStatus("idle");
    } catch {
      setSelectedHistoryDetailStatus("error");
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-600">
              <span className="h-2 w-2 rounded-full bg-[#E4C56C]" />
              {isGerman ? "Smokeify Pflanzenhilfe" : "Smokeify Plant Care"}
            </div>
          </div>
          <div className="shrink-0">
            <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <button
                type="button"
                onClick={() => setLocale("de")}
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
                onClick={() => setLocale("en")}
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

      <div className="space-y-6">
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
            </div>
          </div>

          <label
            id="plant-analyzer-upload"
            htmlFor={inputId}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-4 flex w-full min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-4 py-6 text-center transition ${
              isDraggingFile
                ? "border-[#1f5a45] bg-[#edf6f1] shadow-[0_0_0_4px_rgba(31,90,69,0.08)]"
                : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
            }`}
          >
            {imagePreview ? (
              <div className="w-full">
                <div className="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-[22px] border border-stone-200 bg-white">
                  <Image
                    src={imagePreview}
                    alt={
                      isGerman
                        ? "Vorschau des hochgeladenen Pflanzenfotos"
                        : "Preview of the uploaded plant photo"
                    }
                    fill
                    sizes="(min-width: 1024px) 35vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-900">
                  {isGerman
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
                  {localizedUploadTips.map((tip) => (
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
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
            className="sr-only"
          />

          {imagePreview ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  {imageName ||
                    (isGerman ? "Ausgewähltes Foto" : "Selected photo")}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {isGerman
                    ? "Dieses Bild wird für die Analyse verwendet."
                    : "This image will be used for the analysis."}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSelectedImage}
                aria-label={isGerman ? "Foto entfernen" : "Remove photo"}
                title={isGerman ? "Foto entfernen" : "Remove photo"}
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
                  {isGerman
                    ? "Kontext für die Analyse"
                    : "Context for the analysis"}
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={
                    isGerman
                      ? "Optional: Temperatur, pH, Luftfeuchtigkeit, Medium, Gießrhythmus oder Beobachtungen."
                      : "Optional: temperature, pH, humidity, medium, watering rhythm or observations."
                  }
                  rows={5}
                  className="mt-3 min-h-[124px] w-full flex-1 resize-y rounded-[20px] border border-white/10 px-4 py-3 text-sm leading-6 text-white [color-scheme:dark] [-webkit-text-fill-color:#ffffff] caret-white outline-none transition placeholder:text-white/38 focus:border-[#E4C56C]/55 focus-visible:ring-2 focus-visible:ring-[#E4C56C]/18"
                  style={{ backgroundColor: "#0f2b22", color: "#ffffff" }}
                />
                <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="rounded-full bg-white/6 px-3 py-2 text-xs leading-5 text-white/92 sm:flex-1">
                    {isGerman
                      ? "Optional, aber hilfreich: Temperatur, pH, Luftfeuchtigkeit, Medium oder kurze Beobachtungen."
                      : "Optional, but helpful: temperature, pH, humidity, medium or short observations."}
                  </p>
                  <button
                    type="button"
                    onClick={analyzeImage}
                    disabled={
                      !imageUri ||
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
                        {status === "loading"
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
                  : freeAnalysisUsed
                    ? isGerman
                      ? `Du hast in den letzten ${FREE_ANALYSIS_WINDOW_HOURS} Stunden bereits ${FREE_ANALYSIS_LIMIT} Bilder analysiert. Das Kontingent setzt sich automatisch zurück.`
                      : `You have already analyzed ${FREE_ANALYSIS_LIMIT} images in the last ${FREE_ANALYSIS_WINDOW_HOURS} hours. The quota resets automatically.`
                    : isGerman
                      ? `Mit deinem Konto kannst du auf der Website bis zu ${FREE_ANALYSIS_LIMIT} Bilder pro ${FREE_ANALYSIS_WINDOW_HOURS} Stunden kostenlos analysieren.`
                      : `With your account, you can analyze up to ${FREE_ANALYSIS_LIMIT} images per ${FREE_ANALYSIS_WINDOW_HOURS} hours for free on the website.`}
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
                    style={{
                      backgroundColor: "#1f5a45",
                      color: "#ffffff",
                      WebkitTextFillColor: "#ffffff",
                    }}
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

        {showAnalysisPanel ? (
          <section
            ref={analysisSectionRef}
            className="w-full overflow-hidden rounded-[28px] border border-[#d4dbd2] bg-[linear-gradient(180deg,#ffffff_0%,#f4f5ef_100%)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5"
          >
            {status === "loading" ? (
              <div className="relative isolate overflow-hidden rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,#16382d_0%,#23483b_45%,#d3be8f_100%)] px-4 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:px-6 sm:py-8">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-16 top-8 h-36 w-36 rounded-full bg-[#E4C56C]/16 blur-3xl animate-pulse" />
                  <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-200/12 blur-3xl animate-[pulse_5s_ease-in-out_infinite]" />
                  <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-white/8 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>

                <div className="relative z-10 mb-4 inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f5e8bc] backdrop-blur-sm">
                  {isGerman ? "Live-Analyse" : "Live analysis"}
                </div>
                <div className="relative z-10 flex items-start justify-between gap-3 sm:gap-4">
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
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        {isGerman ? "Gerade aktiv" : "Currently active"}
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {loadingSteps[loadingStepIndex]?.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/75">
                        {loadingSteps[loadingStepIndex]?.detail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-white/12" />
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#E4C56C] border-r-[#E4C56C] animate-spin" />
                      <div className="absolute inset-[9px] rounded-full border border-white/12" />
                      <div className="absolute h-5 w-5 rounded-full bg-[#E4C56C]/22 animate-ping" />
                      <div className="relative h-2.5 w-2.5 rounded-full bg-[#E4C56C] shadow-[0_0_18px_rgba(228,197,108,0.7)]" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-[#f5e8bc] shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                      <BeakerIcon className="h-7 w-7 animate-pulse" />
                    </div>
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
                    <span>{Math.round(((loadingStepIndex + 1) / loadingSteps.length) * 100)}%</span>
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
                          {healthStatusLabel(
                            result.diagnosis.healthStatus,
                            locale,
                          )}
                        </h3>
                        <p
                          className={`mt-2 text-lg ${
                            result.diagnosis.issues.length > 0
                              ? "text-red-700"
                              : "text-stone-800"
                          }`}
                        >
                          {isGerman ? "Erkannt" : "Detected"}:{" "}
                          {result.diagnosis.species ||
                            (isGerman ? "Unbekannt" : "Unknown")}{" "}
                          · {isGerman ? "Sicherheit" : "Confidence"}{" "}
                          {confidenceLabel(result.diagnosis.confidence)}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:min-w-[220px] sm:grid-cols-2">
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
                        className={`rounded-[24px] border px-4 py-4 shadow-sm ${severityCardClasses(issue.severity)}`}
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
                    {isGerman
                      ? "Konkrete nächste Schritte"
                      : "Concrete next steps"}
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
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.productSuggestions.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.handle}`}
                        className="group rounded-[22px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white sm:h-20 sm:w-20">
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
                </div>

                <div className="rounded-[24px] border border-[#d7ddd4] bg-white/90 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <h3 className="text-lg font-semibold text-stone-900">
                    {isGerman ? "Weiterführende Guides" : "Further guides"}
                  </h3>
                  <div className="mt-4 grid gap-3">
                    {result.guideSuggestions.map((guide) => (
                      <Link
                        key={guide.slug}
                        href={guide.href}
                        className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                      >
                        <p className="text-sm font-semibold text-stone-900">
                          {guide.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          {guide.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

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
                {isGerman
                  ? "Verlauf nach Login verfügbar"
                  : "History available after login"}
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
          ) : historyStatus === "loading" ? (
            <div className="mt-6 rounded-[24px] border border-black/10 bg-stone-50 px-6 py-8 text-sm text-stone-500">
              {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
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
                            {entry.species ||
                              (isGerman ? "Unbekannt" : "Unknown")}
                          </p>
                          <p className="mt-1 text-sm text-stone-500">
                            {new Date(entry.analyzedAt).toLocaleString(
                              isGerman ? "de-DE" : "en-US",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
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
                                  {isGerman
                                    ? "Wahrscheinlichkeit"
                                    : "Likelihood"}{" "}
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
                          onClick={() => void openHistoryReport(entry)}
                          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#184a39] bg-[#1f5a45] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,90,69,0.24)] transition hover:bg-[#184a39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          style={{
                            backgroundColor: "#1f5a45",
                            color: "#ffffff",
                            WebkitTextFillColor: "#ffffff",
                          }}
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

        {showAuthPrompt ? (
          <div className="fixed inset-0 z-[1100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
            <button
              type="button"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={() => setShowAuthPrompt(false)}
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
                  onClick={() => setShowAuthPrompt(false)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24312b]"
                >
                  {isGerman ? "Anmelden" : "Sign in"}
                </Link>
                <Link
                  href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                  onClick={() => setShowAuthPrompt(false)}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50"
                >
                  {isGerman ? "Registrieren" : "Register"}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthPrompt(false)}
                className="mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600"
              >
                {isGerman ? "Abbrechen" : "Cancel"}
              </button>
            </div>
          </div>
        ) : null}

        {selectedHistoryEntry ? (
          <div className="fixed inset-0 z-[1100] overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-[6px] px-4 pb-4 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:pb-6">
            <button
              type="button"
              className="absolute inset-0 z-0"
              onClick={() => {
                setSelectedHistoryEntry(null);
                setSelectedHistoryDetail(null);
                setSelectedHistoryDetailStatus("idle");
              }}
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
                      {new Date(selectedHistoryEntry.analyzedAt).toLocaleString(
                        isGerman ? "de-DE" : "en-US",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStatusClasses(
                      selectedHistoryEntry.healthStatus,
                    )}`}
                  >
                    {healthStatusLabel(
                      selectedHistoryEntry.healthStatus,
                      locale,
                    )}
                  </span>
                </div>

                <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isGerman ? "Sicherheit" : "Confidence"}
                    </p>
                    <p className="mt-1 text-xl font-bold text-[#f5e8bc]">
                      {confidenceLabel(selectedHistoryEntry.confidence)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isGerman ? "Befunde" : "Findings"}
                    </p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {selectedHistoryEntry.issues.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isGerman ? "Empfehlungen" : "Recommendations"}
                    </p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {selectedHistoryEntry.recommendations.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {selectedHistoryDetail?.imageUri ? (
                  <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                        {isGerman ? "Analysiertes Foto" : "Analyzed photo"}
                      </h4>
                      <span className="text-xs text-stone-400">
                        {isGerman
                          ? "Gespeichert im Bericht"
                          : "Saved in report"}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-center p-2">
                      <div className="h-[260px] w-[260px] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-100 sm:h-[320px] sm:w-[320px]">
                        <UploadedPlantImage
                          src={selectedHistoryDetail.imageUri}
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

                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {isGerman ? "Problemschätzungen" : "Issue estimates"}
                </h4>
                <div className="mt-3 grid gap-3">
                  {selectedHistoryEntry.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`rounded-[24px] border px-4 py-4 shadow-sm ${severityCardClasses(issue.severity)}`}
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

              <div className="mt-6 rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {isGerman ? "Empfehlungen" : "Recommendations"}
                </h4>
                <ul className="mt-3 grid gap-3">
                  {selectedHistoryEntry.recommendations.map((entry, index) => (
                    <li
                      key={entry}
                      className="flex gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-sm leading-6 text-stone-700">
                        {entry}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-[26px] border border-stone-200 bg-white p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {isGerman ? "Produktempfehlungen" : "Product recommendations"}
                </h4>
                {selectedHistoryDetailStatus === "loading" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                ) : selectedHistoryDetailStatus === "error" ? (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {isGerman
                      ? "Produktempfehlungen konnten nicht geladen werden."
                      : "Product recommendations could not be loaded."}
                  </div>
                ) : selectedHistoryDetail?.productSuggestions.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selectedHistoryDetail.productSuggestions.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.handle}`}
                        className="group rounded-[22px] border border-stone-200 bg-stone-50 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40"
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
                ) : (
                  <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    {isGerman
                      ? "Keine Produktempfehlungen verfügbar."
                      : "No product recommendations available."}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {isGerman ? "Bericht gespeichert" : "Report saved"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                    {isGerman
                      ? "Du kannst diesen Bericht jederzeit wieder über deinen Analyseverlauf öffnen."
                      : "You can reopen this report at any time from your analysis history."}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm sm:min-w-[148px]">
                  <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 sm:text-left">
                    {isGerman ? "Status" : "Status"}
                  </p>
                  <p className="mt-1 text-center text-sm font-semibold text-stone-900 sm:text-left">
                    {healthStatusLabel(
                      selectedHistoryEntry.healthStatus,
                      locale,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHistoryEntry(null);
                    setSelectedHistoryDetail(null);
                    setSelectedHistoryDetailStatus("idle");
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 sm:w-auto"
                >
                  {isGerman ? "Schließen" : "Close"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
