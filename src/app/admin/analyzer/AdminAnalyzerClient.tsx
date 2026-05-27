"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type AnalyzerRunRecord = {
  id: string;
  userId?: string | null;
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
  assignedReviewerId?: string | null;
  assignedReviewerEmail?: string | null;
  assignedAt?: string | null;
  reviewDueAt?: string | null;
  overdue?: boolean;
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
  unassigned?: number;
  dueToday?: number;
  overdue?: number;
  publicationEligible?: number;
};

type GrowvaultBridgeStatus = {
  ok: boolean;
  targetUrl: string | null;
  status: number | null;
  error: string | null;
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

type AnalyzerView = "shared" | "smokeify";

const formatAnalyzerTimestamp = (value: string) =>
  new Date(value).toLocaleString("de-DE");

const getAnalyzerCustomerKey = (
  run: Pick<AnalyzerRunRecord, "id" | "userId" | "userEmail">,
) => run.userId ?? run.userEmail?.trim().toLowerCase() ?? run.id;

const getAnalyzerNextAction = (run: AnalyzerRunRecord) => {
  if ((run.incorrectFeedbackCount ?? 0) > 0) return "Resolve disputed result";
  if (run.publicationStatus === "SUBMITTED") return "Review before publication";
  if (run.reviewStatus === "PRIVACY_REVIEW") return "Check privacy and image handling";
  if (run.reviewStatus === "REVIEWED_UNSAFE") return "Correct unsafe guidance";
  if (run.reviewStatus === "NEEDS_PROMPT_FIX") return "Adjust analyzer prompt";
  if (run.reviewStatus === "NEEDS_RECOMMENDATION_FIX") return "Fix recommendation output";
  if (run.needsHumanReview) return "Manual review needed";
  if (run.reviewStatus === "UNREVIEWED") return "Complete first review";
  return "Review queue item";
};

const getAnalyzerReasonSummary = (run: AnalyzerRunRecord) => {
  const reasons: string[] = [];

  if ((run.incorrectFeedbackCount ?? 0) > 0) reasons.push("disputed by the user");
  if (run.publicationStatus === "SUBMITTED") reasons.push("awaiting publication review");
  if (run.needsHumanReview) reasons.push("marked for manual review");
  if (run.confidence < 0.65) reasons.push("low confidence");
  if (run.healthStatus === "CRITICAL") reasons.push("health-critical");

  return reasons.length > 0 ? reasons.join(", ") : "queued for reviewer confirmation";
};

export default function AdminAnalyzerClient() {
  const searchParams = useSearchParams();
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
  const [growvaultBridge, setGrowvaultBridge] = useState<GrowvaultBridgeStatus>({
    ok: true,
    targetUrl: null,
    status: null,
    error: null,
  });
  const [query, setQuery] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [queueFilter, setQueueFilter] = useState("");
  const [sortMode, setSortMode] = useState("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [overrideRecommendations, setOverrideRecommendations] = useState("");
  const activeView: AnalyzerView =
    searchParams?.get("view")?.trim().toLowerCase() === "smokeify"
      ? "smokeify"
      : "shared";
  const requestedStorefront = activeView === "smokeify" ? "MAIN" : "ALL";

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? null,
    [runs, selectedId],
  );

  const viewTabs = useMemo(
    () =>
      [
        {
          id: "shared" as const,
          label: "Shared queue",
          description: "Unified Smokeify and Growvault analyzer review stream",
        },
        {
          id: "smokeify" as const,
          label: "Smokeify",
          description: "Smokeify-local analyzer runs, notes, and overrides",
        },
      ].map((tab) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.delete("storefront");
        if (tab.id === "shared") {
          params.delete("view");
        } else {
          params.set("view", tab.id);
        }
        const queryString = params.toString();
        return {
          ...tab,
          href: queryString ? `/admin/analyzer?${queryString}` : "/admin/analyzer",
          active: activeView === tab.id,
        };
      }),
    [activeView, searchParams],
  );

  const pageCopy = useMemo(() => {
    if (activeView === "smokeify") {
      return {
        title: "Smokeify analyzer workspace",
        description:
          "Smokeify-local analyzer runs that need review, correction, or storefront-specific guidance updates.",
        queueDescription:
          "Smokeify-local runs only. Use this tab when the review outcome depends on Smokeify-specific notes or overrides.",
        detailDescription:
          "Review the local Smokeify record and save queue, audit, and guidance changes without the shared Growvault queue mixed in.",
      };
    }

    return {
      title: "Analyzer governance",
      description:
        "Unified analyzer queue across Smokeify and Growvault, with one shared review flow and a separate Smokeify-local workspace only when needed.",
      queueDescription:
        "Shared queue first. Review newest analyzer cases across both storefronts without switching scope.",
      detailDescription:
        "Evidence comes first. The action fields below are separated so it is clear which input affects queue status, audit notes, or customer-facing guidance.",
    };
  }, [activeView]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "250");
      params.set("storefront", requestedStorefront);
      if (includeResolved) params.set("includeResolved", "true");
      if (reviewStatus) params.set("reviewStatus", reviewStatus);
      if (queueFilter === "assigned") params.set("assignedOnly", "true");
      if (queueFilter === "overdue") params.set("overdueOnly", "true");
      if (queueFilter === "publication") params.set("publicationEligibleOnly", "true");
      if (queueFilter === "disputed") params.set("disputedOnly", "true");
      if (queueFilter === "low-confidence") params.set("lowConfidenceOnly", "true");
      const response = await fetch(`/api/admin/analyzer/runs?${params.toString()}`);
      const data = (await response.json()) as {
        runs?: AnalyzerRunRecord[];
        summary?: AnalyzerRunSummary;
        source?: string;
        growvaultBridge?: GrowvaultBridgeStatus;
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
          unassigned: nextRuns.filter((run) => !run.assignedReviewerId).length,
          dueToday: nextRuns.filter((run) => {
            if (!run.reviewDueAt || run.reviewStatus === "REVIEWED_OK") return false;
            return new Date(run.reviewDueAt).toDateString() === new Date().toDateString();
          }).length,
          overdue: nextRuns.filter((run) => run.overdue).length,
          publicationEligible: nextRuns.filter((run) => run.publicationEligible).length,
        },
      );
      setSourceLabel(data.source ?? "growvault");
      setGrowvaultBridge(
        data.growvaultBridge ?? {
          ok: true,
          targetUrl: null,
          status: null,
          error: null,
        },
      );
      setSelectedId((current) =>
        current && nextRuns.some((run) => run.id === current)
          ? current
          : nextRuns[0]?.id ?? null,
      );
      setSelectedIds((current) => current.filter((id) => nextRuns.some((run) => run.id === id)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load analyzer runs.");
    } finally {
      setLoading(false);
    }
  }, [includeResolved, queueFilter, requestedStorefront, reviewStatus]);

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
        run.userId ?? "",
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

  const selectedUserRuns = useMemo(() => {
    if (!selectedRun) return [];

    const customerKey = getAnalyzerCustomerKey(selectedRun);
    return [...runs]
      .filter((run) => getAnalyzerCustomerKey(run) === customerKey)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [runs, selectedRun]);

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

  const applyBulkAction = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError(null);
    setBulkNotice(null);
    try {
      const response = await fetch("/api/admin/analyzer/runs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          reviewStatus: bulkStatus || undefined,
          assignedReviewerId: bulkReviewerId || undefined,
          reviewDueAt: bulkDueDate ? new Date(bulkDueDate).toISOString() : undefined,
          reviewNotes: "Bulk analyzer governance update.",
        }),
      });
      const data = (await response.json()) as { updated?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Bulk update failed.");
      }
      setBulkNotice(`${data.updated ?? selectedIds.length} run(s) updated.`);
      setSelectedIds([]);
      await loadRuns();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Bulk update failed.");
    } finally {
      setSaving(false);
    }
  };

  const showGrowvaultBridgeWarning = activeView === "shared" && !growvaultBridge.ok;

  return (
    <div className="space-y-5">
      <AdminPageIntro
        eyebrow="Analyzer"
        title={pageCopy.title}
        description={pageCopy.description}
        actions={
          <div className="admin-scroll-x -mx-1 flex gap-2 px-1 text-xs font-semibold sm:mx-0 sm:flex-wrap sm:px-0">
            {viewTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`shrink-0 rounded-full border px-3 py-2 transition sm:shrink ${
                  tab.active
                    ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                    : "border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                <span className="block">{tab.label}</span>
                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-slate-400">
                  {tab.description}
                </span>
              </Link>
            ))}
          </div>
        }
        metrics={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Unassigned
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.unassigned ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Due today
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.dueToday ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200">
                Overdue
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.overdue ?? 0}
              </p>
            </div>
          </div>
        }
      />

      {showGrowvaultBridgeWarning ? (
        <AdminNotice tone="warning">
          Growvault runs are not currently loading into the shared queue.
          {growvaultBridge.error ? ` ${growvaultBridge.error}` : ""}
          {growvaultBridge.targetUrl ? ` Bridge target: ${growvaultBridge.targetUrl}.` : ""}
          {typeof growvaultBridge.status === "number"
            ? ` Bridge response: ${growvaultBridge.status}.`
            : ""}
        </AdminNotice>
      ) : null}

      <AdminPanel
        title="Workflow"
        description="Work from left to right so the queue, review trail, and storefront override stay distinct."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              1. Pick the case
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The queue explains why a run is here and what action is expected next.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              2. Check evidence
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review the image, detected issues, latest feedback, and recent activity from the same user before changing status.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              3. Save in the right field
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review status updates the queue. Review notes explain the decision. Recommendation override replaces storefront-facing guidance.
            </p>
          </div>
        </div>
      </AdminPanel>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <AdminPanel
          title="Queue"
          description={pageCopy.queueDescription}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <AdminSelect
              value={queueFilter}
              onChange={(event) => setQueueFilter(event.target.value)}
            >
              <option value="">Filter: all queue reasons</option>
              <option value="assigned">Assigned reviewer</option>
              <option value="overdue">Overdue review</option>
              <option value="publication">Publication eligible</option>
              <option value="disputed">Disputed cases</option>
              <option value="low-confidence">Low confidence</option>
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
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-slate-400">
            {sortedRuns.length} visible cases · sorted by{" "}
            {sortMode === "attention"
              ? "attention"
              : sortMode === "feedback"
                ? "user feedback"
                : sortMode === "lowest-confidence"
                  ? "lowest confidence"
                  : sortMode}
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Bulk actions · {selectedIds.length} selected
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === sortedRuns.length
                      ? []
                      : sortedRuns.map((run) => run.id),
                  )
                }
                className="text-xs font-semibold text-cyan-200 underline-offset-4 hover:underline"
              >
                {selectedIds.length === sortedRuns.length ? "Clear" : "Select visible"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <AdminSelect value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
                <option value="">Bulk status: unchanged</option>
                {REVIEW_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </AdminSelect>
              <AdminInput
                value={bulkReviewerId}
                onChange={(event) => setBulkReviewerId(event.target.value)}
                placeholder="Reviewer user ID"
              />
              <AdminInput
                type="date"
                value={bulkDueDate}
                onChange={(event) => setBulkDueDate(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AdminButton
                onClick={() => void applyBulkAction()}
                disabled={saving || selectedIds.length === 0}
              >
                Apply bulk update
              </AdminButton>
              {bulkNotice ? <span className="text-xs text-emerald-200">{bulkNotice}</span> : null}
            </div>
          </div>
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
                <div
                  key={run.id}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedId === run.id
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(run.id)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, run.id])]
                              : current.filter((id) => id !== run.id),
                          )
                        }
                      />
                      Select
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedId(run.id)}
                      className="text-xs font-semibold text-cyan-200 underline-offset-4 hover:underline"
                    >
                      Open case
                    </button>
                  </div>
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
                    {run.assignedReviewerEmail ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        {run.assignedReviewerEmail}
                      </span>
                    ) : null}
                    {run.overdue ? (
                      <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {(run.issues[0]?.label ?? run.species) || "Analyzer case"}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                    {getAnalyzerNextAction(run)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {run.userEmail ?? "Unknown user"} · {Math.round(run.confidence * 100)}% ·{" "}
                    {formatAnalyzerTimestamp(run.createdAt)}
                    {run.reviewDueAt ? ` · due ${formatAnalyzerTimestamp(run.reviewDueAt)}` : ""}
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
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Case detail"
          description={pageCopy.detailDescription}
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
                      Publication state
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {selectedRun.publicationStatus ?? "Not submitted"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Queue reason
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {getAnalyzerNextAction(selectedRun)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Priority P{selectedRun.priority}. Review this run because it is{" "}
                    {getAnalyzerReasonSummary(selectedRun)}.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recent user activity
                  </p>
                  {selectedUserRuns.length <= 1 ? (
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      No other loaded analyzer runs are linked to this user in the current queue snapshot.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedUserRuns.slice(0, 4).map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedId(run.id)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            run.id === selectedRun.id
                              ? "border-cyan-400/40 bg-cyan-400/10"
                              : "border-white/10 bg-black/20 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                              {run.reviewStatus}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatAnalyzerTimestamp(run.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white">
                            {(run.issues[0]?.label ?? run.species) || "Analyzer case"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
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
                    {formatAnalyzerTimestamp(selectedRun.lastFeedback.createdAt)} ·{" "}
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
                  <p className="mb-2 text-sm text-slate-400">
                    Use this only when the diagnosis needs different storefront guidance. Do not use it just to explain your review decision.
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
                <p className="mb-2 text-sm text-slate-400">
                  These notes stay with the audit trail. Put reviewer reasoning here, not customer-facing recommendation copy.
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
