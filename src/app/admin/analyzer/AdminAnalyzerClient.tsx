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
  confidenceBand?: "low" | "medium" | "high";
  needsHumanReview?: boolean;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  reviewNotes: string | null;
  safetyFlags: string[];
  imageUri: string | null;
  createdAt: string;
  priority: number;
  publicationStatus?: string | null;
  publicationEligible?: boolean;
  feedbackCount?: number;
  incorrectFeedbackCount?: number;
  lastFeedback?: {
    id: string;
    createdAt: string;
    isCorrect: boolean;
    label: string | null;
    comment: string | null;
    source: string;
  } | null;
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: string;
  }>;
};

type AnalyzerRunSummary = {
  total: number;
  unresolved: number;
  disputed: number;
  lowConfidence: number;
  critical: number;
  submitted: number;
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
  const [summary, setSummary] = useState<AnalyzerRunSummary>({
    total: 0,
    unresolved: 0,
    disputed: 0,
    lowConfidence: 0,
    critical: 0,
    submitted: 0,
  });
  const [sourceLabel, setSourceLabel] = useState("growvault");
  const [query, setQuery] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [sortMode, setSortMode] = useState("attention");
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
      const data = (await response.json()) as {
        runs?: AnalyzerRunRecord[];
        summary?: AnalyzerRunSummary;
        source?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load analyzer runs.");
      }
      const nextRuns = data.runs ?? [];
      setRuns(nextRuns);
      setSummary(
        data.summary ?? {
          total: nextRuns.length,
          unresolved: nextRuns.filter((run) => run.reviewStatus !== "REVIEWED_OK").length,
          disputed: nextRuns.filter((run) => (run.incorrectFeedbackCount ?? 0) > 0).length,
          lowConfidence: nextRuns.filter((run) => run.confidence < 0.65).length,
          critical: nextRuns.filter((run) => run.healthStatus === "CRITICAL").length,
          submitted: nextRuns.filter((run) => run.publicationStatus === "SUBMITTED").length,
        },
      );
      setSourceLabel(data.source ?? "growvault");
      setSelectedId((current) =>
        current && nextRuns.some((run) => run.id === current)
          ? current
          : nextRuns[0]?.id ?? null,
      );
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
        run.publicationStatus ?? "",
        run.lastFeedback?.label ?? "",
        run.lastFeedback?.comment ?? "",
        ...run.issues.map((issue) => issue.label),
      ].some((entry) => entry.toLowerCase().includes(normalizedQuery));
    });
  }, [query, runs]);

  const sortedRuns = useMemo(() => {
    const nextRuns = [...filteredRuns];
    nextRuns.sort((left, right) => {
      if (sortMode === "newest") {
        return right.createdAt.localeCompare(left.createdAt);
      }
      if (sortMode === "oldest") {
        return left.createdAt.localeCompare(right.createdAt);
      }
      if (sortMode === "lowest-confidence") {
        return left.confidence - right.confidence || right.priority - left.priority;
      }
      if (sortMode === "feedback") {
        return (
          (right.incorrectFeedbackCount ?? 0) - (left.incorrectFeedbackCount ?? 0) ||
          (right.feedbackCount ?? 0) - (left.feedbackCount ?? 0) ||
          right.createdAt.localeCompare(left.createdAt)
        );
      }

      const attentionLeft =
        (left.incorrectFeedbackCount ?? 0) * 100 +
        ((left.publicationStatus === "SUBMITTED" ? 1 : 0) * 30) +
        ((left.needsHumanReview ? 1 : 0) * 25) +
        left.priority;
      const attentionRight =
        (right.incorrectFeedbackCount ?? 0) * 100 +
        ((right.publicationStatus === "SUBMITTED" ? 1 : 0) * 30) +
        ((right.needsHumanReview ? 1 : 0) * 25) +
        right.priority;
      return attentionRight - attentionLeft || right.createdAt.localeCompare(left.createdAt);
    });
    return nextRuns;
  }, [filteredRuns, sortMode]);

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
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Loaded
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Unresolved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.unresolved}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Disputed
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.disputed}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Submitted
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.submitted}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Source
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                {sourceLabel}
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
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case, email, issue, feedback"
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
            <AdminSelect value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="attention">Sort: attention</option>
              <option value="feedback">Sort: user feedback</option>
              <option value="newest">Sort: newest</option>
              <option value="oldest">Sort: oldest</option>
              <option value="lowest-confidence">Sort: lowest confidence</option>
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
              sortedRuns.map((run) => (
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
                    {run.needsHumanReview ? (
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                        Human review
                      </span>
                    ) : null}
                    {run.publicationStatus === "SUBMITTED" ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        Fall eingereicht
                      </span>
                    ) : null}
                    {(run.incorrectFeedbackCount ?? 0) > 0 ? (
                      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">
                        {(run.incorrectFeedbackCount ?? 0)} dispute
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {(run.issues[0]?.label ?? run.species) || "Analyzer case"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {run.userEmail ?? "Unknown user"} · {Math.round(run.confidence * 100)}% ·{" "}
                    {new Date(run.createdAt).toLocaleString("de-DE")}
                  </p>
                  {run.lastFeedback ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Latest user feedback
                      </p>
                      <p className="mt-1 text-xs text-slate-200">
                        {(run.lastFeedback.label ?? run.lastFeedback.source).replaceAll("_", " ")}
                      </p>
                      {run.lastFeedback.comment ? (
                        <p className="mt-1 text-xs text-slate-400">{run.lastFeedback.comment}</p>
                      ) : null}
                    </div>
                  ) : null}
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
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      User feedback
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {selectedRun.feedbackCount ?? 0} total · {selectedRun.incorrectFeedbackCount ?? 0} disputed
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Library
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {selectedRun.publicationStatus ?? "Not submitted"}
                    </p>
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

              {selectedRun.lastFeedback ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Latest user feedback
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {(selectedRun.lastFeedback.label ?? selectedRun.lastFeedback.source).replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(selectedRun.lastFeedback.createdAt).toLocaleString("de-DE")} ·{" "}
                    {selectedRun.lastFeedback.isCorrect ? "helpful" : "disputed"}
                  </p>
                  {selectedRun.lastFeedback.comment ? (
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {selectedRun.lastFeedback.comment}
                    </p>
                  ) : null}
                </div>
              ) : null}

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
