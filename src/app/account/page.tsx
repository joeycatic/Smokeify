import Link from "next/link";
import { getServerSession } from "next-auth";
import type { SavedSetup } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import SignOutButton from "@/components/SignOutButton";
import AccountDashboardClient from "./AccountDashboardClient";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-4xl px-6 py-12 text-stone-800">
          <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-stone-600 mb-6">
            Melde dich an, um Setups zu speichern, Wunschlisten zu verwalten und
            Bestellungen einzusehen.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </PageLayout>
    );
  }

  const [setups, wishlistCount, user] = await Promise.all([
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
        address: true,
      },
    }),
  ]);
  const typedSetups = setups as SavedSetup[];
  const setupItems = typedSetups.map((setup) => ({
    id: setup.id,
    name: setup.name ?? "Saved setup",
    createdAt: setup.createdAt.toISOString(),
  }));

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-sm text-stone-600">
            Eingeloggt als {session.user.email ?? "User"}
            {session.user.role === "ADMIN" ? ` - Rolle: ${session.user.role}` : ""}
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>

        <AccountDashboardClient
          profile={{
            name: user?.name ?? "",
            email: user?.email ?? "",
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
            address: user?.address ?? "",
          }}
          wishlistCount={wishlistCount}
          setups={setupItems}
        />
      </div>
    </PageLayout>
  );
}
