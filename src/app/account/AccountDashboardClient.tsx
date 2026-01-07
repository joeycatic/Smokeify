"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AccountSettingsClient from "./AccountSettingsClient";

type SetupItem = {
  id: string;
  name: string;
  createdAt: string;
};

type Profile = {
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

type Props = {
  profile: Profile;
  setups: SetupItem[];
  wishlistCount: number;
};

type TabId = "profile" | "orders" | "wishlist" | "setups";

export default function AccountDashboardClient({
  profile,
  setups,
  wishlistCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const tabs = useMemo(
    () => [
      { id: "profile", label: "Account aktualisieren" },
      { id: "orders", label: "Bestellungen" },
      { id: "wishlist", label: "Wunschliste" },
      { id: "setups", label: "Gespeicherte Konfigurationen" },
    ],
    []
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border border-black/10 bg-white p-4">
        <nav className="space-y-2 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`w-full rounded-md px-3 py-2 text-left font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#E4C56C] text-[#2f3e36]"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="space-y-6">
        {activeTab === "profile" && (
          <AccountSettingsClient
            initialName={profile.name}
            initialEmail={profile.email}
            initialFirstName={profile.firstName}
            initialLastName={profile.lastName}
            initialStreet={profile.street}
            initialHouseNumber={profile.houseNumber}
            initialPostalCode={profile.postalCode}
            initialCity={profile.city}
            initialCountry={profile.country}
          />
        )}

        {activeTab === "orders" && (
          <section className="rounded-xl border border-black/10 bg-white p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              ORDER HISTORY
            </h2>
            <p className="text-sm text-stone-600">
              Shopify-Anbindung folgt. Sobald verknuepft, erscheinen hier die
              Bestellungen.
            </p>
          </section>
        )}

        {activeTab === "wishlist" && (
          <section className="rounded-xl border border-black/10 bg-white p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              WISHLIST
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-sm">
              <span>Artikel</span>
              <span className="font-semibold">{wishlistCount}</span>
            </div>
            <Link
              href="/wishlist"
              className="mt-4 inline-flex rounded-md border border-black/10 px-4 py-2 text-xs font-semibold text-stone-700 hover:border-black/20"
            >
              Zur Wunschliste
            </Link>
          </section>
        )}

        {activeTab === "setups" && (
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
        )}
      </div>
    </div>
  );
}
