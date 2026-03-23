import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import { requireAdmin } from "@/lib/adminCatalog";

export default async function AdminAuditPage() {
  if (!(await requireAdmin())) notFound();

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="admin-legacy-page space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Audit
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Audit log</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Timeline of admin actions across orders, catalog changes, and
              sensitive operational actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              Latest 200 events
            </div>
          </div>
        </div>
      </section>

      {logs.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-500">
          No audit entries yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090d12] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:grid-cols-[1.2fr_1fr_1fr_2fr]">
            <div>Action</div>
            <div>Actor</div>
            <div>Target</div>
            <div>Time</div>
          </div>
          <div className="divide-y divide-white/5">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-300 sm:grid-cols-[1.2fr_1fr_1fr_2fr]"
              >
                <div>
                  <div className="font-semibold text-slate-100">{entry.action}</div>
                  {entry.summary ? (
                    <div className="text-xs text-slate-500">{entry.summary}</div>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">
                  {entry.actorEmail ?? entry.actorId ?? "System"}
                </div>
                <div className="text-xs text-cyan-300">
                  {entry.targetType && entry.targetId
                    ? `${entry.targetType}:${entry.targetId}`
                    : "—"}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(entry.createdAt).toLocaleString("de-DE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
