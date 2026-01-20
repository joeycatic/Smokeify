import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import AccountDashboardClient from "./AccountDashboardClient";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-4xl px-6 py-12 text-stone-800">
          <h1 className="text-2xl font-bold mb-4 sm:text-3xl" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-stone-600 mb-6">
            Melde dich an, um Setups zu speichern, Wunschlisten zu verwalten und
            Bestellungen einzusehen.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex w-full justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </PageLayout>
    );
  }

  const [setups, wishlistCount, user, orders] = await Promise.all([
    prisma.savedSetup.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.wishlistItem.count({
      where: { userId: session.user.id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        amountTotal: true,
        currency: true,
        paymentStatus: true,
        status: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  const setupItems = setups.map(
    (setup: { id: string; name: string | null; createdAt: Date }) => ({
      id: setup.id,
      name: setup.name ?? "Saved setup",
      createdAt: setup.createdAt.toISOString(),
    })
  );
  const orderItems = orders.map((order) => ({
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    amountTotal: order.amountTotal,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    status: order.status,
    itemsCount: order._count.items,
  }));

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-8 text-stone-800">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-2xl font-bold mb-2 sm:text-3xl" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-sm text-stone-600 break-words">
            Eingeloggt als {session.user.email ?? "User"}
            {session.user.role === "ADMIN"
              ? ` - Rolle: ${session.user.role}`
              : ""}
          </p>
          {session.user.role === "ADMIN" && (
            <div className="mt-3">
              <Link
                href="/admin"
                className="inline-flex w-full justify-center rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-black/20 sm:w-auto"
              >
                Zum Admin Panel
              </Link>
            </div>
          )}
        </div>

        <AccountDashboardClient
          profile={{
            name: user?.name ?? "",
            email: user?.email ?? "",
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
            street: user?.street ?? "",
            houseNumber: user?.houseNumber ?? "",
            postalCode: user?.postalCode ?? "",
            city: user?.city ?? "",
            country: user?.country ?? "",
          }}
          wishlistCount={wishlistCount}
          setups={setupItems}
          orders={orderItems}
        />
        <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          <SignOutButton />
          <DeleteAccountButton />
        </div>
      </div>
    </PageLayout>
  );
}
