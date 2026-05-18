import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductsByIdsAllowInactive } from "@/lib/catalog";
import PageLayout from "@/components/PageLayout";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import AccountDashboardClient from "./AccountDashboardClient";
import {
  formatRedeemRateLabel,
  getLoyaltyPointsPerEuro,
} from "@/lib/loyalty";
import { loadCheckoutUser } from "@/lib/checkoutUser";

type LoyaltyTransactionRow = {
  id: string;
  pointsDelta: number;
  reason: string;
  createdAt: Date;
  orderId: string | null;
};

type AccountUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  shippingAddressType: string | null;
  packstationNumber: string | null;
  postNumber: string | null;
  loyaltyPointsBalance: number;
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
      <PageLayout commerce>
        <div className="smk-storefront-legacy mx-auto max-w-4xl px-6 py-12 text-[var(--smk-text)]">
          <h1 className="smk-heading mb-4 text-2xl sm:text-3xl">
            Account
          </h1>
          <p className="mb-6 text-[var(--smk-text-muted)]">
            Melde dich an, um Setups zu speichern, Wunschlisten zu verwalten und
            Bestellungen einzusehen.
          </p>
          <Link
            href="/api/auth/signin"
            className="smk-button-primary inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-semibold sm:w-auto"
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
      loadCheckoutUser(session.user.id),
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
  const loyaltyPointsPerEuro = getLoyaltyPointsPerEuro();
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
    <PageLayout commerce>
      <div className="smk-storefront-legacy smk-account-scope mx-auto max-w-5xl px-6 py-8 text-[var(--smk-text)]">
        {/* User hero card */}
        <div className="mb-7 overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="h-2 w-full bg-[linear-gradient(90deg,#f1c684_0%,#e9bc74_45%,#d97745_100%)]" />
          <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
            <div
              className="flex shrink-0 items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] text-xl font-bold text-[var(--smk-accent-2)] ring-4 ring-[rgba(233,188,116,0.12)]"
              style={{ height: 54, width: 54 }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[var(--smk-text)]">
                {displayName}
              </p>
              <p className="truncate text-sm text-[var(--smk-text-muted)]">
                {session.user.email}
              </p>
            </div>
            {session.user.role === "ADMIN" && (
              <span className="shrink-0 rounded-full border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.12)] px-3 py-1 text-xs font-semibold text-[var(--smk-accent-2)]">
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
            shippingAddressType: user?.shippingAddressType ?? "STREET",
            packstationNumber: user?.packstationNumber ?? "",
            postNumber: user?.postNumber ?? "",
          }}
          wishlistCount={wishlistCount}
          wishlistPreview={wishlistPreview}
          setups={setupItems}
          orders={orderItems}
        />

        <div className="mt-6 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:p-5">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-[var(--smk-text-dim)]">
            SMOKEIFY PUNKTE
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--smk-text-muted)]">
              Aktueller Stand
            </p>
            <p className="text-2xl font-bold text-[var(--smk-accent-2)]">
              {loyaltyPointsBalance}
            </p>
          </div>
          <p className="mt-1 text-xs text-[var(--smk-text-muted)]">
            Smokeify Punkte sind dein Shop-Guthaben für spätere Bestellungen.
          </p>
          <p className="mt-1 text-xs text-[var(--smk-text-muted)]">
            Du erhältst standardmäßig {loyaltyPointsPerEuro} Smokeify Punkt{loyaltyPointsPerEuro === 1 ? "" : "e"} pro 1,00 EUR Warenwert. Beim Einlösen wird dein Warenkorb direkt günstiger: {formatRedeemRateLabel()}.
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
                  className="flex items-center justify-between rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--smk-text-muted)]">
                    {entry.reason === "order_paid"
                      ? "Bestellung bezahlt"
                      : entry.reason.startsWith("loyalty_hold:")
                        ? "Smokeify Punkte reserviert"
                        : entry.reason.startsWith("loyalty_redeemed:")
                          ? "Smokeify Punkte eingelöst"
                          : entry.reason.startsWith("loyalty_released:")
                            ? "Smokeify Punkte freigegeben"
                            : entry.reason}{" "}
                    · {new Date(entry.createdAt).toLocaleDateString("de-DE")}
                  </span>
                  <span
                    className={`font-semibold ${entry.pointsDelta >= 0 ? "text-[#9fe3b2]" : "text-[#f4c87c]"}`}
                  >
                    {entry.pointsDelta > 0 ? "+" : ""}
                    {entry.pointsDelta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Konto-Aktionen */}
        <div className="mt-6 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:p-5">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-[var(--smk-text-dim)]">
            KONTO-AKTIONEN
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />
            <DeleteAccountButton />
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="smk-button-secondary inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold sm:h-12 sm:w-auto sm:text-base"
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
