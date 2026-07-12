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
import { AdminPage, AdminSplitView } from "@/components/admin/ui";
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

const formatCompareAtSource = (value: string | null | undefined) => {
  if (!value) return "None";
  if (value === "public") return "Public list price";
  if (value === "market_high") return "Market high";
  if (value === "market_average") return "Market average";
  return formatReasonCode(value);
};

const formatPercentFromBasisPoints = (value: number | null) =>
  value === null
    ? "n/a"
    : new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100) + "%";

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
      {competitorSnapshot.highPriceCents !== null ? (
        <div>Market high {formatCurrency(competitorSnapshot.highPriceCents)}</div>
      ) : null}
      <div>
        Competitor source {competitorSnapshot.sourceLabel?.trim() || "n/a"}
      </div>
      <div>Observed {formatDateTime(competitorSnapshot.observedAt)}</div>
      <div>Reliability {formatReliability(competitorSnapshot.reliabilityScore)}</div>
    </>
  );
}

function CompareAtSnapshotDetails({
  compareAtSnapshot,
}: {
  compareAtSnapshot: PricingRecommendationItem["compareAtSnapshot"];
}) {
  if (!compareAtSnapshot) {
    return <div className="text-sm text-[var(--adm-text-muted)]">No compare-at data captured.</div>;
  }

  return (
    <div className="grid gap-2 text-sm text-[var(--adm-text-muted)] sm:grid-cols-2">
      <div>Current compare-at {formatCurrency(compareAtSnapshot.currentCompareAtCents)}</div>
      <div>Public list price {formatCurrency(compareAtSnapshot.publicCompareAtCents)}</div>
      <div>Market high {formatCurrency(compareAtSnapshot.marketHighPriceCents)}</div>
      <div>
        Recommended compare-at{" "}
        {formatCurrency(compareAtSnapshot.recommendedCompareAtCents)}
      </div>
      <div>
        Publishable compare-at{" "}
        {formatCurrency(compareAtSnapshot.publishableCompareAtCents)}
      </div>
      <div>Source {formatCompareAtSource(compareAtSnapshot.source)}</div>
    </div>
  );
}

function CostSnapshotDetails({
  costSnapshot,
}: {
  costSnapshot: PricingRecommendationItem["costSnapshot"];
}) {
  if (!costSnapshot) {
    return <div className="text-sm text-[var(--adm-text-muted)]">No cost breakdown captured.</div>;
  }

  return (
    <div className="grid gap-2 text-sm text-[var(--adm-text-muted)] sm:grid-cols-2">
      <div>Base cost {formatCurrency(costSnapshot.baseCostCents)}</div>
      <div>Landed cost {formatCurrency(costSnapshot.baseLandedCostCents)}</div>
      <div>Supplier shipping {formatCurrency(costSnapshot.supplierShippingCostCents)}</div>
      <div>Inbound shipping {formatCurrency(costSnapshot.inboundShippingCostCents)}</div>
      <div>Packaging {formatCurrency(costSnapshot.packagingCostCents)}</div>
      <div>Handling {formatCurrency(costSnapshot.handlingCostCents)}</div>
      <div>Payment fee {formatPercentFromBasisPoints(costSnapshot.paymentFeePercentBasisPoints)}</div>
      <div>Fixed fee {formatCurrency(costSnapshot.paymentFixedFeeCents)}</div>
      <div>Return buffer {formatPercentFromBasisPoints(costSnapshot.returnRiskBufferBasisPoints)}</div>
      <div>Target margin {formatPercentFromBasisPoints(costSnapshot.targetMarginBasisPoints)}</div>
    </div>
  );
}

const getStatusBadgeClassName = (status: string) => {
  if (status === "APPLIED") {
    return "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]";
  }
  if (status === "BLOCKED") {
    return "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]";
  }
  if (status === "PENDING_REVIEW") {
    return "border-[#e2a136] bg-[#fff4dd] text-[#81560e]";
  }
  if (status === "REJECTED") {
    return "border-slate-400/20 bg-slate-400/10 text-[var(--adm-text)]";
  }
  return "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]";
};

const getModeBadgeClassName = (mode: PricingRunMode) =>
  mode === "APPLY"
    ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
    : "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]";

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
    <div className="grid gap-2 text-xs text-[var(--adm-text-muted)] sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Current", formatCurrency(currentPriceCents)],
        ["Floor", formatCurrency(hardMinimumPriceCents)],
        ["Target", formatCurrency(recommendedTargetPriceCents)],
        ["Publishable", formatCurrency(publishablePriceCents)],
      ].map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--adm-text)]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ReasonCodeList({ reasonCodes }: { reasonCodes: string[] }) {
  if (reasonCodes.length === 0) {
    return <span className="text-xs text-[var(--adm-text-faint)]">No reason codes returned.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reasonCodes.map((reasonCode) => (
        <span
          key={reasonCode}
          className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-muted)]"
        >
          {formatReasonCode(reasonCode)}
        </span>
      ))}
    </div>
  );
}

function AppliedPriceChangeRow({ item }: { item: PricingChangeItem }) {
  return (
    <div className="grid min-w-[760px] grid-cols-[1.4fr_0.85fr_0.85fr_1fr_0.9fr] gap-3 px-4 py-4 text-sm text-[var(--adm-text-muted)]">
      <div>
        <div className="font-semibold text-[var(--adm-text)]">{item.product.title}</div>
        <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
          {item.variant.title}
          {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
        </div>
        <div className="mt-2">
          <ReasonCodeList reasonCodes={item.reasonCodes} />
        </div>
      </div>
      <div>{formatCurrency(item.oldPriceCents)}</div>
      <div>
        <div className="font-semibold text-[var(--adm-success)]">
          {formatCurrency(item.newPriceCents)}
        </div>
        <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
          Compare-at {formatCurrency(item.oldCompareAtCents)} {" -> "}{" "}
          {formatCurrency(item.newCompareAtCents)}
        </div>
        <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
          Floor {formatCurrency(item.hardMinimumPriceCents)}
        </div>
      </div>
      <div className="text-xs text-[var(--adm-text-muted)]">
        <div>{item.source ?? "Unknown source"}</div>
        <div className="mt-1">{item.actor?.email ?? "System actor"}</div>
      </div>
      <div className="text-xs text-[var(--adm-text-muted)]">{formatDateTime(item.createdAt)}</div>
    </div>
  );
}

function AppliedPriceChangeCard({ item }: { item: PricingChangeItem }) {
  return (
    <div className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]">
      <div className="font-semibold text-[var(--adm-text)]">{item.product.title}</div>
      <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
        {item.variant.title}
        {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
      </div>
      <div className="mt-3">
        <ReasonCodeList reasonCodes={item.reasonCodes} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <PricingMobileValue label="Old price" value={formatCurrency(item.oldPriceCents)} />
        <PricingMobileValue label="New price" value={formatCurrency(item.newPriceCents)} tone="positive" />
        <PricingMobileValue
          label="Compare-at"
          value={`${formatCurrency(item.oldCompareAtCents)} -> ${formatCurrency(item.newCompareAtCents)}`}
        />
        <PricingMobileValue label="Floor" value={formatCurrency(item.hardMinimumPriceCents)} />
        <PricingMobileValue label="Source" value={item.source ?? "Unknown source"} />
        <PricingMobileValue label="Changed" value={formatDateTime(item.createdAt)} />
      </div>
      <div className="mt-3 text-xs text-[var(--adm-text-faint)]">{item.actor?.email ?? "System actor"}</div>
    </div>
  );
}

function PricingMobileValue({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${tone === "positive" ? "text-[var(--adm-success)]" : "text-[var(--adm-text)]"}`}>
        {value}
      </div>
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
  const [customApprovalError, setCustomApprovalError] = useState("");
  const [runLimit, setRunLimit] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [refreshPublicCompetitorData, setRefreshPublicCompetitorData] = useState(true);
  const [marketReportPath, setMarketReportPath] = useState("");

  const latestRun = snapshot?.latestRun ?? null;
  const reviewQueue = snapshot?.reviewQueue ?? [];
  const recentRecommendations = snapshot?.recentRecommendations ?? [];
  const recentChanges = snapshot?.recentChanges ?? [];
  const latestRunRecommendations = snapshot?.latestRunRecommendations ?? [];
  const latestRunChanges = snapshot?.latestRunChanges ?? [];

  const blockedCount = recentRecommendations.filter(
    (item) => item.status === "BLOCKED"
  ).length;
  const latestRunQueued = latestRunRecommendations.filter(
    (item) => item.status === "PENDING_REVIEW"
  );
  const latestRunBlocked = latestRunRecommendations.filter(
    (item) => item.status === "BLOCKED"
  );

  useEffect(() => {
    if (!selectedRecommendation) {
      setCustomApprovalPrice("");
      setCustomApprovalError("");
      return;
    }
    setCustomApprovalPrice(formatPriceInput(selectedRecommendation.publishablePriceCents));
    setCustomApprovalError("");
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
    if (mode === "APPLY" && !runNotes.trim()) {
      setError("Apply runs require notes that explain why this pricing change is being executed.");
      setRunningMode(null);
      return;
    }

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
          refreshPublicCompetitorData,
          marketReportPath: marketReportPath.trim() || null,
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
    setCustomApprovalError("");

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
        const nextError = data.error ?? "Unable to process pricing recommendation.";
        setError(nextError);
        setCustomApprovalError(nextError);
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
      const nextError = "Unable to process pricing recommendation.";
      setError(nextError);
      setCustomApprovalError(nextError);
    } finally {
      setPendingReviewId(null);
    }
  };

  const approveSelectedRecommendation = async () => {
    if (!selectedRecommendation) return;

    const parsedCustomPriceCents = parsePriceInputToCents(customApprovalPrice);
    if (Number.isNaN(parsedCustomPriceCents)) {
      setCustomApprovalError("Enter a valid approval price in EUR, for example 89,95.");
      return;
    }

    if (parsedCustomPriceCents !== null && parsedCustomPriceCents <= 0) {
      setCustomApprovalError("Custom approval price must be greater than zero.");
      return;
    }

    await reviewRecommendation(selectedRecommendation.id, "approve", {
      customPriceCents: parsedCustomPriceCents,
    });
  };

  return (
    <AdminPage layout="master-detail">
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
              className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
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

      <AdminSplitView>
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
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
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
                    <span className="text-[var(--adm-text-faint)]">No pricing runs yet.</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-[var(--adm-text-muted)]">
                  Started {formatDateTime(latestRun?.startedAt)}
                  {latestRun?.finishedAt
                    ? ` · Finished ${formatDateTime(latestRun.finishedAt)}`
                    : ""}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <label className="flex items-start gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]">
                <input
                  type="checkbox"
                  checked={refreshPublicCompetitorData}
                  onChange={(event) => setRefreshPublicCompetitorData(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--adm-border-strong)] bg-transparent text-[var(--adm-primary)] focus:ring-cyan-400/30"
                />
                <span>
                  <span className="block font-semibold text-[var(--adm-text)]">
                    Refresh Bloomtech public prices
                  </span>
                  <span className="mt-1 block text-xs text-[var(--adm-text-muted)]">
                    Uses the public guest-visible seller price only. No login or seller account
                    state is used during the refresh.
                  </span>
                </span>
              </label>

              <AdminField
                label="Market report path"
                optional="leave empty to skip market report import for this run"
              >
                <AdminInput
                  value={marketReportPath}
                  onChange={(event) => setMarketReportPath(event.target.value)}
                  placeholder="scripts/market/shops-price-report.json"
                />
              </AdminField>
            </div>

            <AdminField
              label="Operator notes"
              optional="required for apply runs"
            >
              <AdminTextarea
                rows={3}
                value={runNotes}
                onChange={(event) => setRunNotes(event.target.value)}
                placeholder="Explain why you are triggering this run."
              />
            </AdminField>
            <p className="text-xs text-[var(--adm-text-faint)]">
              Apply mode is blocked until you capture the execution reason here.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--adm-primary)]">Preview run</div>
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

              <div className="rounded-xl border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--adm-success)]">Apply run</div>
                <div className="mt-2 text-sm text-emerald-50/80">
                  Publish eligible prices and write audit entries for every applied change.
                </div>
                <div className="mt-4">
                  <AdminButton
                    tone="secondary"
                    className="border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)] hover:bg-emerald-400/15"
                    onClick={() => runPricing("APPLY")}
                    disabled={runningMode !== null}
                  >
                    {runningMode === "APPLY" ? "Applying..." : "Run apply"}
                  </AdminButton>
                </div>
              </div>
            </div>

            {latestRun?.summary ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Processed", latestRun.summary.processed, "text-[var(--adm-text)]"],
                  ["Applied", latestRun.summary.applied, "text-[var(--adm-success)]"],
                  ["Review", latestRun.summary.review, "text-[#81560e]"],
                  ["Blocked", latestRun.summary.blocked, "text-[var(--adm-error)]"],
                ].map(([label, value, valueClassName]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                      {label}
                    </div>
                    <div className={`mt-2 text-lg font-semibold ${valueClassName}`}>
                      {value}
                    </div>
                  </div>
                ))}
                </div>
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                    Run input refresh
                  </div>
                  <div className="mt-3 space-y-2">
                    <div>
                      Public refresh{" "}
                      {latestRun.summary.refreshPublicCompetitorData ? "enabled" : "disabled"}
                    </div>
                    <div>
                      Market report{" "}
                      {latestRun.summary.marketReportPath?.trim() || "not imported"}
                    </div>
                    {latestRun.summary.publicRefreshStats ? (
                      <div className="text-xs text-[var(--adm-text-muted)]">
                        Public refresh touched{" "}
                        {latestRun.summary.publicRefreshStats.productsRefreshed} products /{" "}
                        {latestRun.summary.publicRefreshStats.variantsUpdated} variants, skipped{" "}
                        {latestRun.summary.publicRefreshStats.skipped}.
                      </div>
                    ) : null}
                    {latestRun.summary.marketImportStats ? (
                      <div className="text-xs text-[var(--adm-text-muted)]">
                        Market import updated{" "}
                        {latestRun.summary.marketImportStats.variantsUpdated} variants, skipped{" "}
                        {latestRun.summary.marketImportStats.skipped}.
                      </div>
                    ) : null}
                  </div>
                </div>
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
                      ? "border-[var(--adm-error)] bg-[#fae7e3] hover:bg-[#fae7e3]"
                      : item.status === "PENDING_REVIEW"
                        ? "border-[#e2a136] bg-[#fff4dd] hover:bg-amber-400/15"
                        : "border-[var(--adm-border)] bg-[var(--adm-surface)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
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
                            className="border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
                          />
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-[var(--adm-text)]">
                        {item.product.title}
                      </div>
                      <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                        {item.variant.title}
                        {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--adm-text-muted)]">
                      <div>Confidence {formatConfidence(item.confidenceScore)}</div>
                      <div className="mt-1">{formatDateTime(item.createdAt)}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-xs text-[var(--adm-text-muted)] sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                        Current to publishable
                      </div>
                      <div className="mt-2 font-semibold text-[var(--adm-text)]">
                        {formatCurrency(item.currentPriceCents)}
                        {" -> "}
                        {formatCurrency(item.publishablePriceCents)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                        Delta
                      </div>
                      <div className="mt-2 font-semibold text-[var(--adm-text)]">
                        {formatBasisPoints(item.priceDeltaBasisPoints)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 line-clamp-2 text-sm text-[var(--adm-text-muted)]">
                    {item.explanation ?? "No explanation returned."}
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminPanel>
      </AdminSplitView>

      <AdminPanel
        eyebrow="Latest Run"
        title="Applied and queued outcomes"
        description="This run-level view shows exactly what the latest pricing pass changed, what still needs review, and what was blocked before you dig through the longer history feed."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--adm-text)]">Applied in latest run</div>
                <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                  Compare-at and live price writes from the most recent run.
                </div>
              </div>
              <RecommendationBadge
                label={`${latestRunChanges.length} changes`}
                className="border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
              />
            </div>
            {latestRunChanges.length === 0 ? (
              <AdminEmptyState
                title="No applied changes in the latest run."
                description="The last run either stayed in preview mode or queued everything for review."
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {latestRunChanges.slice(0, 8).map((item) => (
                    <AppliedPriceChangeCard key={item.id} item={item} />
                  ))}
                </div>
                <div className="admin-data-grid-scroll hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] md:block">
                  <div className="grid min-w-[760px] grid-cols-[1.4fr_0.85fr_0.85fr_1fr_0.9fr] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                    <div>Variant</div>
                    <div>Old price</div>
                    <div>New price</div>
                    <div>Source / actor</div>
                    <div>Changed</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {latestRunChanges.slice(0, 8).map((item) => (
                      <AppliedPriceChangeRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#81560e]/80">
                  Queued for review
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#81560e]">
                  {latestRunQueued.length}
                </div>
                <div className="mt-1 text-xs text-amber-50/75">
                  Higher-price moves above the 8% review threshold stay here.
                </div>
              </div>
              <div className="rounded-xl border border-[var(--adm-error)] bg-[#fae7e3] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-error)]/80">
                  Blocked
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--adm-error)]">
                  {latestRunBlocked.length}
                </div>
                <div className="mt-1 text-xs text-red-50/75">
                  Missing cost inputs or invalid pricing floors prevented apply.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[...latestRunQueued, ...latestRunBlocked].slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRecommendation(item)}
                  className="w-full rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-left transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <RecommendationBadge
                      label={item.status}
                      className={getStatusBadgeClassName(item.status)}
                    />
                    {item.compareAtSnapshot?.publishableCompareAtCents !== null &&
                    item.compareAtSnapshot?.publishableCompareAtCents !== undefined ? (
                      <RecommendationBadge
                        label={`Compare-at ${formatCurrency(
                          item.compareAtSnapshot?.publishableCompareAtCents ?? null
                        )}`}
                        className="border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)]"
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[var(--adm-text)]">
                    {item.product.title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                    {item.variant.title}
                    {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                  </div>
                  <div className="mt-3 text-xs text-[var(--adm-text-muted)]">
                    {formatCurrency(item.currentPriceCents)} {" -> "}{" "}
                    {formatCurrency(item.publishablePriceCents)} ·{" "}
                    {formatBasisPoints(item.priceDeltaBasisPoints)}
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs text-[var(--adm-text-faint)]">
                    {item.explanation ?? "No explanation returned."}
                  </div>
                </button>
              ))}
              {latestRunQueued.length === 0 && latestRunBlocked.length === 0 ? (
                <AdminEmptyState
                  title="No queued or blocked outcomes."
                  description="The latest run either applied cleanly or has not produced any results yet."
                />
              ) : null}
            </div>
          </div>
        </div>
      </AdminPanel>

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
          <>
            <div className="space-y-3 md:hidden">
              {reviewQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRecommendation(item)}
                      className="text-left font-semibold text-[var(--adm-text)] transition hover:text-[var(--adm-primary)]"
                    >
                      {item.product.title}
                    </button>
                    <RecommendationBadge
                      label={item.status}
                      className={getStatusBadgeClassName(item.status)}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                    {item.variant.title}
                    {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                  </div>
                  <div className="mt-2 line-clamp-3 text-xs text-[var(--adm-text-muted)]">
                    {item.explanation ?? "No explanation returned."}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <PricingMobileValue label="Current" value={formatCurrency(item.currentPriceCents)} />
                    <PricingMobileValue label="Target" value={formatCurrency(item.publishablePriceCents)} />
                    <PricingMobileValue label="Confidence" value={formatConfidence(item.confidenceScore)} />
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <AdminButton tone="secondary" onClick={() => setSelectedRecommendation(item)}>
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
            <div className="admin-data-grid-scroll hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] md:block">
              <div className="grid min-w-[840px] grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.85fr] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
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
                    className="grid min-w-[840px] grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.85fr] gap-3 px-4 py-4 text-sm text-[var(--adm-text-muted)]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRecommendation(item)}
                          className="text-left font-semibold text-[var(--adm-text)] transition hover:text-[var(--adm-primary)]"
                        >
                          {item.product.title}
                        </button>
                        <RecommendationBadge
                          label={item.status}
                          className={getStatusBadgeClassName(item.status)}
                        />
                      </div>
                      <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                        {item.variant.title}
                        {item.variant.sku ? ` · SKU ${item.variant.sku}` : ""}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs text-[var(--adm-text-muted)]">
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
          </>
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
          <>
            <div className="space-y-3 md:hidden">
              {recentChanges.map((item) => (
                <AppliedPriceChangeCard key={item.id} item={item} />
              ))}
            </div>
            <div className="admin-data-grid-scroll hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] md:block">
              <div className="grid min-w-[760px] grid-cols-[1.4fr_0.85fr_0.85fr_1fr_0.9fr] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
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
          </>
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
                  className="border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
                />
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                  Run metadata
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--adm-text-muted)]">
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
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                  Recommendation signal
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--adm-text-muted)]">
                  <div>Confidence {formatConfidence(selectedRecommendation.confidenceScore)}</div>
                  <div>Delta {formatBasisPoints(selectedRecommendation.priceDeltaBasisPoints)}</div>
                  <CompetitorSnapshotDetails
                    competitorSnapshot={selectedRecommendation.competitorSnapshot}
                  />
                  <div>
                    Product link{" "}
                    <Link
                      href={`/admin/catalog/${selectedRecommendation.product.id}`}
                      className="font-semibold text-[var(--adm-primary)] underline decoration-transparent transition hover:decoration-current"
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

            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                Explanation
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-[var(--adm-text)]">
                {selectedRecommendation.explanation ?? "No explanation returned."}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                Cost breakdown
              </div>
              <div className="mt-3">
                <CostSnapshotDetails costSnapshot={selectedRecommendation.costSnapshot} />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                Compare-at strategy
              </div>
              <div className="mt-3">
                <CompareAtSnapshotDetails
                  compareAtSnapshot={selectedRecommendation.compareAtSnapshot}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                Reason codes
              </div>
              <div className="mt-3">
                <ReasonCodeList reasonCodes={selectedRecommendation.reasonCodes} />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
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
                    onChange={(event) => {
                      setCustomApprovalPrice(event.target.value);
                      if (customApprovalError) {
                        setCustomApprovalError("");
                      }
                    }}
                    placeholder="e.g. 89,95"
                  />
                </AdminField>
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
                  Recommendation {formatCurrency(selectedRecommendation.publishablePriceCents)}
                  <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                    Floor {formatCurrency(selectedRecommendation.hardMinimumPriceCents)}
                  </div>
                </div>
              </div>
              {customApprovalError ? (
                <div className="mt-3 rounded-xl border border-[var(--adm-error)] bg-[#fae7e3] px-4 py-3 text-sm text-[var(--adm-error)]">
                  {customApprovalError}
                </div>
              ) : null}
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
    </AdminPage>
  );
}
