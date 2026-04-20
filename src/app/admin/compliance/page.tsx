import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { collectProductComplianceBlockers } from "@/lib/productCompliance";
import { prisma } from "@/lib/prisma";

export default async function AdminCompliancePage() {
  if (!(await requireAdmin())) notFound();

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { complianceStatus: { not: "APPROVED" } },
        { storefronts: { has: "GROW" } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    include: {
      mainCategory: {
        select: {
          handle: true,
          storefronts: true,
          parent: { select: { handle: true, storefronts: true } },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              handle: true,
              storefronts: true,
              parent: { select: { handle: true, storefronts: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="admin-legacy-page space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
          Admin / Compliance
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Product compliance review queue
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Review GrowVault-facing catalog policy, blocker signals, feed and ads flags,
          and approval state before public exposure rules are enforced.
        </p>
      </section>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090d12] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          <div>Product</div>
          <div>Storefronts</div>
          <div>Compliance</div>
          <div>Blockers</div>
        </div>
        <div className="divide-y divide-white/5">
          {products.map((product) => {
            const blockers = collectProductComplianceBlockers(product);
            return (
              <div
                key={product.id}
                className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr] gap-3 px-4 py-4 text-sm text-slate-300"
              >
                <div>
                  <Link
                    href={`/admin/catalog/${product.id}`}
                    className="font-semibold text-slate-100 hover:text-cyan-200"
                  >
                    {product.title}
                  </Link>
                  <div className="mt-1 text-xs text-slate-500">{product.handle}</div>
                </div>
                <div className="text-xs text-slate-400">
                  {product.storefronts.join(", ")}
                </div>
                <div className="text-xs text-slate-400">
                  <div>{product.complianceStatus}</div>
                  <div className="mt-1">
                    Feed {product.complianceFeedEligible ? "on" : "off"} · Ads{" "}
                    {product.complianceAdsEligible ? "on" : "off"}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  {blockers.length === 0 ? (
                    <div>No automated blockers</div>
                  ) : (
                    blockers.slice(0, 4).map((blocker, index) => (
                      <div key={`${product.id}-${blocker.type}-${index}`}>
                        {blocker.type}: {blocker.match ?? blocker.reason}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

