"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdjustmentsHorizontalIcon,
  HeartIcon,
  UserCircleIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import type { Product } from "@/data/types";
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
  wishlistPreview: Product[];
  orders: OrderSummary[];
};

type TabId = "profile" | "orders" | "wishlist" | "setups";

type OrderSummary = {
  id: string;
  createdAt: string;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: string;
  itemsCount: number;
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export default function AccountDashboardClient({
  profile,
  setups,
  wishlistCount,
  wishlistPreview,
  orders,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tabs = useMemo(
    () => [
      {
        id: "profile",
        label: "Account aktualisieren",
        icon: UserCircleIcon,
      },
      { id: "orders", label: "Bestellungen", icon: ShoppingBagIcon },
      { id: "wishlist", label: "Wunschliste", icon: HeartIcon },
      {
        id: "setups",
        label: "Gespeicherte Konfigurationen",
        icon: AdjustmentsHorizontalIcon,
      },
    ],
    []
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border border-transparent bg-transparent p-0 lg:border-black/10 lg:bg-white lg:p-4">
        <div className="sm:hidden">
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold tracking-widest text-stone-500">
              Bereich
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-stone-800 shadow-sm"
                aria-haspopup="listbox"
                aria-expanded={mobileMenuOpen}
              >
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[#2f3e36] p-1 text-white">
                    {(() => {
                      const current = tabs.find((tab) => tab.id === activeTab);
                      const Icon = current?.icon ?? UserCircleIcon;
                      return <Icon className="h-4 w-4" aria-hidden="true" />;
                    })()}
                  </span>
                  <span>{tabs.find((tab) => tab.id === activeTab)?.label}</span>
                </span>
                <span className="text-xs text-stone-500">
                  {mobileMenuOpen ? "▲" : "▼"}
                </span>
              </button>
              {mobileMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setMobileMenuOpen(false)}
                    className="fixed inset-0 z-30 bg-transparent"
                  />
                  <div
                    className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-black/10 bg-white text-sm shadow-xl"
                    role="listbox"
                  >
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id as TabId);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left font-semibold transition ${
                          activeTab === tab.id
                            ? "bg-[#2f3e36] text-white"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                        role="option"
                        aria-selected={activeTab === tab.id}
                      >
                        <span
                          className={`rounded-full p-1 ${
                            activeTab === tab.id
                              ? "bg-white text-[#2f3e36]"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          <tab.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <nav className="hidden text-sm lg:block lg:space-y-2 sm:block">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#E4C56C] text-[#2f3e36]"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
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
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              BESTELLUNGEN
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-stone-600">
                Noch keine Bestellungen vorhanden.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/account/orders/${order.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-black/10 bg-gradient-to-br from-white via-emerald-50 to-amber-50 px-3 py-3 shadow-sm transition hover:border-black/20 hover:bg-white sm:px-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            Bestellung {order.id.slice(0, 8).toUpperCase()}
                          </div>
                          <div className="text-xs text-stone-500">
                            {new Date(order.createdAt).toLocaleDateString(
                              "de-DE"
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-semibold text-emerald-900">
                            {formatPrice(order.amountTotal, order.currency)}
                          </div>
                          <div className="text-xs text-stone-500">
                            {order.itemsCount} Artikel
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                        <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-emerald-800">
                          Status: {order.status}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                          Zahlung: {order.paymentStatus}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "wishlist" && (
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              WISHLIST
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-sm">
              <span>Artikel</span>
              <span className="font-semibold">{wishlistCount}</span>
            </div>
            {wishlistPreview.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">
                Noch keine Artikel auf der Wunschliste.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {wishlistPreview.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/products/${item.handle}`}
                      className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-2 text-sm transition hover:border-black/20"
                    >
                      <div className="relative h-12 w-12 flex-none overflow-hidden rounded-md bg-stone-100">
                        {item.featuredImage?.url ? (
                          <Image
                            src={item.featuredImage.url}
                            alt={item.featuredImage.altText ?? item.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                            --
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                          {item.title}
                        </div>
                        <div className="text-xs text-stone-500">
                          {formatProductPrice(item.priceRange?.minVariantPrice)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/wishlist"
              className="mt-4 inline-flex w-full justify-center rounded-md border border-black/10 px-4 py-2 text-xs font-semibold text-stone-700 hover:border-black/20 sm:w-auto"
            >
              Zur Wunschliste
            </Link>
          </section>
        )}

        {activeTab === "setups" && (
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
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

const formatProductPrice = (price?: {
  amount: string;
  currencyCode: string;
}) => {
  if (!price) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
};
