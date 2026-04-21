"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AdminButton,
  AdminInput,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type AnalyzerRunRecord = {
  id: string;
  userEmail: string | null;
  provider: string;
  model: string;
  confidence: number;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  reviewNotes: string | null;
  safetyFlags: string[];
  imageUri: string | null;
  createdAt: string;
  priority: number;
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: string;
  }>;
};

const REVIEW_STATUS_OPTIONS = [
  "UNREVIEWED",
  "REVIEWED_OK",
  "REVIEWED_INCORRECT",
  "REVIEWED_UNSAFE",
  "NEEDS_PROMPT_FIX",
  "NEEDS_RECOMMENDATION_FIX",
  "PRIVACY_REVIEW",
] as const;

export default function AdminAnalyzerClient() {
  const [runs, setRuns] = useState<AnalyzerRunRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [overrideRecommendations, setOverrideRecommendations] = useState("");

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? null,
    [runs, selectedId],
  );

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "40");
      if (includeResolved) params.set("includeResolved", "true");
      if (reviewStatus) params.set("reviewStatus", reviewStatus);
      const response = await fetch(`/api/admin/analyzer/runs?${params.toString()}`);
      const data = (await response.json()) as { runs?: AnalyzerRunRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load analyzer runs.");
      }
      const nextRuns = data.runs ?? [];
      setRuns(nextRuns);
      setSelectedId((current) => current ?? nextRuns[0]?.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load analyzer runs.");
    } finally {
      setLoading(false);
    }
  }, [includeResolved, reviewStatus]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    setReviewNotes(selectedRun?.reviewNotes ?? "");
    setOverrideRecommendations("");
  }, [selectedRun]);

  const filteredRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return runs;
    return runs.filter((run) => {
      return [
        run.id,
        run.userEmail ?? "",
        run.species,
        run.reviewStatus,
        ...run.issues.map((issue) => issue.label),
      ].some((entry) => entry.toLowerCase().includes(normalizedQuery));
    });
  }, [query, runs]);

  const unresolvedCount = runs.filter((run) => run.reviewStatus !== "REVIEWED_OK").length;

  const saveReview = async () => {
    if (!selectedRun) return;
    setSaving(true);
    setError(null);
    try {
      const recommendations = overrideRecommendations
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const response = await fetch(`/api/admin/analyzer/runs/${selectedRun.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: selectedRun.reviewStatus,
          reviewNotes,
          overrideDiagnosis:
            recommendations.length > 0 ? { recommendations } : null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save analyzer review.");
      }
      await loadRuns();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save analyzer review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageIntro
        eyebrow="Analyzer"
        title="Growvault analyzer governance"
        description="Review plant-analysis cases, capture remediation notes, and publish reviewed recommendation updates back into the shared storefront record."
        metrics={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Loaded
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{runs.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Unresolved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{unresolvedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Reviewed
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {runs.length - unresolvedCount}
              </p>
            </div>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <AdminPanel
          title="Queue"
          description="Highest-priority analyzer cases waiting for review."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case, email, issue"
            />
            <AdminSelect
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {REVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </AdminSelect>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(event) => setIncludeResolved(event.target.checked)}
            />
            Include resolved
          </label>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-sm text-slate-400">
                Loading analyzer runs...
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-sm text-slate-400">
                No analyzer runs match the current filters.
              </div>
            ) : (
              filteredRuns.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedId(run.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedId === run.id
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {run.reviewStatus}
                    </span>
                    <span className="text-xs text-slate-500">P{run.priority}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {(run.issues[0]?.label ?? run.species) || "Analyzer case"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {run.userEmail ?? "Unknown user"} · {Math.round(run.confidence * 100)}% ·{" "}
                    {new Date(run.createdAt).toLocaleString("de-DE")}
                  </p>
                </button>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Case detail"
          description="Update the shared reviewed case record used by Growvault history and follow-up views."
          actions={
            <AdminButton onClick={() => void loadRuns()} tone="secondary">
              Refresh
            </AdminButton>
          }
        >
          {!selectedRun ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-sm text-slate-400">
              Select an analyzer case to review it.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {selectedRun.imageUri ? (
                    <div className="relative aspect-square">
                      <Image
                        src={selectedRun.imageUri}
                        alt={selectedRun.species || "Analyzer image"}
                        fill
                        unoptimized
                        sizes="220px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-sm text-slate-500">
                      No image
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      User
                    </p>
                    <p className="mt-2 text-sm text-white">{selectedRun.userEmail ?? "Unknown"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Confidence
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {Math.round(selectedRun.confidence * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Species
                    </p>
                    <p className="mt-2 text-sm text-white">{selectedRun.species || "Unknown"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Model
                    </p>
                    <p className="mt-2 text-sm text-white">{selectedRun.model}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Detected issues
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRun.issues.map((issue) => (
                    <span
                      key={issue.id}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200"
                    >
                      {issue.label} · {Math.round(issue.confidence * 100)}%
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Review status
                  </p>
                  <AdminSelect
                    value={selectedRun.reviewStatus}
                    onChange={(event) =>
                      setRuns((current) =>
                        current.map((run) =>
                          run.id === selectedRun.id
                            ? { ...run, reviewStatus: event.target.value }
                            : run,
                        ),
                      )
                    }
                  >
                    {REVIEW_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Suggested recommendation override
                  </p>
                  <AdminTextarea
                    rows={6}
                    value={overrideRecommendations}
                    onChange={(event) => setOverrideRecommendations(event.target.value)}
                    placeholder="One recommendation per line"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Review notes
                </p>
                <AdminTextarea
                  rows={6}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Why the case was reviewed, corrected, or escalated"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <AdminButton onClick={saveReview} disabled={saving}>
                  {saving ? "Saving..." : "Save review"}
                </AdminButton>
              </div>
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
