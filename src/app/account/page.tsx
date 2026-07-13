import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductsByIds } from "@/lib/catalog";
import PageLayout from "@/components/PageLayout";
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
        <div className="mx-auto max-w-5xl py-10 sm:py-14">
          <section className="smk-panel relative overflow-hidden rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
            <div className="absolute left-0 top-0 h-40 w-40 -translate-x-10 -translate-y-12 rounded-full bg-[rgba(233,188,116,0.14)] blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-10 translate-y-12 rounded-full bg-[rgba(121,92,60,0.16)] blur-3xl" />
            <div className="relative max-w-3xl">
              <span className="smk-chip">Account</span>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.07em] text-[var(--smk-text)] sm:text-5xl">
                Dein Smokeify Hub für Bestellungen, Merkliste und Setups.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                Melde dich an, um Bestellungen zu verfolgen, gespeicherte
                Konfigurationen wieder zu öffnen und deine Account-Daten zentral
                zu verwalten.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/api/auth/signin"
                  className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold"
                >
                  Jetzt einloggen
                </Link>
                <Link
                  href="/products"
                  className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold"
                >
                  Produkte entdecken
                </Link>
              </div>
            </div>
          </section>
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

  const wishlistPreview = await getProductsByIds(
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

  return (
    <PageLayout commerce>
      <div className="mx-auto max-w-6xl py-6 sm:py-8 lg:py-10">
        <AccountDashboardClient
          profile={{
            name: user?.name ?? "",
            email: user?.email ?? session.user.email ?? "",
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
          isAdmin={session.user.role === "ADMIN"}
          loyaltyPointsBalance={loyaltyPointsBalance}
          loyaltyPointsPerEuro={loyaltyPointsPerEuro}
          loyaltyRedeemRateLabel={formatRedeemRateLabel()}
          loyaltyTransactions={loyaltyTransactions.map((entry) => ({
            id: entry.id,
            pointsDelta: entry.pointsDelta,
            reason: entry.reason,
            createdAt: entry.createdAt.toISOString(),
          }))}
        />
      </div>
    </PageLayout>
  );
}
