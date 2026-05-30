"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  HeartIcon,
  ShoppingBagIcon,
  TrashIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import type { Product } from "@/data/types";
import AccountSettingsClient from "./AccountSettingsClient";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import SignOutButton from "@/components/SignOutButton";
import { useCart } from "@/components/CartProvider";
import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";

type SetupItem = {
  id: string;
  name: string;
  createdAt: string;
  data?: {
    sizeId?: string;
    lightId?: string[] | string;
    ventId?: string[] | string;
    extras?: string[] | string;
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
  shippingAddressType: string;
  packstationNumber: string;
  postNumber: string;
};

type OrderSummary = {
  id: string;
  createdAt: string;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: string;
  itemsCount: number;
};

type LoyaltyTransaction = {
  id: string;
  pointsDelta: number;
  reason: string;
  createdAt: string;
};

type Props = {
  profile: Profile;
  setups: SetupItem[];
  wishlistCount: number;
  wishlistPreview: Product[];
  orders: OrderSummary[];
  isAdmin: boolean;
  loyaltyPointsBalance: number;
  loyaltyPointsPerEuro: number;
  loyaltyRedeemRateLabel: string;
  loyaltyTransactions: LoyaltyTransaction[];
};

type TabId = "profile" | "orders" | "wishlist" | "setups";

const tabs = [
  {
    id: "profile" as const,
    label: "Profil",
    icon: UserCircleIcon,
  },
  {
    id: "orders" as const,
    label: "Bestellungen",
    icon: ShoppingBagIcon,
  },
  {
    id: "wishlist" as const,
    label: "Wunschliste",
    icon: HeartIcon,
  },
  {
    id: "setups" as const,
    label: "Setups",
    icon: AdjustmentsHorizontalIcon,
  },
];

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

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

const statusTone = (value: string) => {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("paid") ||
    normalized.includes("fulfilled") ||
    normalized.includes("complete") ||
    normalized.includes("delivered")
  ) {
    return "border-[rgba(127,207,150,0.28)] bg-[rgba(22,52,39,0.82)] text-[#9fe3b2]";
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("open") ||
    normalized.includes("processing")
  ) {
    return "border-[rgba(240,180,93,0.26)] bg-[rgba(66,46,16,0.82)] text-[#f4c87c]";
  }
  return "border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] text-[var(--smk-text-muted)]";
};

const countSavedSetupValues = (value?: string[] | string) => {
  if (!value) return 0;
  if (Array.isArray(value)) return value.filter(Boolean).length;
  return value ? 1 : 0;
};

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

const formatLoyaltyReason = (reason: string) => {
  if (reason === "order_paid") return "Bestellung bezahlt";
  if (reason.startsWith("loyalty_hold:")) return "Smokeify Punkte reserviert";
  if (reason.startsWith("loyalty_redeemed:")) return "Smokeify Punkte eingelöst";
  if (reason.startsWith("loyalty_released:")) return "Smokeify Punkte freigegeben";
  return reason;
};

export default function AccountDashboardClient({
  profile,
  setups,
  wishlistCount,
  wishlistPreview,
  orders,
  isAdmin,
  loyaltyPointsBalance,
  loyaltyPointsPerEuro,
  loyaltyRedeemRateLabel,
  loyaltyTransactions,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [setupItems, setSetupItems] = useState(setups);
  const [setupBusyId, setSetupBusyId] = useState<string | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [reorderBusyId, setReorderBusyId] = useState<string | null>(null);
  const [reorderMessage, setReorderMessage] = useState<string | null>(null);
  const { addManyToCart } = useCart();

  const counts: Record<TabId, number | null> = {
    profile: null,
    orders: orders.length,
    wishlist: wishlistCount,
    setups: setupItems.length,
  };

  const displayName =
    profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.name || profile.email || "dein Konto";

  return (
    <div className="space-y-5">
      <section className="smk-panel relative overflow-hidden rounded-[34px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="absolute left-0 top-0 h-40 w-40 -translate-x-10 -translate-y-12 rounded-full bg-[rgba(233,188,116,0.14)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-10 translate-y-12 rounded-full bg-[rgba(121,92,60,0.16)] blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="smk-chip">Account</span>
            <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.06em] text-[var(--smk-text)] sm:text-4xl">
              Hallo, {displayName}
            </h1>
            {profile.email ? (
              <p className="mt-2 text-sm text-[var(--smk-text-muted)] [overflow-wrap:anywhere]">
                {profile.email}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-end">
            <Link
              href={PLANT_ANALYZER_PATH}
              className="smk-button-secondary inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold sm:w-auto"
            >
              Analyzer Verlauf
            </Link>
            <SignOutButton />
            {isAdmin ? (
              <Link
                href="/admin"
                className="smk-button-secondary inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold sm:w-auto"
              >
                Admin Panel
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-xs text-[var(--smk-text-muted)]">Bestellungen</p>
            <p className="mt-1 text-xl font-semibold text-[var(--smk-text)]">{orders.length}</p>
          </div>
          <div className="rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-xs text-[var(--smk-text-muted)]">Wunschliste</p>
            <p className="mt-1 text-xl font-semibold text-[var(--smk-text)]">{wishlistCount}</p>
          </div>
          <div className="rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-xs text-[var(--smk-text-muted)]">Setups</p>
            <p className="mt-1 text-xl font-semibold text-[var(--smk-text)]">{setupItems.length}</p>
          </div>
          <div className="rounded-[20px] border border-[rgba(233,188,116,0.22)] bg-[rgba(233,188,116,0.1)] px-4 py-3">
            <p className="text-xs text-[var(--smk-text-muted)]">Punkte</p>
            <p className="mt-1 text-xl font-semibold text-[var(--smk-accent-2)]">
              {loyaltyPointsBalance}
            </p>
          </div>
        </div>

        <p className="relative mt-4 text-sm leading-6 text-[var(--smk-text-muted)]">
          {loyaltyPointsPerEuro} Smokeify Punkt
          {loyaltyPointsPerEuro === 1 ? "" : "e"} pro 1,00 EUR. Einlösen:
          {" "}
          {loyaltyRedeemRateLabel}.
        </p>

        <div className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition sm:px-4 ${
                activeTab === tab.id
                  ? "border-[rgba(233,188,116,0.38)] bg-[linear-gradient(135deg,#f1c684_0%,#d97745_100%)] text-[#1c1510]"
                  : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-[var(--smk-text)] hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)]"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {counts[tab.id] ? (
                <span className="text-xs opacity-75">{counts[tab.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "profile" ? (
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
          initialShippingAddressType={profile.shippingAddressType}
          initialPackstationNumber={profile.packstationNumber}
          initialPostNumber={profile.postNumber}
        />
      ) : null}

      {activeTab === "orders" ? (
        <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
          {orders.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-5 py-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-dim)]">
                <ShoppingBagIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-lg font-semibold text-[var(--smk-text)]">
                Noch keine Bestellungen
              </p>
              <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
                Sobald du bestellst, erscheint deine Historie hier.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reorderMessage ? (
                <p className="rounded-[18px] border border-[rgba(233,188,116,0.18)] bg-[rgba(233,188,116,0.1)] px-4 py-3 text-sm text-[var(--smk-text)]">
                  {reorderMessage}
                </p>
              ) : null}
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-[28px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_right,rgba(233,188,116,0.12),transparent_34%),linear-gradient(180deg,rgba(27,23,20,0.98),rgba(15,14,13,0.98))] px-5 py-5 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:shadow-[0_24px_54px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-accent)]">
                        Bestellung {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <h4 className="mt-2 text-xl font-semibold text-[var(--smk-text)]">
                        {formatPrice(order.amountTotal, order.currency)}
                      </h4>
                      <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
                        {new Date(order.createdAt).toLocaleDateString("de-DE")} · {order.itemsCount} Artikel
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="smk-button-secondary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto"
                    >
                      Details ansehen
                    </Link>
                    <button
                      type="button"
                      disabled={reorderBusyId === order.id}
                      onClick={async () => {
                        setReorderBusyId(order.id);
                        setReorderMessage(null);
                        try {
                          const res = await fetch(`/api/account/orders/${order.id}/reorder`, {
                            method: "POST",
                          });
                          const data = (await res.json().catch(() => ({}))) as {
                            items?: Array<{
                              variantId: string;
                              quantity: number;
                              options?: Array<{ name: string; value: string }>;
                            }>;
                            error?: string;
                            addedCount?: number;
                            skippedCount?: number;
                          };
                          if (!res.ok) {
                            setReorderMessage(data.error ?? "Erneut bestellen fehlgeschlagen.");
                            return;
                          }
                          const items = data.items ?? [];
                          if (items.length === 0) {
                            setReorderMessage("Keine verfügbaren Artikel aus dieser Bestellung gefunden.");
                            return;
                          }
                          await addManyToCart(items);
                          setReorderMessage(
                            data.skippedCount && data.skippedCount > 0
                              ? `${data.addedCount ?? items.length} Artikel erneut zum Warenkorb hinzugefügt, ${data.skippedCount} nicht verfügbar.`
                              : `${data.addedCount ?? items.length} Artikel erneut zum Warenkorb hinzugefügt.`,
                          );
                        } catch {
                          setReorderMessage("Erneut bestellen fehlgeschlagen.");
                        } finally {
                          setReorderBusyId(null);
                        }
                      }}
                      className="smk-button-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 sm:w-auto"
                    >
                      {reorderBusyId === order.id ? (
                        <>
                          <LoadingSpinner
                            size="sm"
                            className="border-[#1c1510]/30 border-t-[#1c1510]"
                          />
                          Wird hinzugefügt...
                        </>
                      ) : (
                        <>
                          <ArrowPathIcon className="h-4 w-4" />
                          Erneut bestellen
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "wishlist" ? (
        <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-lg font-semibold text-[var(--smk-text)]">
              {wishlistCount === 0
                ? "Noch keine Wunschlistenartikel"
                : `${wishlistCount} Produkte gespeichert`}
            </p>
            <Link
              href="/wishlist"
              className="smk-button-secondary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto"
            >
              Ganze Wunschliste
            </Link>
          </div>
          {wishlistPreview.length === 0 ? (
            <div className="mt-6 rounded-[26px] border border-dashed border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-5 py-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-dim)]">
                <HeartIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-lg font-semibold text-[var(--smk-text)]">
                Noch nichts gespeichert
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {wishlistPreview.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.handle}`}
                  className="group smk-surface overflow-hidden rounded-[26px] p-3 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <div className="smk-white-well relative h-44 overflow-hidden rounded-[22px] border">
                    {item.featuredImage?.url ? (
                      <Image
                        src={item.featuredImage.url}
                        alt={item.featuredImage.altText ?? item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                        Kein Bild
                      </div>
                    )}
                  </div>
                  <div className="px-2 pb-2 pt-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-accent)]">
                      Wunschliste
                    </p>
                    <h4 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--smk-text)]">
                      {item.title}
                    </h4>
                    <p className="mt-3 text-sm text-[var(--smk-text-muted)]">
                      {formatProductPrice(item.priceRange?.minVariantPrice) ?? "Preis auf Anfrage"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "setups" ? (
        <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-lg font-semibold text-[var(--smk-text)]">
              {setupItems.length === 0
                ? "Keine Konfigurationen gespeichert"
                : `${setupItems.length} Konfigurationen gespeichert`}
            </p>
            <Link
              href="/customizer"
              className="smk-button-primary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto"
            >
              Zum Customizer
            </Link>
          </div>
          {setupItems.length === 0 ? (
            <div className="mt-6 rounded-[26px] border border-dashed border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-5 py-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-dim)]">
                <AdjustmentsHorizontalIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-lg font-semibold text-[var(--smk-text)]">
                Speichere dein erstes Setup
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {setupItems.map((setup) => {
                const lightCount = countSavedSetupValues(setup.data?.lightId);
                const ventCount = countSavedSetupValues(setup.data?.ventId);
                const extrasCount = countSavedSetupValues(setup.data?.extras);
                return (
                  <article
                    key={setup.id}
                    className="relative overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_right,rgba(233,188,116,0.14),transparent_34%),linear-gradient(180deg,rgba(27,23,20,0.98),rgba(15,14,13,0.98))] px-5 py-5 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)]"
                  >
                    <div className="absolute right-0 top-0 h-28 w-28 -translate-y-8 translate-x-8 rounded-full bg-[rgba(233,188,116,0.18)] blur-3xl" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-accent)]">
                          Setup
                        </p>
                        <h4 className="mt-2 break-words text-xl font-semibold text-[var(--smk-text)]">
                          {setup.name}
                        </h4>
                        <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
                          Gespeichert am {new Date(setup.createdAt).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setSetupBusyId(setup.id);
                          setSetupMessage(null);
                          try {
                            const res = await fetch(`/api/setups/${setup.id}`, {
                              method: "DELETE",
                            });
                            if (!res.ok) {
                              setSetupMessage("Löschen fehlgeschlagen.");
                              return;
                            }
                            setSetupItems((prev) => prev.filter((item) => item.id !== setup.id));
                            setSetupMessage("Setup gelöscht.");
                          } finally {
                            setSetupBusyId(null);
                          }
                        }}
                        disabled={setupBusyId === setup.id}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[rgba(239,143,127,0.28)] bg-[rgba(62,26,24,0.82)] text-[#ef8f7f] transition hover:-translate-y-0.5 hover:bg-[rgba(76,32,29,0.9)] disabled:opacity-60"
                        aria-label="Setup löschen"
                      >
                        {setupBusyId === setup.id ? (
                          <LoadingSpinner
                            size="sm"
                            className="border-red-200/30 border-t-red-100"
                          />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {setup.data?.sizeId ? (
                        <span className="rounded-full border border-[rgba(233,188,116,0.2)] bg-[rgba(233,188,116,0.1)] px-3 py-1 text-xs font-semibold text-[var(--smk-accent-2)]">
                          Zelt gesetzt
                        </span>
                      ) : null}
                      <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                        Licht: {lightCount}
                      </span>
                      <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                        Abluft: {ventCount}
                      </span>
                      <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-semibold text-[var(--smk-text-muted)]">
                        Extras: {extrasCount}
                      </span>
                    </div>
                    <div className="relative mt-5 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={buildSetupHref(setup)}
                        className="smk-button-primary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto"
                      >
                        Setup öffnen
                      </Link>
                      <Link
                        href="/customizer"
                        className="smk-button-secondary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto"
                      >
                        Neu konfigurieren
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {setupMessage ? (
            <p className="mt-4 rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--smk-text-muted)]">
              {setupMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              Smokeify Punkte
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--smk-text)]">
              Guthaben und Verlauf
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--smk-text-muted)]">
              Dein aktueller Stand liegt bei {loyaltyPointsBalance} Punkten.
              Punkte reduzieren beim Einlösen direkt deinen Warenkorbwert.
            </p>
          </div>
          <div className="rounded-[20px] border border-[rgba(233,188,116,0.22)] bg-[rgba(233,188,116,0.1)] px-4 py-3 text-right">
            <p className="text-xs text-[var(--smk-text-muted)]">Aktueller Stand</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--smk-accent-2)]">
              {loyaltyPointsBalance}
            </p>
          </div>
        </div>
        {loyaltyTransactions.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {loyaltyTransactions.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3 py-3 text-sm"
              >
                <span className="text-[var(--smk-text-muted)]">
                  {formatLoyaltyReason(entry.reason)} · {new Date(entry.createdAt).toLocaleDateString("de-DE")}
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
        ) : null}
      </section>

      <section className="smk-panel rounded-[30px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
              Gefahrzone
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--smk-text)]">
              Account löschen
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--smk-text-muted)]">
              Dieser Schritt entfernt dein Konto dauerhaft und fragt vorher noch
              einmal nach deiner Bestätigung.
            </p>
          </div>
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}
