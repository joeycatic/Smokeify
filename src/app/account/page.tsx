import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import SignOutButton from "@/components/SignOutButton";

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

  const [setups, wishlistCount] = await Promise.all([
    prisma.savedSetup.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.wishlistItem.count({
      where: { userId: session.user.id },
    }),
  ]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
            Account
          </h1>
          <p className="text-sm text-stone-600">
            Eingeloggt als {session.user.email ?? "User"}
            {session.user.role === "ADMIN" ? ` · Rolle: ${session.user.role}` : ""}
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-black/10 bg-white p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              SAVED SETUPS
            </h2>
            {setups.length === 0 ? (
              <p className="text-sm text-stone-600">
                Noch keine gespeicherten Setups.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {setups.map((setup) => (
                  <li
                    key={setup.id}
                    className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2"
                  >
                    <div className="font-semibold">{setup.name}</div>
                    <div className="text-xs text-stone-500">
                      {new Date(setup.createdAt).toLocaleDateString("de-DE")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              WISHLIST & ORDERS
            </h2>
            <div className="space-y-4 text-sm text-stone-700">
              <div className="flex items-center justify-between rounded-lg border border-black/10 bg-stone-50 px-3 py-2">
                <span>Wunschliste</span>
                <span className="font-semibold">{wishlistCount}</span>
              </div>
              <div className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2">
                <p className="font-semibold">Order history</p>
                <p className="text-xs text-stone-500">
                  Shopify-Anbindung folgt. Sobald verknuepft, erscheinen hier die
                  Bestellungen.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
