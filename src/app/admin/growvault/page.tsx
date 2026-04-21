import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  getGrowvaultSharedDiagnosticsFeed,
  getGrowvaultSharedMerchandisingFeed,
} from "@/lib/growvaultSharedStorefront";
import { AdminPageIntro, AdminPanel } from "@/components/admin/AdminWorkspace";

export default async function AdminGrowvaultPage() {
  if (!(await requireAdmin())) notFound();

  const [diagnostics, merchandising] = await Promise.all([
    getGrowvaultSharedDiagnosticsFeed(),
    getGrowvaultSharedMerchandisingFeed(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <div className="space-y-5">
        <AdminPageIntro
          eyebrow="Growvault"
          title="Shared storefront diagnostics"
          description="Smokeify-owned operational surface for Growvault contract health, merchandising slots, and analyzer handoff status."
          metrics={
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Status entries
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {diagnostics.statuses.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Warn / fail
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {
                    diagnostics.statuses.filter(
                      (status) => status.status === "warn" || status.status === "fail",
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Merch slots
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{merchandising.slots.length}</p>
              </div>
            </div>
          }
        />

        <AdminPanel
          title="Operational statuses"
          description="Machine-readable signals exported to Growvault and reused for alerts."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {diagnostics.statuses.map((status) => (
              <div
                key={status.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {status.status}
                  </span>
                  <span className="text-xs text-slate-500">{status.key}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{status.summary}</p>
                {status.actionUrl ? (
                  <a
                    href={status.actionUrl}
                    className="mt-3 inline-flex text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline"
                  >
                    Open workspace
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Shared merchandising feed"
          description="Growvault homepage sections now resolve from these Smokeify-managed slots."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {merchandising.slots.map((slot) => (
              <div
                key={slot.slotKey}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {slot.slotKey}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{slot.copy?.title ?? slot.slotKey}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {slot.productHandles.length} product handle(s) in the live feed.
                </p>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
