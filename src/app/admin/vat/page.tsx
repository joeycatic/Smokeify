import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { getVatPageData } from "@/lib/adminAddonData";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  formatAdminMoney as formatMoney,
  formatAdminPercent as formatPercent,
} from "@/lib/adminFormatting";

const formatVatStatus = (value: "estimated" | "review_required" | "ready_for_handover") => {
  if (value === "ready_for_handover") return "Bereit zur Übergabe";
  if (value === "review_required") return "Prüfung erforderlich";
  return "Geschätzt";
};

function VatMobileValue({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${emphasize ? "text-[#81560e]" : "text-[var(--adm-text)]"}`}>
        {value}
      </div>
    </div>
  );
}

export default async function AdminVatPage() {
  if (!(await requireAdminScope("tax.review"))) notFound();

  const { current, monthly, ustva, deadline, expenseMigrationRequired } = await getVatPageData(6);
  const currency = "EUR";
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  return (
    <AdminPage layout="dashboard">
      <AdminPageHeader
        eyebrow="Control Layer / Umsatzsteuer"
        title="Umsatzsteuer-Monitor"
        description="Monatliche Prüfung von Umsatzsteuer, Vorsteuer und Vollständigkeit für die Buchhaltungsvorbereitung."
        actions={<Link href="/admin/finance" className="inline-flex h-8 items-center rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-[13px] font-semibold text-[var(--adm-text)]">Finanzübersicht</Link>}
      />
      <section className="hidden">
        <div className="absolute inset-0 bg-[var(--adm-surface)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#81560e]/70">
              Control Layer / Umsatzsteuer
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--adm-text)]">
              Umsatzsteuer-Monitor für monatliche Prüfung und Übergabe
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-[var(--adm-text-muted)]">
              Operative Sicht auf Umsatzsteuer, Vorsteuer und Vollständigkeit für die monatliche
              Übergabe. Diese Seite unterstützt Prüfung und Buchhaltungsvorbereitung, nicht die
              Abgabe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/admin/finance"
              className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
            >
              Finanzübersicht
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-3 py-2 text-[#81560e] transition hover:border-[#e2a136] hover:bg-amber-400/15"
            >
              Bestellungen prüfen
            </Link>
            <Link
              href="/admin/expenses"
              className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
            >
              Ausgaben
            </Link>
            {expenseMigrationRequired ? (
              <span className="rounded-full border border-[var(--adm-error)] bg-[#fae7e3] px-3 py-2 text-[var(--adm-error)]">
                Export nicht verfügbar
              </span>
            ) : (
              <>
                <a
                  href={`/api/admin/vat/ustva?format=json${ustva ? `&month=${ustva.monthKey}` : ""}`}
                  className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                >
                  UStVA JSON
                </a>
                <a
                  href={`/api/admin/vat/ustva?format=csv${ustva ? `&month=${ustva.monthKey}` : ""}`}
                  className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                >
                  UStVA CSV
                </a>
                <a
                  href={`/api/admin/expenses/export?month=${currentMonthKey}`}
                  className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                >
                  Ausgaben-CSV
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {expenseMigrationRequired ? (
        <div className="rounded-xl border border-amber-500/20 bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          Ausgaben sind in der aktuellen Datenbank noch nicht vollständig verfügbar. Umsatzsteuer
          wird weiterhin angezeigt, Vorsteuer und Export bleiben aber bis zur Migration gesperrt.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard
          label="Output VAT"
          value={formatMoney(current?.outputVatCents ?? 0, currency)}
          detail={current ? current.monthLabel : "current month"}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="recognized from paid orders only"
          tone="amber"
        />
        <AdminMetricCard
          label="Input VAT"
          value={formatMoney(current?.inputVatCents ?? 0, currency)}
          detail={current?.status === "review_required" ? "incomplete" : "tracked"}
          detailBadgeClassName="orders-kpi-badge-slate"
          footnote={
            (current?.expenseCount ?? 0) > 0
              ? `${current?.expenseCount ?? 0} expense records in period`
              : "no expense source captured"
          }
        />
        <AdminMetricCard
          label="VAT Liability"
          value={formatMoney(current?.estimatedLiabilityCents ?? 0, currency)}
          detail={formatVatStatus(current?.status ?? "estimated")}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="management estimate only"
          tone="amber"
        />
        <AdminMetricCard
          label="Tax Coverage"
          value={formatPercent(current?.taxCoverageRate ?? 0)}
          detail={`${current?.ordersMissingTaxCount ?? 0} missing`}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote="orders with captured VAT amounts"
          tone="violet"
        />
        <AdminMetricCard
          label="Deadline"
          value={`${deadline.daysUntilDue} days`}
          detail={deadline.statusLabel}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote={deadline.dueDate.toLocaleDateString("de-DE")}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <AdminPanel
          eyebrow="UStVA Vorbereitung"
          title={ustva ? `Umsatzsteuer-Voranmeldung ${ustva.monthLabel}` : "UStVA Vorbereitung"}
          description="Vorbereitete Kennzahlen für die monatliche Übergabe. Die Werte helfen bei der Voranmeldung, ersetzen aber keine ELSTER-Übermittlung oder steuerliche Prüfung."
        >
          {ustva ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AdminCompactMetric label="Status" value={ustva.filingLabel} />
                <AdminCompactMetric label="Saldo" value={ustva.paymentStateLabel} />
                <AdminCompactMetric
                  label="Zahllast"
                  value={formatMoney(ustva.payableCents, currency)}
                />
                <AdminCompactMetric
                  label="Überschuss"
                  value={formatMoney(ustva.refundCents, currency)}
                />
              </div>

              <div className="admin-data-grid-scroll rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]">
                <div className="grid min-w-[760px] grid-cols-[100px_1.6fr_0.9fr_120px_1.6fr] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                  <div>Kz.</div>
                  <div>Bezeichnung</div>
                  <div>Wert</div>
                  <div>Status</div>
                  <div>Hinweis</div>
                </div>
                <div className="divide-y divide-white/5">
                  {ustva.fields.map((field) => (
                    <div
                      key={`${field.code ?? "info"}-${field.label}`}
                      className="grid min-w-[760px] grid-cols-[100px_1.6fr_0.9fr_120px_1.6fr] gap-3 px-4 py-3 text-sm text-[var(--adm-text-muted)]"
                    >
                      <div className="font-semibold text-[var(--adm-text)]">{field.code ?? "—"}</div>
                      <div>{field.label}</div>
                      <div className="font-semibold text-[var(--adm-text)]">
                        {formatMoney(field.valueCents, currency)}
                      </div>
                      <div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            field.status === "ready"
                              ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                              : field.status === "review_required"
                                ? "border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
                                : "border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text)]"
                          }`}
                        >
                          {field.status === "ready"
                            ? "Bereit"
                            : field.status === "review_required"
                              ? "Prüfen"
                              : "Manuell"}
                        </span>
                      </div>
                      <div className="text-[var(--adm-text-muted)]">{field.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--adm-text)]">Manuell zu prüfen</div>
                  {ustva.manualReview.map((field) => (
                    <div
                      key={`${field.code ?? "manual"}-${field.label}`}
                      className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]"
                    >
                      <div className="font-semibold">
                        {field.code ? `Kz. ${field.code}` : "Hinweis"} · {field.label}
                      </div>
                      <div className="mt-1 text-amber-50/90">{field.note}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--adm-text)]">Blocker und Hinweise</div>
                  {ustva.blockers.length ? (
                    ustva.blockers.map((blocker) => (
                      <div
                        key={blocker}
                        className="rounded-xl border border-[var(--adm-error)] bg-[#fae7e3] px-4 py-3 text-sm text-[var(--adm-error)]"
                      >
                        {blocker}
                      </div>
                    ))
                  ) : (
                    <AdminEmptyState copy="Für die vorbereiteten Kernkennzahlen sind aktuell keine Blocker markiert." />
                  )}
                  {ustva.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <AdminEmptyState copy="Noch keine UStVA-Daten für den aktuellen Zeitraum vorhanden." />
          )}
        </AdminPanel>

        <AdminPanel
          eyebrow="Monthly Tracking"
          title="VAT by reporting month"
          description="Rolling six-month monitor for output VAT, estimated liability and data quality."
        >
          {monthly.length === 0 ? (
            <AdminEmptyState copy="No VAT periods are available yet." />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {monthly.map((row) => (
                  <div
                    key={row.monthKey}
                    className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]"
                  >
                    <div className="font-semibold text-[var(--adm-text)]">{row.monthLabel}</div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <VatMobileValue label="Output" value={formatMoney(row.outputVatCents, currency)} />
                      <VatMobileValue label="Input" value={formatMoney(row.inputVatCents, currency)} />
                      <VatMobileValue label="Liability" value={formatMoney(row.estimatedLiabilityCents, currency)} emphasize />
                      <VatMobileValue label="Coverage" value={formatPercent(row.taxCoverageRate)} />
                      <VatMobileValue label="Status" value={formatVatStatus(row.status)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-data-grid-scroll hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] md:block">
                <div className="grid min-w-[720px] grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                  <div>Month</div>
                  <div>Output</div>
                  <div>Input</div>
                  <div>Liability</div>
                  <div>Coverage</div>
                  <div>Status</div>
                </div>
                <div className="divide-y divide-white/5">
                  {monthly.map((row) => (
                    <div
                      key={row.monthKey}
                      className="grid min-w-[720px] grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] gap-3 px-4 py-3 text-sm text-[var(--adm-text-muted)]"
                    >
                      <div className="font-semibold text-[var(--adm-text)]">{row.monthLabel}</div>
                      <div>{formatMoney(row.outputVatCents, currency)}</div>
                      <div>{formatMoney(row.inputVatCents, currency)}</div>
                      <div className="font-semibold text-[#81560e]">
                        {formatMoney(row.estimatedLiabilityCents, currency)}
                      </div>
                      <div>{formatPercent(row.taxCoverageRate)}</div>
                      <div>{formatVatStatus(row.status)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </AdminPanel>

        <AdminPanel
          eyebrow="Completeness"
          title="Current month blockers"
          description="This is the review surface for what the admin can automate today versus what still requires bookkeeping or manual finance judgment."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric
              label="Orders missing VAT"
              value={String(current?.ordersMissingTaxCount ?? 0)}
            />
            <AdminCompactMetric
              label="Refunded VAT estimate"
              value={formatMoney(current?.refundedVatEstimateCents ?? 0, currency)}
            />
            <AdminCompactMetric
              label="Missing expense docs"
              value={String(current?.missingExpenseDocumentCount ?? 0)}
            />
            <AdminCompactMetric
              label="Missing expense VAT"
              value={String(current?.missingExpenseVatCount ?? 0)}
            />
            <AdminCompactMetric
              label="Missing allocation"
              value={String(current?.missingExpenseAllocationCount ?? 0)}
            />
          </div>
          <div className="mt-4 space-y-3">
            {(current?.missingExpenseAllocationCount ?? 0) > 0 ? (
              <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
                {current?.missingExpenseAllocationCount ?? 0} expense record(s) are still missing
                complete storefront allocations. Scoped VAT views remain incomplete until those rows
                are assigned in{" "}
                <Link href="/admin/expenses" className="font-semibold underline underline-offset-2">
                  Expenses
                </Link>
                .
              </div>
            ) : null}
            {current?.blockers.length ? (
              current.blockers.map((blocker) => (
                <div
                  key={blocker}
                  className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]"
                >
                  {blocker}
                </div>
              ))
            ) : (
              <AdminEmptyState copy="No blockers are currently flagged for the active month." />
            )}
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <AdminPanel
          eyebrow="Expense Input"
          title="What now feeds input VAT"
          description="The VAT layer now uses recorded deductible expenses and document dates as its input-tax source."
        >
          <div className="space-y-3 text-sm text-[var(--adm-text-muted)]">
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Deductible expenses with VAT amounts contribute to input VAT.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Missing documents, missing VAT amounts, and missing supplier links are now surfaced as blockers.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Export uses the current month expense records as a bookkeeping handover file.
            </div>
          </div>
        </AdminPanel>
        <AdminPanel
          eyebrow="Safe To Automate"
          title="What this layer should do automatically"
          description="These cases are low-risk because they are sourced from confirmed commerce events or structured admin data."
        >
          <div className="space-y-3 text-sm text-[var(--adm-text-muted)]">
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Output VAT from paid orders using the payment-confirmed timestamp.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Refund VAT adjustments derived proportionally from refund amounts.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Month-by-month tracking, deadline reminders and completeness status.
            </div>
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Informational Only"
          title="What stays outside this add-on"
          description="These areas must remain review-only until the system has formal accounting-grade source data and policy handling."
        >
          <div className="space-y-3 text-sm text-[var(--adm-text-muted)]">
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Final deductibility decisions for expenses and mixed-use edge cases.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Official filing submission, corrections across periods and accounting exports with legal authority.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Reverse-charge, import VAT and cross-border special cases not modeled in the current admin.
            </div>
          </div>
        </AdminPanel>
      </section>
    </AdminPage>
  );
}
