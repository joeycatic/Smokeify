"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { AdminPage, AdminPrimaryGrid } from "@/components/admin/ui";
import { STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";
import type { NewsletterAttributionDiagnostics } from "@/lib/adminNewsletter";
import type { listUnresolvedOrderAttributionRows } from "@/lib/adminAttribution";

type AttributionSnapshot = Awaited<ReturnType<typeof listUnresolvedOrderAttributionRows>>;
type AttributionRow = AttributionSnapshot["rows"][number];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default function AdminAttributionClient({
  initialRows,
  initialEvidenceCounts,
  newsletterDiagnostics,
}: {
  initialRows: AttributionRow[];
  initialEvidenceCounts: AttributionSnapshot["evidenceCounts"];
  newsletterDiagnostics: NewsletterAttributionDiagnostics;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const exactCandidateCount = useMemo(
    () => rows.filter((row) => row.candidate.exact && row.candidate.storefront).length,
    [rows],
  );

  const applyAttribution = async (orderId: string, storefront: StorefrontCode) => {
    const reason = reasons[orderId]?.trim() ?? "";
    if (!reason) {
      setError("A short reason is required before updating storefront attribution.");
      return;
    }
    setError("");
    setNotice("");
    setSavingOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/attribution/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceStorefront: storefront, reason }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update attribution.");
        return;
      }
      setRows((current) => current.filter((row) => row.id !== orderId));
      setReasons((current) => ({ ...current, [orderId]: "" }));
      setNotice(`Order attribution updated to ${STOREFRONT_LABELS[storefront]}.`);
    } catch {
      setError("Could not update attribution.");
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <AdminPage layout="queue">
      <AdminPageIntro
        eyebrow="Admin / Attribution"
        title="Storefront attribution remediation"
        description="Repair missing storefront attribution with exact evidence only. Orders remain unresolved until they can be classified without guessing, and newsletter recipients stay excluded until that evidence exists."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Unresolved orders"
              value={String(rows.length)}
              detail="queue"
              footnote="missing sourceStorefront"
            />
            <AdminMetricCard
              label="Exact candidates"
              value={String(exactCandidateCount)}
              detail="ready"
              footnote="host, origin, or unique history"
              tone="emerald"
            />
            <AdminMetricCard
              label="Ambiguous"
              value={String(initialEvidenceCounts.ambiguous)}
              detail="manual review"
              footnote="multiple storefront signals"
              tone="amber"
            />
            <AdminMetricCard
              label="Excluded emails"
              value={String(newsletterDiagnostics.unresolvedRecipients.length)}
              detail="newsletter"
              footnote="not guessed into campaigns"
              tone="violet"
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <AdminPrimaryGrid rail="wide">
        <AdminPanel
          eyebrow="Diagnostics"
          title="Evidence mix"
          description="These counts show how much of the queue can be resolved with exact signals versus cases that still need more data."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Metadata", initialEvidenceCounts.metadata],
              ["Origin", initialEvidenceCounts.origin],
              ["Host", initialEvidenceCounts.host],
              ["Customer history", initialEvidenceCounts.customer_history],
              ["Ambiguous", initialEvidenceCounts.ambiguous],
              ["No signal", initialEvidenceCounts.none],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                  {label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--adm-text)]">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-3 text-sm text-[var(--adm-primary)]">
            Exact matches can be applied here immediately. Ambiguous rows stay in the queue until
            better evidence exists or an operator assigns them deliberately with a reason.
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Newsletter"
          title="Excluded newsletter recipients"
          description="Active recipients without exact storefront attribution remain excluded from storefront campaigns until their order history is repaired."
        >
          {newsletterDiagnostics.unresolvedRecipients.length === 0 ? (
            <AdminNotice tone="success">
              All active newsletter recipients currently resolve to at least one storefront.
            </AdminNotice>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
                  Smokeify-attributed recipients:{" "}
                  <span className="font-semibold text-[var(--adm-text)]">
                    {newsletterDiagnostics.byStorefront.MAIN.attributedRecipientCount}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
                  GrowVault-attributed recipients:{" "}
                  <span className="font-semibold text-[var(--adm-text)]">
                    {newsletterDiagnostics.byStorefront.GROW.attributedRecipientCount}
                  </span>
                </div>
              </div>
              <div className="max-h-[18rem] overflow-auto rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)]">
                <table className="min-w-full text-left text-sm text-[var(--adm-text)]">
                  <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                    <tr>
                      <th className="px-4 py-3">Recipient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newsletterDiagnostics.unresolvedRecipients.slice(0, 80).map((email) => (
                      <tr key={email} className="border-t border-[var(--adm-border)]">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--adm-text-muted)]">{email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AdminPanel>
      </AdminPrimaryGrid>

      <AdminPanel
        eyebrow="Queue"
        title="Unresolved orders"
        description="Assign only when the candidate is exact or you have external evidence. Every manual fix requires a reason and writes to the admin audit log."
      >
        {rows.length === 0 ? (
          <AdminNotice tone="success">
            No unresolved orders are waiting for storefront attribution.
          </AdminNotice>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--adm-border)]">
            <table className="min-w-full text-left text-sm text-[var(--adm-text)]">
              <thead className="bg-[var(--adm-surface-2)] text-[11px] uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Observed source</th>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const candidateStorefront = row.candidate.storefront;
                  const isSaving = savingOrderId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-[var(--adm-border)] align-top">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Link href={`/admin/orders/${row.id}`} className="font-semibold text-[var(--adm-text)] hover:text-[var(--adm-primary)]">
                            #{row.orderNumber}
                          </Link>
                          <div className="text-xs text-[var(--adm-text-muted)]">{formatDateTime(row.createdAt)}</div>
                          <div className="text-xs text-[var(--adm-text-faint)]">{row.customerEmail ?? "No email"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-[var(--adm-text-muted)]">
                        <div>{row.sourceHost ?? "No host"}</div>
                        <div className="mt-1 break-all text-[var(--adm-text-faint)]">{row.sourceOrigin ?? "No origin"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              row.candidate.exact
                                ? "bg-emerald-400/15 text-[var(--adm-success)]"
                                : "bg-amber-400/15 text-[#81560e]"
                            }`}
                          >
                            {row.candidate.exact ? "Exact" : "Needs review"} · {row.candidate.sourceType}
                          </span>
                          <div className="text-sm text-[var(--adm-text)]">
                            {candidateStorefront ? STOREFRONT_LABELS[candidateStorefront] : "No exact storefront"}
                          </div>
                          <div className="text-xs text-[var(--adm-text-muted)]">{row.candidate.detail}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminInput
                          value={reasons[row.id] ?? ""}
                          onChange={(event) =>
                            setReasons((current) => ({ ...current, [row.id]: event.target.value }))
                          }
                          placeholder="Why is this storefront correct?"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[14rem] flex-col gap-2">
                          {candidateStorefront ? (
                            <AdminButton
                              onClick={() => void applyAttribution(row.id, candidateStorefront)}
                              disabled={isSaving}
                            >
                              {isSaving ? "Saving..." : `Apply ${STOREFRONT_LABELS[candidateStorefront]}`}
                            </AdminButton>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <AdminButton
                              tone="secondary"
                              onClick={() => void applyAttribution(row.id, "MAIN")}
                              disabled={isSaving}
                            >
                              Set Smokeify
                            </AdminButton>
                            <AdminButton
                              tone="secondary"
                              onClick={() => void applyAttribution(row.id, "GROW")}
                              disabled={isSaving}
                            >
                              Set GrowVault
                            </AdminButton>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </AdminPage>
  );
}
