import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  const isAdminOrStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!isAdminOrStaff) notFound();

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-emerald-700/70">
                ADMIN / AUDIT
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#2f3e36]">
                Audit log
              </h1>
              <p className="mt-2 text-sm text-stone-600">
                Timeline of admin actions across orders and catalog changes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminThemeToggle />
              <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                Activity feed
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-stone-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-2">
              <div className="font-semibold text-emerald-700">Action</div>
              <div>What changed: update, refund, inventory edit.</div>
            </div>
            <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
              <div className="font-semibold text-sky-700">Actor</div>
              <div>Who triggered the change (admin email).</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2">
              <div className="font-semibold text-amber-700">Target</div>
              <div>What was affected (order/product/variant).</div>
            </div>
            <div className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2">
              <div className="font-semibold text-violet-700">Time</div>
              <div>When it happened (local timestamp).</div>
            </div>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-stone-500 shadow-sm">
            No audit entries yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-3 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 sm:grid-cols-[1.2fr_1fr_1fr_2fr]">
              <div>Action</div>
              <div>Actor</div>
              <div>Target</div>
              <div>Time</div>
            </div>
            <div className="divide-y divide-black/10">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[1.2fr_1fr_1fr_2fr]"
                >
                  <div>
                    <div className="font-semibold text-emerald-900">
                      {entry.action}
                    </div>
                    {entry.summary && (
                      <div className="text-xs text-stone-500">
                        {entry.summary}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-sky-700">
                    {entry.actorEmail ?? entry.actorId ?? "System"}
                  </div>
                  <div className="text-xs text-amber-700">
                    {entry.targetType && entry.targetId
                      ? `${entry.targetType}:${entry.targetId}`
                      : "—"}
                  </div>
                  <div className="text-xs text-violet-700">
                    {new Date(entry.createdAt).toLocaleString("de-DE")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
