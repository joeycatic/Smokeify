import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminBackButton from "@/components/admin/AdminBackButton";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

export default async function AdminInventoryAdjustmentsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const adjustments = await prisma.inventoryAdjustment.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: { select: { title: true, manufacturer: true } },
      variant: { select: { title: true } },
      order: { select: { orderNumber: true } },
    },
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-emerald-700/70">
                ADMIN / INVENTORY
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#2f3e36]">
                Inventory adjustments
              </h1>
              <p className="mt-2 text-sm text-stone-600">
                Recent stock deductions triggered by paid checkouts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminThemeToggle />
              <AdminBackButton
                inline
                className="h-9 px-4 text-sm text-[#2f3e36] hover:bg-emerald-50"
              />
              <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                Latest 200
              </div>
            </div>
          </div>
        </div>

        {adjustments.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-stone-500 shadow-sm">
            No inventory adjustments yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-3 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 sm:grid-cols-[1.5fr_1fr_0.6fr_0.8fr_1.2fr]">
              <div>Item</div>
              <div>Order</div>
              <div>Delta</div>
              <div>Reason</div>
              <div>Time</div>
            </div>
            <div className="divide-y divide-black/10">
              {adjustments.map((entry) => {
                const productName = entry.product.manufacturer
                  ? `${entry.product.manufacturer} ${entry.product.title}`
                  : entry.product.title;
                const variantTitle = entry.variant.title;
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[1.5fr_1fr_0.6fr_0.8fr_1.2fr]"
                  >
                    <div>
                      <div className="font-semibold text-emerald-900">
                        {productName}
                      </div>
                      {variantTitle && (
                        <div className="text-xs text-stone-500">
                          {variantTitle}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-sky-700">
                      {entry.order?.orderNumber
                        ? `#${entry.order.orderNumber}`
                        : "—"}
                    </div>
                    <div className="text-xs font-semibold text-rose-700">
                      {entry.quantityDelta}
                    </div>
                    <div className="text-xs text-amber-700">
                      {entry.reason}
                    </div>
                    <div className="text-xs text-violet-700">
                      {new Date(entry.createdAt).toLocaleString("de-DE")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
