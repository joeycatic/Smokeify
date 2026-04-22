import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminInsightPrimitives";
import { getVatPageData } from "@/lib/adminAddonData";
import { requireAdmin } from "@/lib/adminCatalog";

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${emphasize ? "text-amber-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

export default async function AdminVatPage() {
  if (!(await requireAdmin())) notFound();

  const { current, monthly, ustva, deadline, expenseMigrationRequired } = await getVatPageData(6);
  const currency = "EUR";
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#11110a] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.2),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.15),_transparent_28%),linear-gradient(135deg,_rgba(18,16,8,0.98),_rgba(26,21,10,0.94))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/70">
              Control Layer / Umsatzsteuer
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Umsatzsteuer-Monitor für monatliche Prüfung und Übergabe
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Operative Sicht auf Umsatzsteuer, Vorsteuer und Vollständigkeit für die monatliche
              Übergabe. Diese Seite unterstützt Prüfung und Buchhaltungsvorbereitung, nicht die
              Abgabe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/admin/finance"
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Finanzübersicht
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-amber-200 transition hover:border-amber-300/30 hover:bg-amber-400/15"
            >
              Bestellungen prüfen
            </Link>
            <Link
              href="/admin/expenses"
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Ausgaben
            </Link>
            {expenseMigrationRequired ? (
              <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-2 text-red-200">
                Export nicht verfügbar
              </span>
            ) : (
              <>
                <a
                  href={`/api/admin/vat/ustva?format=json${ustva ? `&month=${ustva.monthKey}` : ""}`}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  UStVA JSON
                </a>
                <a
                  href={`/api/admin/vat/ustva?format=csv${ustva ? `&month=${ustva.monthKey}` : ""}`}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  UStVA CSV
                </a>
                <a
                  href={`/api/admin/expenses/export?month=${currentMonthKey}`}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Ausgaben-CSV
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {expenseMigrationRequired ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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

              <div className="admin-data-grid-scroll rounded-[24px] border border-white/10 bg-[#090d12]">
                <div className="grid min-w-[760px] grid-cols-[100px_1.6fr_0.9fr_120px_1.6fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
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
                      className="grid min-w-[760px] grid-cols-[100px_1.6fr_0.9fr_120px_1.6fr] gap-3 px-4 py-3 text-sm text-slate-300"
                    >
                      <div className="font-semibold text-white">{field.code ?? "—"}</div>
                      <div>{field.label}</div>
                      <div className="font-semibold text-white">
                        {formatMoney(field.valueCents, currency)}
                      </div>
                      <div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            field.status === "ready"
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                              : field.status === "review_required"
                                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                                : "border-white/10 bg-white/[0.03] text-slate-200"
                          }`}
                        >
                          {field.status === "ready"
                            ? "Bereit"
                            : field.status === "review_required"
                              ? "Prüfen"
                              : "Manuell"}
                        </span>
                      </div>
                      <div className="text-slate-400">{field.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-white">Manuell zu prüfen</div>
                  {ustva.manualReview.map((field) => (
                    <div
                      key={`${field.code ?? "manual"}-${field.label}`}
                      className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                    >
                      <div className="font-semibold">
                        {field.code ? `Kz. ${field.code}` : "Hinweis"} · {field.label}
                      </div>
                      <div className="mt-1 text-amber-50/90">{field.note}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-white">Blocker und Hinweise</div>
                  {ustva.blockers.length ? (
                    ustva.blockers.map((blocker) => (
                      <div
                        key={blocker}
                        className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
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
                      className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300"
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
                    className="rounded-[24px] border border-white/10 bg-[#090d12] px-4 py-4 text-sm text-slate-300"
                  >
                    <div className="font-semibold text-white">{row.monthLabel}</div>
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
              <div className="admin-data-grid-scroll hidden rounded-[24px] border border-white/10 bg-[#090d12] md:block">
                <div className="grid min-w-[720px] grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
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
                      className="grid min-w-[720px] grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] gap-3 px-4 py-3 text-sm text-slate-300"
                    >
                      <div className="font-semibold text-white">{row.monthLabel}</div>
                      <div>{formatMoney(row.outputVatCents, currency)}</div>
                      <div>{formatMoney(row.inputVatCents, currency)}</div>
                      <div className="font-semibold text-amber-300">
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
          </div>
          <div className="mt-4 space-y-3">
            {current?.blockers.length ? (
              current.blockers.map((blocker) => (
                <div
                  key={blocker}
                  className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
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

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Expense Input"
          title="What now feeds input VAT"
          description="The VAT layer now uses recorded deductible expenses and document dates as its input-tax source."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Deductible expenses with VAT amounts contribute to input VAT.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Missing documents, missing VAT amounts, and missing supplier links are now surfaced as blockers.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Export uses the current month expense records as a bookkeeping handover file.
            </div>
          </div>
        </AdminPanel>
        <AdminPanel
          eyebrow="Safe To Automate"
          title="What this layer should do automatically"
          description="These cases are low-risk because they are sourced from confirmed commerce events or structured admin data."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Output VAT from paid orders using the payment-confirmed timestamp.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Refund VAT adjustments derived proportionally from refund amounts.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
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
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Final deductibility decisions for expenses and mixed-use edge cases.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Official filing submission, corrections across periods and accounting exports with legal authority.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Reverse-charge, import VAT and cross-border special cases not modeled in the current admin.
            </div>
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}
