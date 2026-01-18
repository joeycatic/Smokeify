import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminUsersClient from "./AdminUsersClient";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const backInStockRequests = await prisma.backInStockRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const backInStockSummary = new Map<
    string,
    {
      productId: string;
      productTitle: string | null;
      total: number;
      pending: number;
      latest: Date;
      users: Map<string, { name: string | null; email: string | null }>;
    }
  >();

  for (const request of backInStockRequests) {
    const key = request.productId;
    const entry = backInStockSummary.get(key) ?? {
      productId: request.productId,
      productTitle: request.productTitle,
      total: 0,
      pending: 0,
      latest: request.createdAt,
      users: new Map<string, { name: string | null; email: string | null }>(),
    };

    entry.total += 1;
    if (!request.notifiedAt) {
      entry.pending += 1;
    }
    if (request.createdAt > entry.latest) {
      entry.latest = request.createdAt;
    }
    if (request.userId && request.user) {
      entry.users.set(request.user.id, {
        name: request.user.name,
        email: request.user.email,
      });
    }

    backInStockSummary.set(key, entry);
  }

  const backInStockRows = Array.from(backInStockSummary.values())
    .sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return b.latest.getTime() - a.latest.getTime();
    })
    .slice(0, 25);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
                Admin
              </h1>
              <p className="text-sm text-stone-600">
                Nutzerverwaltung und Rollensteuerung.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              Dashboard
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/admin/catalog"
              className="inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm hover:border-emerald-300"
            >
              Manage catalog
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-800 shadow-sm hover:border-blue-300"
            >
              Manage orders
            </Link>
            <Link
              href="/admin/returns"
              className="inline-flex rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-800 shadow-sm hover:border-amber-300"
            >
              Manage returns
            </Link>
            <Link
              href="/admin/discounts"
              className="inline-flex rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:border-rose-300"
            >
              Manage discounts
            </Link>
            <Link
              href="/admin/analytics"
              className="inline-flex rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-700 shadow-sm hover:border-violet-300"
            >
              Analytics
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <AdminUsersClient
            initialUsers={users.map((user) => ({
              ...user,
              createdAt: user.createdAt.toISOString(),
            }))}
          />
        </div>
        <div className="mt-12 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#2f3e36" }}>
            Back-in-stock requests
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            Overview of recent notification requests (top 25 by pending count).
          </p>
          {backInStockRows.length === 0 ? (
            <p className="text-sm text-stone-500">No requests yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
              <div className="grid grid-cols-1 gap-3 border-b border-black/10 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:grid-cols-[2fr_120px_120px_2fr]">
                <div>Product</div>
                <div>Total</div>
                <div>Pending</div>
                <div>Logged-in users</div>
              </div>
              <div className="divide-y divide-black/10">
                {backInStockRows.map((row) => {
                  const usersList = Array.from(row.users.values())
                    .map((user) => user.name || user.email || "Unknown")
                    .join(", ");

                  return (
                    <div
                      key={row.productId}
                      className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[2fr_120px_120px_2fr]"
                    >
                      <div>
                        <div className="font-semibold text-stone-800">
                          {row.productTitle || row.productId}
                        </div>
                        <div className="text-xs text-stone-500">{row.productId}</div>
                      </div>
                      <div>{row.total}</div>
                      <div>{row.pending}</div>
                      <div className="text-xs text-stone-600">
                        {usersList || "None"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
