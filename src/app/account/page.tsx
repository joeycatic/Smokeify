import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductsByIdsAllowInactive } from "@/lib/catalog";
import PageLayout from "@/components/PageLayout";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import AccountDashboardClient from "./AccountDashboardClient";

type LoyaltyTransactionRow = {
  id: string;
  pointsDelta: number;
  reason: string;
  createdAt: Date;
  orderId: string | null;
};

type AccountUserRow = {
  name: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
};

const isMissingRelationError = (error: unknown, relation: string) =>
  error instanceof Error &&
  error.message.includes(`relation "${relation}" does not exist`);

const isMissingColumnError = (error: unknown, column: string) =>
  error instanceof Error &&
  error.message.includes(`column "${column}" does not exist`);

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-4xl px-6 py-12 text-stone-800">
          <h1
            className="text-2xl font-bold mb-4 sm:text-3xl"
            style={{ color: "#2f3e36" }}
          >
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

  const [setups, wishlistCount, wishlistItems, userRow, loyaltyBalanceRows, orders, loyaltyTransactions] =
    await Promise.all([
      prisma.savedSetup.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.wishlistItem.count({
        where: { userId: session.user.id },
      }),
      prisma.wishlistItem.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { productId: true },
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
      (async () => {
        try {
          return await prisma.$queryRaw<Array<{ loyaltyPointsBalance: number }>>`
            SELECT "loyaltyPointsBalance"
            FROM "User"
            WHERE id = ${session.user.id}
            LIMIT 1
          `;
        } catch (error) {
          if (isMissingColumnError(error, "loyaltyPointsBalance")) {
            return [] as Array<{ loyaltyPointsBalance: number }>;
          }
          throw error;
        }
      })(),
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
      (async () => {
        try {
          return await prisma.$queryRaw<LoyaltyTransactionRow[]>`
            SELECT
              id,
              "pointsDelta",
              reason,
              "createdAt",
              "orderId"
            FROM "LoyaltyPointTransaction"
            WHERE "userId" = ${session.user.id}
            ORDER BY "createdAt" DESC
            LIMIT 5
          `;
        } catch (error) {
          if (isMissingRelationError(error, "LoyaltyPointTransaction")) {
            return [] as LoyaltyTransactionRow[];
          }
          throw error;
        }
      })(),
    ]);

  const loyaltyPointsBalance = loyaltyBalanceRows[0]?.loyaltyPointsBalance ?? 0;
  const user: AccountUserRow | null = userRow
    ? {
        ...userRow,
      }
    : null;

  const wishlistPreview = await getProductsByIdsAllowInactive(
    wishlistItems.map((item: { productId: string }) => item.productId),
  );

  const setupItems = setups.map(
    (setup: {
      id: string;
      name: string | null;
      createdAt: Date;
      data: unknown;
    }) => ({
      id: setup.id,
      name: setup.name ?? "Saved setup",
      createdAt: setup.createdAt.toISOString(),
      data: setup.data as {
        sizeId?: string;
        lightId?: string[];
        ventId?: string[];
        extras?: string[];
      },
    }),
  );

  const orderItems = orders.map((order: {
    id: string;
    createdAt: Date;
    amountTotal: number;
    currency: string;
    paymentStatus: string;
    status: string;
    _count: { items: number };
  }) => ({
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    amountTotal: order.amountTotal,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    status: order.status,
    itemsCount: order._count.items,
  }));

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.name ?? session.user.email ?? "";

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : (session.user.email?.[0] ?? "?").toUpperCase();

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-8 text-stone-800">
        {/* User hero card */}
        <div className="mb-7 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="h-2 w-full bg-gradient-to-r from-[#2f3e36] via-[#44584c] to-[#2f3e36]" />
          <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
            <div
              className="flex shrink-0 items-center justify-center rounded-full bg-[#2f3e36] text-xl font-bold text-[#E4C56C] ring-4 ring-[#E4C56C]/20"
              style={{ height: 54, width: 54 }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-stone-900">
                {displayName}
              </p>
              <p className="truncate text-sm text-stone-500">
                {session.user.email}
              </p>
            </div>
            {session.user.role === "ADMIN" && (
              <span className="shrink-0 rounded-full bg-[#2f3e36] px-3 py-1 text-xs font-semibold text-[#E4C56C]">
                Admin
              </span>
            )}
          </div>
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
          wishlistPreview={wishlistPreview}
          setups={setupItems}
          orders={orderItems}
        />

        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-black/40">
            LOYALTY POINTS
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              Aktueller Stand
            </p>
            <p className="text-2xl font-bold text-[#2f3e36]">
              {loyaltyPointsBalance}
            </p>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Du erhältst standardmäßig {process.env.LOYALTY_POINTS_PER_EUR ?? "1"} Punkt(e) pro 1,00 EUR Warenwert.
          </p>
          {loyaltyTransactions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {loyaltyTransactions.map((entry: {
                id: string;
                pointsDelta: number;
                reason: string;
                createdAt: Date;
              }) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-xs"
                >
                  <span className="text-stone-600">
                    {entry.reason === "order_paid" ? "Bestellung bezahlt" : entry.reason}{" "}
                    · {new Date(entry.createdAt).toLocaleDateString("de-DE")}
                  </span>
                  <span className="font-semibold text-emerald-700">
                    +{entry.pointsDelta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Konto-Aktionen */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-black/40">
            KONTO-AKTIONEN
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />
            <DeleteAccountButton />
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-black/10 bg-white px-5 text-sm font-semibold text-stone-700 transition hover:border-black/20 sm:h-12 sm:w-auto sm:text-base"
              >
                Zum Admin Panel
              </Link>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
