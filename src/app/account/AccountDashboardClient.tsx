"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdjustmentsHorizontalIcon,
  HeartIcon,
  UserCircleIcon,
  ShoppingBagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { Product } from "@/data/types";
import AccountSettingsClient from "./AccountSettingsClient";

type SetupItem = {
  id: string;
  name: string;
  createdAt: string;
  data?: {
    sizeId?: string;
    lightId?: string[];
    ventId?: string[];
    extras?: string[];
  };
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
  const [setupItems, setSetupItems] = useState(setups);
  const [setupBusyId, setSetupBusyId] = useState<string | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

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
    [],
  );

  const tabMeta: Record<TabId, number | null> = useMemo(
    () => ({
      profile: null,
      orders: orders.length,
      wishlist: wishlistCount,
      setups: setupItems.length,
    }),
    [orders.length, wishlistCount, setupItems.length],
  );

  const normalizeIdList = (value?: string[] | string) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value].filter(Boolean);
  };

  const buildSetupHref = (setup: SetupItem) => {
    const data = setup.data ?? {};
    const params = new URLSearchParams();
    if (data.sizeId) params.set("sizeId", data.sizeId);
    const lightIds = normalizeIdList(data.lightId);
    if (lightIds.length > 0) params.set("lightId", lightIds.join(","));
    const ventIds = normalizeIdList(data.ventId);
    if (ventIds.length > 0) params.set("ventId", ventIds.join(","));
    const extrasIds = normalizeIdList(data.extras);
    if (extrasIds.length > 0) params.set("extras", extrasIds.join(","));
    const query = params.toString();
    return query ? `/customizer?${query}` : "/customizer";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start lg:min-h-[calc(100vh-445px)]">
      {/* Sidebar */}
      <aside className="rounded-xl border border-transparent bg-transparent p-0 lg:h-full lg:border-black/10 lg:bg-white lg:overflow-hidden">
        {/* Mobile dropdown */}
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
                <span className="text-xs text-stone-400">
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
                    {tabs.map((tab) => {
                      const badge = tabMeta[tab.id as TabId];
                      return (
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
                              : "text-stone-700 hover:bg-stone-50"
                          }`}
                          role="option"
                          aria-selected={activeTab === tab.id}
                        >
                          <span
                            className={`rounded-full p-1 ${
                              activeTab === tab.id
                                ? "bg-white/20 text-white"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            <tab.icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="flex-1">{tab.label}</span>
                          {badge !== null && badge > 0 && (
                            <span
                              className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-4 ${
                                activeTab === tab.id
                                  ? "bg-white/20 text-white"
                                  : "bg-stone-200 text-stone-500"
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop sidebar nav */}
        <div className="hidden lg:block sm:block">
          {/* Sidebar accent bar */}
          <div className="h-1 bg-gradient-to-r from-[#2f3e36] to-[#44584c] lg:block hidden" />
          <nav className="lg:p-3 sm:p-0 space-y-1">
            {tabs.map((tab) => {
              const badge = tabMeta[tab.id as TabId];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-[#E4C56C] text-[#2f3e36] shadow-sm"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-800"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{tab.label}</span>
                  {badge !== null && badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-4 ${
                        activeTab === tab.id
                          ? "bg-[#2f3e36]/15 text-[#2f3e36]"
                          : "bg-stone-200 text-stone-500"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content panels */}
      <div className="space-y-6 lg:pr-1">
        {/* Profile */}
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

        {/* Orders */}
        {activeTab === "orders" && (
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6 lg:flex lg:h-full lg:flex-col">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-widest text-black/70">
                BESTELLUNGEN
              </h2>
              {orders.length > 0 && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                  {orders.length}
                </span>
              )}
            </div>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                  <ShoppingBagIcon className="h-7 w-7 text-stone-400" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-stone-600">
                  Noch keine Bestellungen
                </p>
                <p className="mt-1 max-w-xs text-xs text-stone-400">
                  Sobald du bestellst, erscheinen deine Bestellungen hier.
                </p>
              </div>
            ) : (
              <div className="pretty-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                <ul className="space-y-3 text-sm">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/account/orders/${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-emerald-800/60 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 px-3 py-3 shadow-sm transition hover:border-emerald-700 hover:from-emerald-700/95 hover:via-emerald-800/95 hover:to-emerald-950/95 sm:px-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">
                              Bestellung {order.id.slice(0, 8).toUpperCase()}
                            </div>
                            <div className="text-xs text-white/60">
                              {new Date(order.createdAt).toLocaleDateString("de-DE")}
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-sm font-semibold text-white">
                              {formatPrice(order.amountTotal, order.currency)}
                            </div>
                            <div className="text-xs text-white/60">
                              {order.itemsCount} Artikel
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2 py-1 text-emerald-800">
                            Status: {order.status}
                          </span>
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                            Zahlung: {order.paymentStatus}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Wishlist */}
        {activeTab === "wishlist" && (
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-widest text-black/70">
                WUNSCHLISTE
              </h2>
              {wishlistCount > 0 && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                  {wishlistCount} Artikel
                </span>
              )}
            </div>
            {wishlistPreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                  <HeartIcon className="h-7 w-7 text-stone-400" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-stone-600">
                  Noch keine Artikel
                </p>
                <p className="mt-1 max-w-xs text-xs text-stone-400">
                  Füge Produkte zu deiner Wunschliste hinzu.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {wishlistPreview.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/products/${item.handle}`}
                      className="flex items-center gap-3 rounded-xl border border-black/8 bg-stone-50/50 p-2.5 text-sm transition hover:border-black/15 hover:bg-white hover:shadow-sm"
                    >
                      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-stone-100">
                        {item.featuredImage?.url ? (
                          <Image
                            src={item.featuredImage.url}
                            alt={item.featuredImage.altText ?? item.title}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                            --
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-stone-800">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">
                          {formatProductPrice(item.priceRange?.minVariantPrice)}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-stone-400">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/wishlist"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-black/10 px-4 py-2.5 text-xs font-semibold text-stone-700 transition hover:border-black/20 hover:bg-stone-50 sm:w-auto"
            >
              Zur Wunschliste →
            </Link>
          </section>
        )}

        {/* Setups */}
        {activeTab === "setups" && (
          <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-widest text-black/70">
                GESPEICHERTE KONFIGURATIONEN
              </h2>
              {setupItems.length > 0 && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                  {setupItems.length}
                </span>
              )}
            </div>
            {setupItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                  <AdjustmentsHorizontalIcon className="h-7 w-7 text-stone-400" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-stone-600">
                  Noch keine Setups
                </p>
                <p className="mt-1 max-w-xs text-xs text-stone-400">
                  Speichere dein erstes Setup im Customizer.
                </p>
                <Link
                  href="/customizer"
                  className="mt-4 inline-flex items-center rounded-lg border border-black/10 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:border-black/20 hover:bg-stone-50"
                >
                  Zum Customizer →
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4">
                {setupItems.map((setup) => {
                  const lightCount = setup.data?.lightId?.length ?? 0;
                  const ventCount = setup.data?.ventId?.length ?? 0;
                  const extrasCount = setup.data?.extras?.length ?? 0;
                  return (
                    <li
                      key={setup.id}
                      className="group relative overflow-hidden rounded-xl border border-emerald-800/60 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-4 text-white shadow-md transition hover:border-emerald-700 hover:shadow-lg"
                    >
                      <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full bg-emerald-400/20 blur-2xl" />
                      <div className="relative flex items-start justify-between gap-3">
                        <Link
                          href={buildSetupHref(setup)}
                          className="min-w-0 flex-1 rounded-lg px-2 py-1 transition hover:bg-white/10"
                        >
                          <div className="truncate text-sm font-semibold text-white">
                            {setup.name}
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            Gespeichert am{" "}
                            {new Date(setup.createdAt).toLocaleDateString("de-DE")}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            setSetupBusyId(setup.id);
                            setSetupMessage(null);
                            try {
                              const res = await fetch(
                                `/api/setups/${setup.id}`,
                                { method: "DELETE" },
                              );
                              if (!res.ok) {
                                setSetupMessage("Löschen fehlgeschlagen.");
                                return;
                              }
                              setSetupItems((prev) =>
                                prev.filter((item) => item.id !== setup.id),
                              );
                              setSetupMessage("Setup gelöscht.");
                            } finally {
                              setSetupBusyId(null);
                            }
                          }}
                          disabled={setupBusyId === setup.id}
                          className="shrink-0 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-60"
                          aria-label="Setup löschen"
                          title="Setup löschen"
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="relative mt-3 flex flex-wrap gap-2 text-[11px]">
                        {setup.data?.sizeId && (
                          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-white/90">
                            Zelt gewählt
                          </span>
                        )}
                        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-white/80">
                          Licht: {lightCount}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-white/80">
                          Abluft: {ventCount}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-white/80">
                          Extras: {extrasCount}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {setupMessage && (
              <p className="mt-3 text-xs text-stone-600">{setupMessage}</p>
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
