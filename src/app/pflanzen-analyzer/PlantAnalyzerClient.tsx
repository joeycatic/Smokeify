"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowUpTrayIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  SparklesIcon,
  ClockIcon,
  UserCircleIcon,
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
  cta: {
    title: string;
    description: string;
  };
};

type AnalysisHistoryEntry = {
  id: string;
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

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function healthStatusLabel(value: AnalyzerResponse["diagnosis"]["healthStatus"]) {
  if (value === "healthy") return "Eher unkritisch";
  if (value === "critical") return "Erhöhter Handlungsbedarf";
  return "Bitte prüfen";
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
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function severityLabel(value: "healthy" | "warning" | "critical") {
  if (value === "critical") return "kritisch";
  if (value === "healthy") return "unkritisch";
  return "prüfen";
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

function SeverityIcon({ severity }: { severity: "healthy" | "warning" | "critical" }) {
  if (severity === "critical") {
    return <FireIcon className="h-5 w-5" />;
  }
  if (severity === "healthy") {
    return <CheckBadgeIcon className="h-5 w-5" />;
  }
  return <ShieldExclamationIcon className="h-5 w-5" />;
}

export default function PlantAnalyzerClient() {
  const inputId = useId();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
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
  const effectiveSessionStatus = hasHydrated ? sessionStatus : "loading";
  const isAuthenticated = effectiveSessionStatus === "authenticated";
  const userRole = hasHydrated ? session?.user?.role ?? "USER" : "USER";
  const isPrivilegedUser = userRole === "ADMIN" || userRole === "STAFF";
  const freeAnalysisUsed = !isPrivilegedUser && history.length >= 1;

  useEffect(() => {
    setHasHydrated(true);
  }, []);

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
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild hochladen.");
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
      setError("Das Bild konnte nicht gelesen werden.");
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!imageUri) {
      setError("Bitte zuerst ein Foto hochladen.");
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
        "Dein kostenloses Analysebild wurde bereits verwendet. Weitere Analysen sind hier nicht verfügbar.",
      );
      return;
    }

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
        setError(data.error ?? "Analyse fehlgeschlagen.");
        return;
      }
      setResult(data);
      setStatus("success");
      void loadHistory();
    } catch {
      setStatus("error");
      setError("Analyse fehlgeschlagen.");
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
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
      <section className="rounded-[28px] border border-emerald-100 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Foto hochladen
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Schnelle Pflanzenanalyse für die Website
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Lade ein Blatt- oder Pflanzenfoto hoch. Du bekommst eine einfache
              Diagnose, 1–2 Problemschätzungen und passende Shop-Vorschläge.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <SparklesIcon className="h-6 w-6" />
          </div>
        </div>

        <label
          htmlFor={inputId}
          className="mt-6 flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-emerald-200 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_45%),linear-gradient(180deg,#f8fffc_0%,#f1f5f9_100%)] px-4 py-6 text-center transition hover:border-emerald-300 hover:bg-emerald-50/80 sm:min-h-[280px] sm:px-6 sm:py-8"
        >
          {imagePreview ? (
            <div className="w-full">
              <div className="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-[20px] border border-black/10 bg-white">
                <Image
                  src={imagePreview}
                  alt="Vorschau des hochgeladenen Pflanzenfotos"
                  fill
                  sizes="(min-width: 1024px) 35vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-4 text-sm font-semibold text-stone-700">
                Foto ausgewählt. Du kannst es direkt analysieren.
              </p>
              {imageName ? (
                <p className="mt-1 text-xs text-stone-500">{imageName}</p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-emerald-700 shadow-sm">
                <PhotoIcon className="h-8 w-8" />
              </div>
              <p className="mt-4 text-base font-semibold text-stone-900">
                Foto deiner Pflanze hochladen
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                Gute Ergebnisse bekommst du mit einem scharfen Foto bei hellem
                Licht und sichtbaren Blattdetails.
              </p>
            </>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />

        {imagePreview ? (
          <div className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Bildvorschau
              </p>
              <button
                type="button"
                onClick={clearSelectedImage}
                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Bild entfernen
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-32 w-full overflow-hidden rounded-[20px] border border-black/10 bg-white sm:w-40">
                <Image
                  src={imagePreview}
                  alt="Bildvorschau des hochgeladenen Pflanzenfotos"
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900">
                  {imageName || "Ausgewähltes Foto"}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Dieses Bild wird für die Analyse verwendet. Du kannst jederzeit
                  ein anderes Foto auswählen.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Zusätzliche Info
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional: z. B. Erde oder Hydro, neuer Dünger, heller werdende Blattspitzen ..."
            rows={4}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={analyzeImage}
            disabled={
              !imageUri ||
              status === "loading" ||
              effectiveSessionStatus === "loading" ||
              freeAnalysisUsed
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 sm:w-auto disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {status === "loading"
              ? "Analyse läuft ..."
              : freeAnalysisUsed
                ? "Freies Bild bereits genutzt"
              : isAuthenticated
                ? "Foto analysieren"
                : "Foto analysieren"}
          </button>
          <p className="text-xs text-stone-500">
            {freeAnalysisUsed
              ? "Normale Nutzer können auf der Website ein kostenloses Bild analysieren. Admins und Staff sind davon ausgenommen."
              : isAuthenticated
              ? "Web-Version mit schneller Ersteinschätzung. Für mehr Details gibt es die Smokeify App."
              : "Für die Analyse brauchst du ein Konto, damit deine Ergebnisse gespeichert werden."}
          </p>
        </div>

        {isAuthenticated ? (
          <div className="mt-4 rounded-[24px] border border-black/10 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-700">
            <p className="font-semibold">
              {isPrivilegedUser
                ? "Unbegrenzte Analysen aktiv"
                : freeAnalysisUsed
                  ? "Kostenloses Analysebild bereits verbraucht"
                  : "1 kostenloses Analysebild verfügbar"}
            </p>
            <p className="mt-1">
              {isPrivilegedUser
                ? "Dein Konto ist als Admin oder Staff freigeschaltet und kann beliebig viele Bilder analysieren."
                : freeAnalysisUsed
                  ? "Dein erstes kostenloses Bild wurde bereits analysiert. Der gespeicherte Bericht bleibt unten im Verlauf abrufbar."
                  : "Mit deinem Konto kannst du auf der Website ein Bild kostenlos analysieren."}
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">Wichtiger Hinweis</p>
          <p className="mt-1">
            Die Analyse ist nur eine KI-gestützte Ersteinschätzung und nicht zu
            100 % zuverlässig. Fehler und Fehleinschätzungen können vorkommen.
            Bitte verlass dich nicht ausschließlich auf dieses Ergebnis und
            prüfe wichtige Entscheidungen zusätzlich selbst.
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Ergebnis
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Einfache Diagnose und nächste Schritte
            </h2>
          </div>
          <div className="rounded-2xl bg-stone-100 p-3 text-stone-700">
            <BoltIcon className="h-6 w-6" />
          </div>
        </div>

        {status === "loading" ? (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,#16382d_0%,#23483b_45%,#d3be8f_100%)] px-4 py-6 text-white sm:px-6 sm:py-8">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5e8bc]">
                  Analyse läuft
                </p>
                <h3 className="mt-2 text-2xl font-bold">
                  Wir prüfen gerade dein Pflanzenfoto
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
                  Das Bild wird ausgewertet, Probleme werden geschätzt und
                  passende Produkte sowie Guides werden zusammengestellt.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-[#f5e8bc]">
                <BeakerIcon className="h-7 w-7 animate-pulse" />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-[#E4C56C] animate-pulse" />
                  <p className="text-sm font-semibold">Bilddetails werden gelesen</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full bg-emerald-300 animate-pulse"
                    style={{ animationDelay: "160ms" }}
                  />
                  <p className="text-sm font-semibold">
                    Wahrscheinliche Probleme werden erkannt
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full bg-cyan-300 animate-pulse"
                    style={{ animationDelay: "320ms" }}
                  />
                  <p className="text-sm font-semibold">
                    Empfehlungen und Shop-Produkte werden vorbereitet
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-1/3 rounded-full bg-[#E4C56C] animate-[pulse_1.2s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        ) : !result ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
            <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-stone-400" />
            <p className="mt-4 text-base font-semibold text-stone-800">
              Noch keine Analyse
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Nach dem Upload zeigen wir hier die Problemschätzung,
              Produktempfehlungen und passende Guides.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5 sm:space-y-6">
            <div
              className={`rounded-[24px] border px-5 py-4 ${healthStatusClasses(
                result.diagnosis.healthStatus,
              )}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Analyse
                  </p>
                  <h3 className="mt-2 text-xl font-bold">
                    {healthStatusLabel(result.diagnosis.healthStatus)}
                  </h3>
                  <p className="mt-2 text-sm">
                    Erkannt: {result.diagnosis.species || "Unbekannt"} ·
                    Sicherheit {confidenceLabel(result.diagnosis.confidence)}
                  </p>
                </div>
                <div className="self-start rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">
                  1–2 Problemschätzungen
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {result.diagnosis.issues.length > 0 ? (
                result.diagnosis.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-stone-900">
                          {issue.label}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          Wahrscheinlichkeit {confidenceLabel(issue.confidence)}
                        </p>
                      </div>
                      <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                        {issue.severity === "critical"
                          ? "kritisch"
                          : issue.severity === "healthy"
                            ? "unkritisch"
                            : "prüfen"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                  Kein klarer Befund erkannt.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white px-5 py-5">
              <h3 className="text-lg font-semibold text-stone-900">
                Konkrete nächste Schritte
              </h3>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
                {result.diagnosis.recommendations.map((entry) => (
                  <li
                    key={entry}
                    className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white px-5 py-5">
              <h3 className="text-lg font-semibold text-stone-900">
                Passende Produkte aus dem Shop
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.productSuggestions.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.handle}`}
                    className="group rounded-[22px] border border-stone-200 bg-stone-50 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40"
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
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-stone-900">
                          {product.title}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-stone-500">
                          {product.reason}
                        </p>
                        {product.price ? (
                          <p className="mt-2 text-sm font-semibold text-emerald-800">
                            {formatPrice(
                              product.price.amount,
                              product.price.currencyCode,
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white px-5 py-5">
              <h3 className="text-lg font-semibold text-stone-900">
                Weiterführende Guides
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

            <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#16382d_0%,#23483b_45%,#d3be8f_100%)] px-5 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5e8bc]">
                App-Upgrade
              </p>
              <h3 className="mt-2 text-xl font-bold">{result.cta.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                {result.cta.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={
                    process.env.NEXT_PUBLIC_SMOKEIFY_APP_URL?.trim() ||
                    "/auth/signin"
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-[#E4C56C] px-5 py-3 text-sm font-semibold text-[#20342b] transition hover:bg-[#edd48f]"
                >
                  Mehr Analyse in der Smokeify App
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Zum Shop
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="lg:col-span-2 rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Analyseverlauf
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              Deine letzten Pflanzenanalysen
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Frühere Analysen bleiben in deinem Konto sichtbar, damit du
              Symptome und Empfehlungen später vergleichen kannst.
            </p>
          </div>
          <div className="rounded-2xl bg-stone-100 p-3 text-stone-700">
            <ClockIcon className="h-6 w-6" />
          </div>
        </div>

        {!hasHydrated || effectiveSessionStatus === "loading" ? (
          <div className="mt-6 rounded-[24px] border border-black/10 bg-stone-50 px-6 py-8 text-sm text-stone-500">
            Verlauf wird geladen ...
          </div>
        ) : !isAuthenticated ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
            <UserCircleIcon className="mx-auto h-8 w-8 text-stone-400" />
            <p className="mt-4 text-base font-semibold text-stone-800">
              Verlauf nach Login verfügbar
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Melde dich an oder registriere dich, damit neue Analysen in deinem
              Verlauf gespeichert werden.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                className="inline-flex items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#24312b]"
              >
                Anmelden
              </Link>
              <Link
                href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50"
              >
                Registrieren
              </Link>
            </div>
          </div>
        ) : historyStatus === "loading" ? (
          <div className="mt-6 rounded-[24px] border border-black/10 bg-stone-50 px-6 py-8 text-sm text-stone-500">
            Verlauf wird geladen ...
          </div>
        ) : history.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
            <ClockIcon className="mx-auto h-8 w-8 text-stone-400" />
            <p className="mt-4 text-base font-semibold text-stone-800">
              Noch keine gespeicherten Analysen
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Sobald du ein Bild analysierst, erscheint es hier in deinem
              Verlauf.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[24px] border border-black/10 bg-stone-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {entry.species || "Unbekannt"}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {new Date(entry.analyzedAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStatusClasses(
                      entry.healthStatus,
                    )}`}
                  >
                    {healthStatusLabel(entry.healthStatus)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {entry.issues.slice(0, 2).map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-2xl border border-white bg-white px-3 py-3"
                    >
                      <p className="text-sm font-semibold text-stone-900">
                        {issue.label}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Wahrscheinlichkeit {confidenceLabel(issue.confidence)}
                      </p>
                    </div>
                  ))}
                </div>
                {entry.recommendations[0] ? (
                  <p className="mt-4 text-sm leading-6 text-stone-600">
                    {entry.recommendations[0]}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openHistoryReport(entry)}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto"
                >
                  Vollständigen Bericht öffnen
                </button>
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
            aria-label="Schließen"
          />
          <div
            className="relative w-full max-w-sm rounded-3xl border border-black/10 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.30)] sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Analyse mit Verlauf
            </div>
            <h3 className="text-xl font-semibold text-stone-900">
              Bitte anmelden oder registrieren
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Damit deine Pflanzenanalysen gespeichert werden und im Verlauf
              sichtbar bleiben, brauchst du ein Smokeify Konto.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Link
                href={`/auth/signin?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                onClick={() => setShowAuthPrompt(false)}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24312b]"
              >
                Anmelden
              </Link>
              <Link
                href={`/auth/register?returnTo=${encodeURIComponent(pathname || "/pflanzen-analyzer")}`}
                onClick={() => setShowAuthPrompt(false)}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50"
              >
                Registrieren
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setShowAuthPrompt(false)}
              className="mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {selectedHistoryEntry ? (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => {
              setSelectedHistoryEntry(null);
              setSelectedHistoryDetail(null);
              setSelectedHistoryDetailStatus("idle");
            }}
            aria-label="Schließen"
          />
          <div
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-black/10 bg-white p-4 shadow-[0_22px_50px_rgba(15,23,42,0.20)] sm:max-h-[90vh] sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="overflow-hidden rounded-[28px] border border-[#244136] bg-[#16382d] p-4 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:p-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-[28px] bg-[radial-gradient(circle_at_10%_18%,rgba(228,197,108,0.18),transparent_25%),radial-gradient(circle_at_84%_10%,rgba(120,164,143,0.20),transparent_28%)]" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#f5e8bc] backdrop-blur">
                    Gespeicherter Bericht
                  </div>
                  <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {selectedHistoryEntry.species || "Unbekannt"}
                  </h3>
                  <p className="mt-2 text-sm text-white/78">
                    {new Date(selectedHistoryEntry.analyzedAt).toLocaleString(
                      "de-DE",
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
                  {healthStatusLabel(selectedHistoryEntry.healthStatus)}
                </span>
              </div>

              <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Sicherheit
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#f5e8bc]">
                    {confidenceLabel(selectedHistoryEntry.confidence)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Befunde
                  </p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {selectedHistoryEntry.issues.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Empfehlungen
                  </p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {selectedHistoryEntry.recommendations.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Problemschätzungen
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
                            Wahrscheinlichkeit {confidenceLabel(issue.confidence)}
                          </p>
                        </div>
                      </div>
                      <span className="self-start rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700">
                        {severityLabel(issue.severity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] p-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Empfehlungen
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
                Produktempfehlungen
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
                  Produktempfehlungen konnten nicht geladen werden.
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
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-stone-900">
                            {product.title}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-stone-500">
                            {product.reason}
                          </p>
                          {product.price ? (
                            <p className="mt-2 text-sm font-semibold text-emerald-800">
                              {formatPrice(
                                product.price.amount,
                                product.price.currencyCode,
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  Keine Produktempfehlungen verfügbar.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Bericht gespeichert
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                  Du kannst diesen Bericht jederzeit wieder über deinen
                  Analyseverlauf öffnen.
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm sm:min-w-[148px]">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 sm:text-left">
                  Status
                </p>
                <p className="mt-1 text-center text-sm font-semibold text-stone-900 sm:text-left">
                  {healthStatusLabel(selectedHistoryEntry.healthStatus)}
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
                Schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
