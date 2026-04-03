"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminButton,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import type {
  PricingChangeItem,
  PricingOverviewSnapshot,
  PricingRecommendationAction,
  PricingRecommendationItem,
  PricingRunMode,
} from "@/lib/adminPricingIntegration";

type Props = {
  initialSnapshot: PricingOverviewSnapshot | null;
  initialError: string | null;
};

const formatCurrency = (amountCents: number | null) =>
  amountCents === null
    ? "n/a"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(amountCents / 100);

const formatPriceInput = (amountCents: number | null) =>
  amountCents === null
    ? ""
    : new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amountCents / 100);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "n/a";

const formatConfidence = (value: number | null) =>
  value === null
    ? "n/a"
    : new Intl.NumberFormat("de-DE", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

const formatReliability = (value: number | null) =>
  value === null
    ? "n/a"
    : new Intl.NumberFormat("de-DE", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

const formatBasisPoints = (value: number | null) => {
  if (value === null) return "n/a";
  const percent = value / 100;
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(percent));
  return `${percent >= 0 ? "+" : "-"}${formatted}%`;
};

const formatReasonCode = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parsePriceInputToCents = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN;
  }
  return Math.round(Number(normalized) * 100);
};

function CompetitorSnapshotDetails({
  competitorSnapshot,
}: {
  competitorSnapshot: PricingRecommendationItem["competitorSnapshot"];
}) {
  if (!competitorSnapshot) {
    return <div>Competitor price n/a</div>;
  }

  return (
    <>
      <div>
        Competitor price{" "}
        {formatCurrency(
          competitorSnapshot.averagePriceCents ?? competitorSnapshot.minPriceCents
        )}
      </div>
      {competitorSnapshot.minPriceCents !== null &&
      competitorSnapshot.averagePriceCents !== null &&
      competitorSnapshot.minPriceCents !== competitorSnapshot.averagePriceCents ? (
        <div>
          Competitor range {formatCurrency(competitorSnapshot.minPriceCents)} to{" "}
          {formatCurrency(competitorSnapshot.averagePriceCents)}
        </div>
      ) : null}
      <div>
        Competitor source {competitorSnapshot.sourceLabel?.trim() || "n/a"}
      </div>
      <div>Observed {formatDateTime(competitorSnapshot.observedAt)}</div>
      <div>Reliability {formatReliability(competitorSnapshot.reliabilityScore)}</div>
    </>
  );
}

const getStatusBadgeClassName = (status: string) => {
  if (status === "APPLIED") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "BLOCKED") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }
  if (status === "PENDING_REVIEW") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  if (status === "REJECTED") {
    return "border-slate-400/20 bg-slate-400/10 text-slate-200";
  }
  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
};

const getModeBadgeClassName = (mode: PricingRunMode) =>
  mode === "APPLY"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";

function RecommendationBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {label}
    </span>
  );
}

function PriceStack({
  currentPriceCents,
  hardMinimumPriceCents,
  recommendedTargetPriceCents,
  publishablePriceCents,
}: {
  currentPriceCents: number;
  hardMinimumPriceCents: number | null;
  recommendedTargetPriceCents: number | null;
  publishablePriceCents: number | null;
}) {
  return (
    <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Current", formatCurrency(currentPriceCents)],
        ["Floor", formatCurrency(hardMinimumPriceCents)],
        ["Target", formatCurrency(recommendedTargetPriceCents)],
        ["Publishable", formatCurrency(publishablePriceCents)],
      ].map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ReasonCodeList({ reasonCodes }: { reasonCodes: string[] }) {
  if (reasonCodes.length === 0) {
    return <span className="text-xs text-slate-500">No reason codes returned.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reasonCodes.map((reasonCode) => (
        <span
          key={reasonCode}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300"
        >
          {formatReasonCode(reasonCode)}
        </span>
      ))}
    </div>
  );
}

function AppliedPriceChangeRow({ item }: { item: PricingChangeItem }) {
  return (
    <div className="grid grid-cols-[1.4fr_0.85fr_0.85fr_1fr_0.9fr] gap-3 px-4 py-4 text-sm text-slate-300">
      <div>
        <div className="font-semibold text-white">{item.product.title}</div>
        <div className="mt-1 text-xs text-slate-400">
          {item.variant.title}
          {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
        </div>
        <div className="mt-2">
          <ReasonCodeList reasonCodes={item.reasonCodes} />
        </div>
      </div>
      <div>{formatCurrency(item.oldPriceCents)}</div>
      <div>
        <div className="font-semibold text-emerald-200">
          {formatCurrency(item.newPriceCents)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Floor {formatCurrency(item.hardMinimumPriceCents)}
        </div>
      </div>
      <div className="text-xs text-slate-400">
        <div>{item.source ?? "Unknown source"}</div>
        <div className="mt-1">{item.actor?.email ?? "System actor"}</div>
      </div>
      <div className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</div>
    </div>
  );
}

export default function AdminPricingClient({
  initialSnapshot,
  initialError,
}: Props) {
  const [snapshot, setSnapshot] = useState<PricingOverviewSnapshot | null>(initialSnapshot);
  const [error, setError] = useState(initialError ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningMode, setRunningMode] = useState<PricingRunMode | null>(null);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<PricingRecommendationItem | null>(null);
  const [customApprovalPrice, setCustomApprovalPrice] = useState("");
  const [runLimit, setRunLimit] = useState("");
  const [runNotes, setRunNotes] = useState("");

  const latestRun = snapshot?.latestRun ?? null;
  const reviewQueue = snapshot?.reviewQueue ?? [];
  const recentRecommendations = snapshot?.recentRecommendations ?? [];
  const recentChanges = snapshot?.recentChanges ?? [];

  const blockedCount = recentRecommendations.filter(
    (item) => item.status === "BLOCKED"
  ).length;

  useEffect(() => {
    if (!selectedRecommendation) {
      setCustomApprovalPrice("");
      return;
    }
    setCustomApprovalPrice(formatPriceInput(selectedRecommendation.publishablePriceCents));
  }, [selectedRecommendation]);

  const refreshSnapshot = async (successMessage?: string) => {
    setLoading(true);
    setError("");
    if (successMessage) setMessage(successMessage);

    try {
      const response = await fetch("/api/admin/pricing", {
        cache: "no-store",
      });
      const data = (await response.json()) as PricingOverviewSnapshot & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to load pricing overview.");
        return;
      }
      setSnapshot(data);
    } catch {
      setError("Unable to load pricing overview.");
    } finally {
      setLoading(false);
    }
  };

  const runPricing = async (mode: PricingRunMode) => {
    setRunningMode(mode);
    setError("");
    setMessage("");

    const parsedLimit =
      runLimit.trim().length > 0 && Number.isFinite(Number(runLimit))
        ? Math.max(1, Math.floor(Number(runLimit)))
        : undefined;

    try {
      const response = await fetch("/api/admin/pricing/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          limit: parsedLimit,
          notes: runNotes.trim() || null,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        summary?: {
          processed: number;
          applied: number;
          review: number;
          blocked: number;
        };
      };

      if (!response.ok) {
        setError(data.error ?? `Unable to start ${mode.toLowerCase()} run.`);
        return;
      }

      const summary = data.summary;
      const summaryLine = summary
        ? `${summary.processed} processed, ${summary.applied} applied, ${summary.review} queued, ${summary.blocked} blocked.`
        : "Run completed.";

      await refreshSnapshot(
        `${mode === "PREVIEW" ? "Preview" : "Apply"} run finished. ${summaryLine}`
      );
    } catch {
      setError(`Unable to start ${mode.toLowerCase()} run.`);
    } finally {
      setRunningMode(null);
    }
  };

  const reviewRecommendation = async (
    recommendationId: string,
    action: PricingRecommendationAction,
    options?: { customPriceCents?: number | null }
  ) => {
    setPendingReviewId(recommendationId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/pricing/recommendations/${recommendationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          customPriceCents:
            typeof options?.customPriceCents === "number"
              ? options.customPriceCents
              : null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to process pricing recommendation.");
        return;
      }

      await refreshSnapshot(
        action === "approve"
          ? typeof options?.customPriceCents === "number"
            ? "Custom price approved and refreshed."
            : "Recommendation approved and refreshed."
          : "Recommendation rejected and refreshed."
      );
      if (selectedRecommendation?.id === recommendationId) {
        setSelectedRecommendation(null);
      }
    } catch {
      setError("Unable to process pricing recommendation.");
    } finally {
      setPendingReviewId(null);
    }
  };

  const approveSelectedRecommendation = async () => {
    if (!selectedRecommendation) return;

    const parsedCustomPriceCents = parsePriceInputToCents(customApprovalPrice);
    if (Number.isNaN(parsedCustomPriceCents)) {
      setError("Enter a valid approval price in EUR, for example 89,95.");
      return;
    }

    if (
      parsedCustomPriceCents !== null &&
      parsedCustomPriceCents <= 0
    ) {
      setError("Custom approval price must be greater than zero.");
      return;
    }

    await reviewRecommendation(selectedRecommendation.id, "approve", {
      customPriceCents: parsedCustomPriceCents,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Operations / Pricing"
        title="Pricing automation control"
        description="Smokeify runs explainable pricing recommendations locally. Review queues, preview runs, approvals, and audit activity stay visible here alongside the live pricing engine."
        actions={
          <>
            <AdminButton tone="secondary" onClick={() => refreshSnapshot()}>
              {loading ? "Refreshing..." : "Refresh overview"}
            </AdminButton>
            <Link
              href="/admin/catalog"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              Open catalog
            </Link>
          </>
        }
        metrics={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Review Queue"
              value={String(reviewQueue.length)}
              detail="Pending review"
            />
            <AdminMetricCard
              label="Blocked"
              value={String(blockedCount)}
              detail="Recent recommendations"
            />
            <AdminMetricCard
              label="Latest Run"
              value={latestRun ? latestRun.mode : "n/a"}
              detail={latestRun ? formatDateTime(latestRun.startedAt) : "No runs yet"}
            />
            <AdminMetricCard
              label="Applied Last Run"
              value={String(latestRun?.summary?.applied ?? 0)}
              detail={
                latestRun?.summary
                  ? `${latestRun.summary.processed} processed`
                  : "Awaiting first run"
              }
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {!snapshot && !error ? (
        <AdminNotice tone="info">
          Pricing automation is enabled, but no overview data is available yet.
        </AdminNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          eyebrow="Run Controls"
          title="Preview or apply the local engine"
          description="Use preview mode to populate recommendations without changing prices. Apply mode executes Smokeify’s pricing automation flow and writes eligible price changes."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Optional variant limit" optional="leave empty for full run">
                <AdminInput
                  inputMode="numeric"
                  value={runLimit}
                  onChange={(event) => setRunLimit(event.target.value)}
                  placeholder="e.g. 25"
                />
              </AdminField>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Latest run
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {latestRun ? (
                    <>
                      <RecommendationBadge
                        label={latestRun.mode}
                        className={getModeBadgeClassName(latestRun.mode)}
                      />
                      <RecommendationBadge
                        label={latestRun.status}
                        className={getStatusBadgeClassName(latestRun.status)}
                      />
                    </>
                  ) : (
                    <span className="text-slate-500">No pricing runs yet.</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Started {formatDateTime(latestRun?.startedAt)}
                  {latestRun?.finishedAt
                    ? ` · Finished ${formatDateTime(latestRun.finishedAt)}`
                    : ""}
                </div>
              </div>
            </div>

            <AdminField
              label="Operator notes"
              optional="stored with the pricing run"
            >
              <AdminTextarea
                rows={3}
                value={runNotes}
                onChange={(event) => setRunNotes(event.target.value)}
                placeholder="Explain why you are triggering this run."
              />
            </AdminField>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4">
                <div className="text-sm font-semibold text-cyan-100">Preview run</div>
                <div className="mt-2 text-sm text-cyan-50/80">
                  Recompute recommendations, blocked items, and review queue without publishing prices.
                </div>
                <div className="mt-4">
                  <AdminButton
                    onClick={() => runPricing("PREVIEW")}
                    disabled={runningMode !== null}
                  >
                    {runningMode === "PREVIEW" ? "Running preview..." : "Run preview"}
                  </AdminButton>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                <div className="text-sm font-semibold text-emerald-100">Apply run</div>
                <div className="mt-2 text-sm text-emerald-50/80">
                  Publish eligible prices and write audit entries for every applied change.
                </div>
                <div className="mt-4">
                  <AdminButton
                    tone="secondary"
                    className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                    onClick={() => runPricing("APPLY")}
                    disabled={runningMode !== null}
                  >
                    {runningMode === "APPLY" ? "Applying..." : "Run apply"}
                  </AdminButton>
                </div>
              </div>
            </div>

            {latestRun?.summary ? (
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Processed", latestRun.summary.processed, "text-white"],
                  ["Applied", latestRun.summary.applied, "text-emerald-200"],
                  ["Review", latestRun.summary.review, "text-amber-200"],
                  ["Blocked", latestRun.summary.blocked, "text-red-200"],
                ].map(([label, value, valueClassName]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </div>
                    <div className={`mt-2 text-lg font-semibold ${valueClassName}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Recent Recommendations"
          title="Activity and explanation feed"
          description="Blocked rows, review-required recommendations, previews, approvals, and published outcomes all stay visible with their reason codes."
        >
          {recentRecommendations.length === 0 ? (
            <AdminEmptyState
              title="No recommendation history yet."
              description="Run a preview to populate recommendation history."
            />
          ) : (
            <div className="space-y-3">
              {recentRecommendations.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRecommendation(item)}
                  className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                    item.status === "BLOCKED"
                      ? "border-red-400/20 bg-red-400/10 hover:bg-red-400/15"
                      : item.status === "PENDING_REVIEW"
                        ? "border-amber-400/20 bg-amber-400/10 hover:bg-amber-400/15"
                        : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <RecommendationBadge
                          label={item.status}
                          className={getStatusBadgeClassName(item.status)}
                        />
                        <RecommendationBadge
                          label={item.run.mode}
                          className={getModeBadgeClassName(item.run.mode)}
                        />
                        {item.reviewRequired ? (
                          <RecommendationBadge
                            label="Review required"
                            className="border-amber-400/20 bg-amber-400/10 text-amber-200"
                          />
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white">
                        {item.product.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.variant.title}
                        {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>Confidence {formatConfidence(item.confidenceScore)}</div>
                      <div className="mt-1">{formatDateTime(item.createdAt)}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Current to publishable
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {formatCurrency(item.currentPriceCents)}
                        {" -> "}
                        {formatCurrency(item.publishablePriceCents)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Delta
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {formatBasisPoints(item.priceDeltaBasisPoints)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 line-clamp-2 text-sm text-slate-300">
                    {item.explanation ?? "No explanation returned."}
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="Review Queue"
        title="Pending pricing approvals"
        description="Review-required recommendations stay separate from blocked outcomes. Open a row to inspect the explanation, floor, target, publishable price, and reason codes before approving."
      >
        {reviewQueue.length === 0 ? (
          <AdminEmptyState
            title="No queued recommendations."
            description="The latest preview did not produce review-required items."
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#06090d]">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.85fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <div>Variant</div>
              <div>Current</div>
              <div>Target</div>
              <div>Confidence</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-white/5">
              {reviewQueue.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.85fr] gap-3 px-4 py-4 text-sm text-slate-300"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRecommendation(item)}
                        className="text-left font-semibold text-white transition hover:text-cyan-200"
                      >
                        {item.product.title}
                      </button>
                      <RecommendationBadge
                        label={item.status}
                        className={getStatusBadgeClassName(item.status)}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.variant.title}
                      {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-slate-400">
                      {item.explanation ?? "No explanation returned."}
                    </div>
                  </div>
                  <div>{formatCurrency(item.currentPriceCents)}</div>
                  <div>{formatCurrency(item.publishablePriceCents)}</div>
                  <div>{formatConfidence(item.confidenceScore)}</div>
                  <div className="flex items-start justify-end gap-2">
                      <AdminButton
                        tone="secondary"
                        onClick={() => setSelectedRecommendation(item)}
                      >
                        Inspect
                    </AdminButton>
                    <AdminButton
                      onClick={() => reviewRecommendation(item.id, "approve")}
                      disabled={pendingReviewId === item.id}
                    >
                      {pendingReviewId === item.id ? "Saving..." : "Approve"}
                    </AdminButton>
                    <AdminButton
                      tone="danger"
                      onClick={() => reviewRecommendation(item.id, "reject")}
                      disabled={pendingReviewId === item.id}
                    >
                      Reject
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        eyebrow="Applied Changes"
        title="Recent published price changes"
        description="Every pricing write is visible with old price, new price, floor, reason codes, and actor/source metadata so operators can audit the automation trail."
      >
        {recentChanges.length === 0 ? (
          <AdminEmptyState
            title="No applied changes yet."
            description="Apply runs populate this audit table once the pricing engine writes price changes."
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#06090d]">
            <div className="grid grid-cols-[1.4fr_0.85fr_0.85fr_1fr_0.9fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <div>Variant</div>
              <div>Old price</div>
              <div>New price</div>
              <div>Source / actor</div>
              <div>Changed</div>
            </div>
            <div className="divide-y divide-white/5">
              {recentChanges.map((item) => (
                <AppliedPriceChangeRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </AdminPanel>

      <AdminDrawer
        open={selectedRecommendation !== null}
        onClose={() => setSelectedRecommendation(null)}
        title={selectedRecommendation?.product.title ?? "Recommendation detail"}
        description={
          selectedRecommendation
            ? `${selectedRecommendation.variant.title}${
                selectedRecommendation.variant.sku
                  ? ` · SKU ${selectedRecommendation.variant.sku}`
                  : ""
              }`
            : undefined
        }
        widthClassName="w-full max-w-3xl"
      >
        {selectedRecommendation ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RecommendationBadge
                label={selectedRecommendation.status}
                className={getStatusBadgeClassName(selectedRecommendation.status)}
              />
              <RecommendationBadge
                label={selectedRecommendation.run.mode}
                className={getModeBadgeClassName(selectedRecommendation.run.mode)}
              />
              {selectedRecommendation.reviewRequired ? (
                <RecommendationBadge
                  label="Review required"
                  className="border-amber-400/20 bg-amber-400/10 text-amber-200"
                />
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Run metadata
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Run started {formatDateTime(selectedRecommendation.run.startedAt)}</div>
                  <div>Created {formatDateTime(selectedRecommendation.createdAt)}</div>
                  {"reviewedAt" in selectedRecommendation ? (
                    <div>Reviewed {formatDateTime(selectedRecommendation.reviewedAt)}</div>
                  ) : null}
                  {"appliedAt" in selectedRecommendation ? (
                    <div>Applied {formatDateTime(selectedRecommendation.appliedAt)}</div>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recommendation signal
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Confidence {formatConfidence(selectedRecommendation.confidenceScore)}</div>
                  <div>Delta {formatBasisPoints(selectedRecommendation.priceDeltaBasisPoints)}</div>
                  <CompetitorSnapshotDetails
                    competitorSnapshot={selectedRecommendation.competitorSnapshot}
                  />
                  <div>
                    Product link{" "}
                    <Link
                      href={`/admin/catalog/${selectedRecommendation.product.id}`}
                      className="font-semibold text-cyan-200 underline decoration-transparent transition hover:decoration-current"
                    >
                      open product
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <PriceStack
              currentPriceCents={selectedRecommendation.currentPriceCents}
              hardMinimumPriceCents={selectedRecommendation.hardMinimumPriceCents}
              recommendedTargetPriceCents={
                selectedRecommendation.recommendedTargetPriceCents
              }
              publishablePriceCents={selectedRecommendation.publishablePriceCents}
            />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Explanation
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
                {selectedRecommendation.explanation ?? "No explanation returned."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Reason codes
              </div>
              <div className="mt-3">
                <ReasonCodeList reasonCodes={selectedRecommendation.reasonCodes} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Approval override
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
                <AdminField
                  label="Custom approval price (EUR)"
                  optional="leave as-is to approve the current publishable price"
                >
                  <AdminInput
                    inputMode="decimal"
                    value={customApprovalPrice}
                    onChange={(event) => setCustomApprovalPrice(event.target.value)}
                    placeholder="e.g. 89,95"
                  />
                </AdminField>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                  Recommendation {formatCurrency(selectedRecommendation.publishablePriceCents)}
                  <div className="mt-1 text-xs text-slate-500">
                    Hard floor {formatCurrency(selectedRecommendation.hardMinimumPriceCents)}
                  </div>
                </div>
              </div>
            </div>

            {selectedRecommendation.status === "PENDING_REVIEW" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <AdminButton
                  tone="danger"
                  onClick={() => reviewRecommendation(selectedRecommendation.id, "reject")}
                  disabled={pendingReviewId === selectedRecommendation.id}
                >
                  Reject
                </AdminButton>
                <AdminButton
                  onClick={approveSelectedRecommendation}
                  disabled={pendingReviewId === selectedRecommendation.id}
                >
                  {pendingReviewId === selectedRecommendation.id
                    ? "Saving..."
                    : "Approve recommendation"}
                </AdminButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}
