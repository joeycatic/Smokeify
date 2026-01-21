"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bars3Icon,
  HeartIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { Pixelify_Sans } from "next/font/google";
import { useCart } from "./CartProvider";
import type { AddedItem } from "./CartProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Bitte verifiziere deine Email, bevor du dich einloggst.",
  RATE_LIMIT: "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
  NEW_DEVICE:
    "Neues Geraet erkannt. Code wurde per Email gesendet. Bitte bestaetigen.",
  CredentialsSignin: "Email oder Passwort ist falsch.",
  AccessDenied: "Zugriff verweigert. Bitte pruefe deine Berechtigung.",
};

const getLoginErrorMessage = (code?: string) => {
  if (!code) {
    return "Login fehlgeschlagen. Bitte pruefe deine Daten.";
  }
  return (
    LOGIN_ERROR_MESSAGES[code] ?? `Login fehlgeschlagen. Fehlercode: ${code}.`
  );
};

const pixelNavFont = Pixelify_Sans({
  weight: "400",
  subsets: ["latin"],
});

export function Navbar() {
  const { cart, loading, error, refresh } = useCart();
  const { ids } = useWishlist();
  const { status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAuthenticated = status === "authenticated";
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginStatus, setLoginStatus] = useState<"idle" | "ok" | "error">(
    "idle",
  );
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [logoutStatus, setLogoutStatus] = useState<"idle" | "ok">("idle");
  const accountRef = useRef<HTMLDivElement | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement | null>(null);
  const cartPanelRef = useRef<HTMLElement | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileAddedItem, setMobileAddedItem] = useState<AddedItem | null>(
    null,
  );
  const [mobileAddedOpen, setMobileAddedOpen] = useState(false);

  const count = loading ? 0 : (cart?.totalQuantity ?? 0);
  const wishlistCount = ids.length;
  const [cartPop, setCartPop] = useState(false);
  const [wishlistPop, setWishlistPop] = useState(false);
  const canCheckout =
    !loading && !!cart && cart.lines.length > 0 && checkoutStatus !== "loading";
  const returnTo = useMemo(() => {
    if (pathname?.startsWith("/auth")) return "/";
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);

  useEffect(() => {
    if (count === 0) return;
    setCartPop(true);
    const timer = setTimeout(() => setCartPop(false), 250);
    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (isAuthenticated) {
      setLogoutStatus("idle");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (logoutStatus !== "ok") return;
    const timer = setTimeout(() => setLogoutStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [logoutStatus]);

  useEffect(() => {
    if (loginStatus !== "ok") return;
    const timer = setTimeout(() => setLoginStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [loginStatus]);

  useEffect(() => {
    if (wishlistCount === 0) return;
    setWishlistPop(true);
    const timer = setTimeout(() => setWishlistPop(false), 250);
    return () => clearTimeout(timer);
  }, [wishlistCount]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!accountRef.current) return;
      if (!accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (!cartRef.current) return;
      const target = event.target as Node;
      const clickInsideToggle = cartRef.current.contains(target);
      const clickInsidePanel = cartPanelRef.current?.contains(target) ?? false;
      if (!clickInsideToggle && !clickInsidePanel) {
        setCartOpen(false);
      }
      const menuTarget = event.target as Node;
      const menuRoot = document.getElementById("mobile-nav-menu");
      if (menuOpen && menuRoot && !menuRoot.contains(menuTarget)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileAddedOpen(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleAdded = (event: Event) => {
      const detail = (event as CustomEvent<AddedItem>).detail;
      if (!detail) return;
      setMobileAddedItem(detail);
      setMobileAddedOpen(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMobileAddedOpen(false), 3500);
    };
    window.addEventListener("cart:item-added", handleAdded);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("cart:item-added", handleAdded);
    };
  }, [isMobile]);

  const startCheckout = async () => {
    if (!cart || cart.lines.length === 0) {
      router.push("/cart");
      return;
    }
    if (!isAuthenticated) {
      router.push(
        `/auth/checkout?returnTo=${encodeURIComponent("/cart?startCheckout=1")}`,
      );
      return;
    }
    setCheckoutStatus("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: "DE" }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        setCheckoutStatus("error");
        router.push("/cart");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setCheckoutStatus("error");
      router.push("/cart");
    }
  };
  const accountPanelContent = (
    <>
      <div className="mb-4 text-center">
        <p className="text-2xl font-bold" style={{ color: "#2f3e36" }}>
          Account
        </p>
        <p className="mt-1 text-xs text-black/60">
          {isAuthenticated
            ? "Verwalten Sie Ihr Profil oder loggen sich aus."
            : "Melde dich an oder erstelle ein Konto."}
        </p>
      </div>
      {!isAuthenticated && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setLoginStatus("idle");
            setLoginMessage(null);
            setLogoutStatus("idle");
            const form = event.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const email = String(formData.get("email") ?? "");
            const password = String(formData.get("password") ?? "");
            let res:
              | Awaited<ReturnType<typeof signIn>>
              | undefined
              | null = null;
            try {
              res = await signIn("credentials", {
                email,
                password,
                redirect: false,
              });
            } catch {
              setLoginStatus("error");
              setLoginMessage(
                "Login fehlgeschlagen. Bitte pruefe deine Verbindung und versuche es erneut.",
              );
              return;
            }
            if (res?.ok) {
              setLoginStatus("ok");
              setLoginMessage("Erfolgreich angemeldet.");
              setLogoutStatus("idle");
              return;
            }
            if (res?.error === "NEW_DEVICE") {
              sessionStorage.setItem("smokeify_verify_email", email);
              sessionStorage.setItem("smokeify_return_to", returnTo);
              router.push(
                `/auth/verify?email=${encodeURIComponent(
                  email,
                )}&returnTo=${encodeURIComponent(returnTo)}`,
              );
              return;
            }
            if (res?.error) {
              try {
                const rateRes = await fetch("/api/auth/rate-limit", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ identifier: email }),
                });
                if (rateRes.ok) {
                  const data = (await rateRes.json()) as {
                    limited?: boolean;
                  };
                  if (data.limited) {
                    setLoginStatus("error");
                    setLoginMessage(
                      "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
                    );
                    return;
                  }
                }
              } catch {
                // Ignore rate-limit status failures.
              }
              setLoginStatus("error");
              setLoginMessage(getLoginErrorMessage(res.error));
              return;
            }
            setLoginStatus("error");
            setLoginMessage(getLoginErrorMessage(res?.error ?? undefined));
          }}
          className="space-y-2"
        >
          <input
            name="email"
            type="text"
            required
            aria-label="Email oder Username"
            placeholder="Email oder Username"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
          <input
            name="password"
            type="password"
            required
            aria-label="Passwort"
            placeholder="Passwort"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
          <div className="flex justify-between">
            <Link
              href="/auth/verify"
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Account verifizieren
            </Link>
            <Link
              href="/auth/reset"
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Passwort vergessen?
            </Link>
          </div>
          <button
            type="submit"
            className="h-10 w-full cursor-pointer rounded-md bg-[#43584c] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Login
          </button>
        </form>
      )}
      <div className="mt-2 flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              href="/account"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              View profile
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                setLoginStatus("idle");
                setLogoutStatus("ok");
              }}
              className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            href={`/auth/register?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#E4C56C] px-4 text-sm font-semibold text-[#2f3e36] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Registrieren
          </Link>
        )}
      </div>
      {!isAuthenticated &&
        (logoutStatus === "ok" ||
          loginStatus === "ok" ||
          loginStatus === "error") && (
          <p
            className={`mt-2 text-xs ${
              logoutStatus === "ok" || loginStatus === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {logoutStatus === "ok"
              ? "Erfolgreich abgemeldet."
              : (loginMessage ?? "Login fehlgeschlagen.")}
          </p>
        )}
      {isAuthenticated && loginStatus === "ok" && (
        <p className="mt-2 text-xs text-green-700">
          Erfolgreich angemeldet.
        </p>
      )}
    </>
  );
  return (
    <>
      <nav className="fixed top-10 left-0 z-40 w-full border-b border-black/10 bg-stone-100">
        <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-6xl">
          <div className="py-6 sm:py-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* LEFT (spacer) */}
              <div className="flex items-center">
                <div id="mobile-nav-menu" className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-stone-700 shadow-sm hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Navigation oeffnen"
                  >
                    <Bars3Icon className="h-5 w-5" />
                  </button>
                  <div
                    className={`absolute left-0 top-full z-30 mt-3 w-52 rounded-xl border border-black/10 bg-white p-2 text-sm shadow-xl transition duration-150 ease-out ${
                      menuOpen
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-95 opacity-0"
                    }`}
                    aria-hidden={!menuOpen}
                  >
                    <Link
                      href="/products"
                      onClick={() => setMenuOpen(false)}
                      className={`${pixelNavFont.className} block rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                    >
                      Produkte
                    </Link>
                    <Link
                      href="/customizer"
                      onClick={() => setMenuOpen(false)}
                      className={`${pixelNavFont.className} block rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                    >
                      Customizer
                    </Link>
                  </div>
                </div>
                <div className="hidden items-center gap-3 text-xs font-semibold text-stone-800 sm:flex sm:gap-6 sm:text-base">
                  <Link
                    href="/products"
                    className={`${pixelNavFont.className} text-sm sm:text-lg hover:opacity-70 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                  >
                    Produkte
                  </Link>
                  <Link
                    href="/customizer"
                    className={`${pixelNavFont.className} text-sm sm:text-lg hover:opacity-70 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
                  >
                    Customizer
                  </Link>
                </div>
              </div>

              {/* CENTER */}
              <div className="col-start-2 flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-6">
                <div className="relative flex items-center gap-2 sm:gap-6">
                  <Link href="/" className="flex items-center">
                    <img
                      src="/images/smokeify2.png"
                      alt="Smokeify Logo"
                      className="h-12 w-auto object-contain sm:h-16"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      width={180}
                      height={64}
                    />
                  </Link>
                </div>
              </div>

              {/* RIGHT */}
              <div className="col-start-3 flex items-center justify-end gap-4 text-stone-800 sm:gap-6">
                <div className="relative" ref={cartRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) {
                        router.push("/cart");
                        return;
                      }
                      setCartOpen((prev) => !prev);
                    }}
                    className="relative cursor-pointer hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={cartOpen}
                    aria-haspopup="true"
                    aria-label="Warenkorb oeffnen"
                  >
                    <ShoppingBagIcon className="h-5 w-5" />
                    {count > 0 && (
                      <span
                        className={`absolute -right-2 -top-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white ${
                          cartPop ? "badge-pop" : ""
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                  {isMobile && mobileAddedOpen && mobileAddedItem && (
                    <div className="absolute right-0 top-full z-40 mt-3 w-64 rounded-xl border border-black/10 bg-white p-3 shadow-xl">
                      <div className="flex items-center gap-3">
                        {mobileAddedItem.imageUrl ? (
                          <img
                            src={mobileAddedItem.imageUrl}
                            alt={
                              mobileAddedItem.imageAlt ?? mobileAddedItem.title
                            }
                            className="h-12 w-12 rounded-md object-cover"
                            loading="lazy"
                            decoding="async"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-stone-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {mobileAddedItem.title}
                          </p>
                          {mobileAddedItem.price && (
                            <p className="text-xs text-stone-600">
                              {formatPrice(
                                mobileAddedItem.price.amount,
                                mobileAddedItem.price.currencyCode,
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-semibold">
                        <Link
                          href="/cart"
                          onClick={() => setMobileAddedOpen(false)}
                          className="block w-full rounded-lg border border-black/15 px-3 py-2 text-center text-stone-800 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          Warenkorb ansehen
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAddedOpen(false);
                            startCheckout();
                          }}
                          className="block w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-3 py-2 text-center text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          Zur Kasse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <Link
                  href="/wishlist"
                  className="relative hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label="Wunschliste"
                >
                  <HeartIcon className="h-5 w-5" />
                  {wishlistCount > 0 && (
                    <span
                      className={`absolute -right-2 -top-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white ${
                        wishlistPop ? "badge-pop" : ""
                      }`}
                    >
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <div className="relative -mr-1" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={accountOpen}
                    aria-haspopup="true"
                    aria-label="Account"
                  >
                    <UserCircleIcon className="h-5 w-5" />
                  </button>
                  <div
                    className={`absolute right-0 top-full z-20 mt-3 w-[90vw] max-w-xs origin-top-right rounded-xl border border-black/10 bg-white p-4 text-sm shadow-xl transition duration-150 ease-out sm:w-80 sm:max-w-none ${
                      accountOpen
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-95 opacity-0"
                    }`}
                    aria-hidden={!accountOpen}
                  >
                    {accountPanelContent}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {accountOpen && (
          <button
            type="button"
            aria-label="Close account"
            onClick={() => setAccountOpen(false)}
            className="fixed inset-0 z-10 bg-transparent"
          />
        )}
        {cartOpen && !isMobile && (
          <>
            <button
              type="button"
              aria-label="Close cart"
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 z-40 cursor-pointer bg-black/35 cart-overlay-fade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
            <aside
              ref={cartPanelRef}
              className="fixed right-0 top-0 z-50 h-dvh w-full max-w-sm bg-white shadow-xl cart-slide-in"
            >
              <div className="h-14 px-5 border-b border-black/10 flex items-center justify-between">
                <div className="text-sm font-semibold tracking-widest">
                  WARENKORB
                </div>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="text-xl cursor-pointer text-black/60 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="flex h-full flex-col">
                <div className="overflow-y-auto px-5 py-4 text-sm">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => void refresh()}
                        className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-red-700 underline underline-offset-4 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="flex items-center gap-2 text-stone-500">
                      <LoadingSpinner size="sm" />
                      <span>Warenkorb wird geladen...</span>
                    </div>
                  ) : !cart || cart.lines.length === 0 ? (
                    <p className="text-stone-500">Warenkorb ist leer.</p>
                  ) : (
                    <div className="space-y-3">
                      {cart.lines.slice(0, 6).map((line) => {
                        const lineTotal = (
                          Number(line.merchandise.price.amount) * line.quantity
                        ).toFixed(2);
                        return (
                          <div
                            key={line.id}
                            className="flex items-center gap-3"
                          >
                            {line.merchandise.image?.url ? (
                              <img
                                src={line.merchandise.image.url}
                                alt={
                                  line.merchandise.image.altText ??
                                  line.merchandise.product.title
                                }
                                className="h-12 w-12 rounded-md object-cover"
                                loading="lazy"
                                decoding="async"
                                width={48}
                                height={48}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-md bg-stone-100" />
                            )}
                            <div className="min-w-0 flex-1">
                              {line.merchandise.product.manufacturer && (
                                <p className="truncate text-[11px] uppercase tracking-wide text-stone-400">
                                  {line.merchandise.product.manufacturer}
                                </p>
                              )}
                              <p className="truncate text-sm font-semibold">
                                {line.merchandise.product.title}
                              </p>
                              <p className="text-xs text-stone-500">
                                {line.quantity} ×{" "}
                                {formatPrice(
                                  line.merchandise.price.amount,
                                  line.merchandise.price.currencyCode,
                                )}
                              </p>
                            </div>
                            <div className="text-right text-xs font-semibold text-black/80">
                              {formatPrice(
                                lineTotal,
                                line.merchandise.price.currencyCode,
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {cart.lines.length > 6 && (
                        <p className="text-xs text-stone-500">
                          + {cart.lines.length - 6} weitere Artikel
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t border-black/10 px-5 py-4 text-sm">
                  {!loading && cart && cart.lines.length > 0 && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-stone-500">Gesamt</span>
                      <span className="text-sm font-semibold text-black/80">
                        {formatPrice(
                          cart.cost.totalAmount.amount,
                          cart.cost.totalAmount.currencyCode,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Link
                      href="/cart"
                      className="block w-full rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-black/70 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      Warenkorb editieren
                    </Link>
                    <button
                      type="button"
                      onClick={startCheckout}
                      disabled={!canCheckout}
                      className="block w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {checkoutStatus === "loading"
                        ? "Weiterleitung..."
                        : "Zur Kasse"}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}
      </nav>
      <div className="h-[136px] sm:h-[152px]" />
    </>
  );
}
