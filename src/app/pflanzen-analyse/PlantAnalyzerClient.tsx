"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BeakerIcon,
  CameraIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import type {
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerIssue,
  PlantAnalyzerProductSuggestion,
} from "@/lib/plantAnalyzerTypes";
import { PLANT_ANALYZER_CASE_LIBRARY_PATH } from "@/lib/plantAnalyzerPaths";

type AnalyzerResult = {
  id: string;
  species: string;
  confidence: number;
  healthStatus: "healthy" | "warning" | "critical";
  summary: string;
  issues: PlantAnalyzerIssue[];
  immediateActions: string[];
  verificationChecks: Array<{ id: string; title: string; detail: string }>;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
  analyzedAt: string;
};

type AnalyzerApiResponse = {
  result?: AnalyzerResult;
  error?: string;
};

type AnalyzerHistoryItem = {
  id: string;
  createdAt: string;
  species: string;
  confidence: number;
  healthStatus: "healthy" | "warning" | "critical";
  summary: string;
  issues: PlantAnalyzerIssue[];
};

type HistoryResponse = {
  items?: AnalyzerHistoryItem[];
};

const healthLabel: Record<AnalyzerResult["healthStatus"], string> = {
  healthy: "stabil",
  warning: "prüfen",
  critical: "kritisch",
};

const healthClass: Record<AnalyzerResult["healthStatus"], string> = {
  healthy: "bg-emerald-500/12 text-emerald-100 border-emerald-400/20",
  warning: "bg-amber-500/12 text-amber-100 border-amber-400/20",
  critical: "bg-red-500/12 text-red-100 border-red-400/20",
};

export default function PlantAnalyzerClient() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState({
    medium: "unknown",
    growthStage: "unknown",
    ph: "",
    ec: "",
    temperatureC: "",
    humidityPercent: "",
    lightDistanceCm: "",
    wateringCadence: "",
    tentOrRoomSize: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [history, setHistory] = useState<AnalyzerHistoryItem[]>([]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [imageFile]);

  useEffect(() => {
    fetch("/api/plant-analyzer/history?limit=4")
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: HistoryResponse) => setHistory(data.items ?? []))
      .catch(() => setHistory([]));
  }, [result?.id]);

  const canSubmit = useMemo(
    () => Boolean(imageFile && status !== "loading"),
    [imageFile, status],
  );

  const submit = async () => {
    if (!imageFile) {
      setMessage("Bitte lade zuerst ein Pflanzenfoto hoch.");
      return;
    }

    const formData = new FormData();
    formData.set("image", imageFile);
    formData.set("notes", notes);
    Object.entries(context).forEach(([key, value]) => {
      if (value.trim()) formData.set(key, value.trim());
    });

    setStatus("loading");
    setMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/plant-analyzer", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as AnalyzerApiResponse;
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "Analyse fehlgeschlagen.");
      }
      setResult(data.result);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Pflanzenanalyse konnte nicht abgeschlossen werden.",
      );
    }
  };

  return (
    <div className="space-y-6 text-[var(--smk-text)]">
      <section className="relative overflow-hidden rounded-[42px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_14%_16%,rgba(241,198,132,0.2),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(91,117,82,0.16),transparent_28%),linear-gradient(135deg,rgba(23,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.38)] sm:px-10">
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="smk-kicker">Smokeify Pflanzenanalyse</p>
            <h1 className="smk-heading mt-4 text-5xl leading-[0.95] text-[var(--smk-text)] sm:text-6xl">
              Foto hochladen.
              <span className="smk-text-gradient block">Befund strukturiert prüfen.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
              Die Analyse bewertet sichtbare Pflanzenprobleme, trennt Sofortmaßnahmen
              von Prüfchecks und verbindet Hinweise mit passenden Smokeify Produkten
              und Guides. Sie ersetzt keine Labor- oder Fachdiagnose.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/customizer" className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Setup anpassen
              </Link>
              <Link href={PLANT_ANALYZER_CASE_LIBRARY_PATH} className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Fallbibliothek
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                title: "Foto zuerst",
                copy: "Nur echte Pflanzenfotos werden analysiert.",
                icon: CameraIcon,
              },
              {
                title: "Kontext hilft",
                copy: "pH, EC, Klima und Stadium verbessern die Einordnung.",
                icon: BeakerIcon,
              },
              {
                title: "Checks vor Aktion",
                copy: "Empfehlungen werden als Prüfpfad formuliert.",
                icon: ClipboardDocumentCheckIcon,
              },
            ].map((item) => (
              <div key={item.title} className="smk-surface rounded-[24px] p-4">
                <item.icon className="h-5 w-5 text-[var(--smk-accent)]" />
                <p className="mt-3 text-sm font-semibold text-[var(--smk-text)]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-6 text-[var(--smk-text-muted)]">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="smk-panel rounded-[32px] p-5 sm:p-6">
          <p className="smk-kicker">Analyse starten</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
            Foto und Messwerte
          </h2>

          <label className="mt-5 block cursor-pointer rounded-[28px] border border-dashed border-[var(--smk-border-strong)] bg-[rgba(255,255,255,0.035)] p-4 text-center transition hover:bg-[rgba(255,255,255,0.055)]">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null);
                setStatus("idle");
                setMessage(null);
              }}
            />
            {previewUrl ? (
              <span className="relative mx-auto block aspect-[4/3] overflow-hidden rounded-[22px] bg-black/20">
                <Image src={previewUrl} alt="Pflanzenfoto Vorschau" fill className="object-cover" unoptimized />
              </span>
            ) : (
              <span className="mx-auto flex min-h-48 flex-col items-center justify-center gap-3 text-[var(--smk-text-muted)]">
                <CameraIcon className="h-10 w-10" />
                <span className="text-sm font-semibold">JPG, PNG oder WebP hochladen</span>
              </span>
            )}
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Was fällt dir auf? Flecken, Blattspitzen, Gießrhythmus, letzte Änderung..."
            className="smk-input mt-4 w-full rounded-[22px] px-4 py-3 text-sm"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--smk-text-muted)]">
              Medium
              <select
                value={context.medium}
                onChange={(event) => setContext((prev) => ({ ...prev, medium: event.target.value }))}
                className="smk-input mt-1 h-11 w-full rounded-2xl px-3 text-sm"
              >
                <option value="unknown">Unbekannt</option>
                <option value="soil">Erde</option>
                <option value="coco">Coco</option>
                <option value="hydro">Hydro</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[var(--smk-text-muted)]">
              Phase
              <select
                value={context.growthStage}
                onChange={(event) => setContext((prev) => ({ ...prev, growthStage: event.target.value }))}
                className="smk-input mt-1 h-11 w-full rounded-2xl px-3 text-sm"
              >
                <option value="unknown">Unbekannt</option>
                <option value="seedling">Anzucht</option>
                <option value="veg">Wachstum</option>
                <option value="early_flower">Frühe Blüte</option>
                <option value="late_flower">Späte Blüte</option>
              </select>
            </label>
            {[
              ["ph", "pH"],
              ["ec", "EC"],
              ["temperatureC", "Temperatur °C"],
              ["humidityPercent", "Luftfeuchte %"],
              ["lightDistanceCm", "Lichtabstand cm"],
              ["tentOrRoomSize", "Zelt/Raumgröße"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs font-semibold text-[var(--smk-text-muted)]">
                {label}
                <input
                  value={context[key as keyof typeof context]}
                  onChange={(event) =>
                    setContext((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  className="smk-input mt-1 h-11 w-full rounded-2xl px-3 text-sm"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="smk-button-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-55"
          >
            {status === "loading" ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Analyse läuft...
              </>
            ) : (
              "Pflanze analysieren"
            )}
          </button>
          {message ? (
            <p className="mt-3 rounded-2xl border border-red-500/24 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {message}
            </p>
          ) : null}
        </div>

        <div className="space-y-5">
          {result ? (
            <div className="smk-panel rounded-[32px] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="smk-kicker">Analyseergebnis</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--smk-text)]">
                    {result.species}
                  </h2>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${healthClass[result.healthStatus]}`}>
                  {healthLabel[result.healthStatus]} · {Math.round(result.confidence * 100)}%
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--smk-text-muted)]">
                {result.summary}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-sm font-semibold text-[var(--smk-text)]">Befunde</p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--smk-text-muted)]">
                    {result.issues.map((issue) => (
                      <li key={issue.id}>• {issue.label} ({Math.round(issue.confidence * 100)}%)</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-sm font-semibold text-[var(--smk-text)]">Sofort prüfen</p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--smk-text-muted)]">
                    {result.immediateActions.map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {result.verificationChecks.length > 0 ? (
                <div className="mt-4 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-sm font-semibold text-[var(--smk-text)]">Verification Checks</p>
                  <div className="mt-3 grid gap-2">
                    {result.verificationChecks.map((check) => (
                      <div key={check.id} className="rounded-2xl bg-black/12 px-3 py-2">
                        <p className="text-sm font-semibold text-[var(--smk-text)]">{check.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--smk-text-muted)]">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="smk-panel rounded-[32px] p-8 text-center">
              <p className="smk-kicker">Bereit</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--smk-text)]">
                Dein Ergebnis erscheint hier.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--smk-text-muted)]">
                Lade ein klares Foto hoch und ergänze Messwerte, wenn du sie hast.
              </p>
            </div>
          )}

          {result?.productSuggestions?.length ? (
            <div className="smk-panel rounded-[32px] p-5 sm:p-6">
              <p className="smk-kicker">Passende Smokeify Produkte</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.productSuggestions.slice(0, 4).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.handle}`}
                    className="group rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-3 transition hover:border-[var(--smk-border-strong)]"
                  >
                    <p className="text-sm font-semibold text-[var(--smk-text)] group-hover:text-[var(--smk-accent)]">
                      {product.title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--smk-text-muted)]">
                      {product.reason}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="smk-panel rounded-[32px] p-5 sm:p-6">
            <p className="smk-kicker">Letzte Analysen</p>
            <div className="mt-4 space-y-2">
              {history.length > 0 ? (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--smk-text)]">
                      {item.species}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--smk-text-muted)]">
                      {item.summary}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--smk-text-muted)]">
                  Melde dich an, um Analyseverläufe in deinem Account zu speichern.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
