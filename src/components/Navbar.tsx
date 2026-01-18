"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HeartIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { Pixelify_Sans } from "next/font/google";
import { useCart } from "./CartProvider";
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
    "idle"
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

  const count = loading ? 0 : cart?.totalQuantity ?? 0;
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
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const startCheckout = async () => {
    if (!cart || cart.lines.length === 0) {
      router.push("/cart");
      return;
    }
    if (!isAuthenticated) {
      router.push(
        `/auth/checkout?returnTo=${encodeURIComponent("/cart?startCheckout=1")}`
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
  return (
    <nav className="relative w-full border-b border-black/10">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="relative flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-8 text-m font-semibold text-stone-800">
            <Link
              href="/products"
              className={`${pixelNavFont.className} text-base sm:text-lg hover:opacity-70 hover:underline underline-offset-4`}
            >
              Produkte
            </Link>
            <Link
              href="/customizer"
              className={`${pixelNavFont.className} text-base sm:text-lg hover:opacity-70 hover:underline underline-offset-4`}
            >
              Customizer
            </Link>
          </div>

          {/* CENTER (ABSOLUTE) */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <img
              src="/images/smokeify2.png"
              alt="Smokeify Logo"
              className="h-16 w-auto object-contain"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={180}
              height={64}
            />
          </Link>

          {/* RIGHT */}
          <div className="flex items-center gap-6 text-stone-800">
            <div className="relative pb-3 -mb-3" ref={cartRef}>
              <button
                type="button"
                onClick={() => setCartOpen((prev) => !prev)}
                className="relative cursor-pointer hover:opacity-70"
                aria-expanded={cartOpen}
                aria-haspopup="true"
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
            </div>
            <Link
              href="/wishlist"
              className="relative hover:opacity-70 pb-3 -mb-3"
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
            <div className="relative pb-3 -mb-3 -mr-1" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className="flex h-5 w-5 cursor-pointer items-center justify-center hover:opacity-70"
                aria-expanded={accountOpen}
                aria-haspopup="true"
              >
                <UserCircleIcon className="h-5 w-5" />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full z-20 mt-3 w-80 rounded-xl border border-black/10 bg-white p-4 text-sm shadow-xl">
                  <div className="mb-4 text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#2f3e36" }}
                    >
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
                            "Login fehlgeschlagen. Bitte pruefe deine Verbindung und versuche es erneut."
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
                          sessionStorage.setItem(
                            "smokeify_verify_email",
                            email
                          );
                          sessionStorage.setItem(
                            "smokeify_return_to",
                            returnTo
                          );
                          router.push(
                            `/auth/verify?email=${encodeURIComponent(
                              email
                            )}&returnTo=${encodeURIComponent(returnTo)}`
                          );
                          return;
                        }
                        if (res?.error) {
                          try {
                            const rateRes = await fetch(
                              "/api/auth/rate-limit",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ identifier: email }),
                              }
                            );
                            if (rateRes.ok) {
                              const data = (await rateRes.json()) as {
                                limited?: boolean;
                              };
                              if (data.limited) {
                                setLoginStatus("error");
                                setLoginMessage(
                                  "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
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
                        setLoginMessage(
                          getLoginErrorMessage(res?.error ?? undefined)
                        );
                      }}
                      className="space-y-2"
                    >
                      <input
                        name="email"
                        type="text"
                        required
                        placeholder="Email oder Username"
                        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                      />
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="Passwort"
                        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                      />
                      <div className="flex justify-between">
                        <Link
                          href="/auth/verify"
                          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                        >
                          Account verifizieren
                        </Link>
                        <Link
                          href="/auth/reset"
                          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                        >
                          Passwort vergessen?
                        </Link>
                      </div>
                      <button
                        type="submit"
                        className="h-10 w-full cursor-pointer rounded-md bg-[#43584c] px-4 text-sm font-semibold text-white transition hover:opacity-90"
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
                          className="inline-flex flex-1 items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30"
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
                          className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30"
                        >
                          Log out
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/auth/register?returnTo=${encodeURIComponent(
                          returnTo
                        )}`}
                        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#E4C56C] px-4 text-sm font-semibold text-[#2f3e36] transition hover:opacity-90"
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
                          : loginMessage ?? "Login fehlgeschlagen."}
                      </p>
                    )}
                  {isAuthenticated && loginStatus === "ok" && (
                    <p className="mt-2 text-xs text-green-700">
                      Erfolgreich angemeldet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {cartOpen && (
        <>
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-40 cursor-pointer bg-black/35 cart-overlay-fade"
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
                className="text-xl cursor-pointer text-black/60 hover:text-black"
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
                      className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-red-700 underline underline-offset-4 hover:text-red-800"
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
                        <div key={line.id} className="flex items-center gap-3">
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
                                line.merchandise.price.currencyCode
                              )}
                            </p>
                          </div>
                          <div className="text-right text-xs font-semibold text-black/80">
                            {formatPrice(
                              lineTotal,
                              line.merchandise.price.currencyCode
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
                        cart.cost.totalAmount.currencyCode
                      )}
                    </span>
                  </div>
                )}
                <div className="grid gap-2">
                  <Link
                    href="/cart"
                    className="block w-full rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-black/70 hover:border-black/30"
                  >
                    Warenkorb editieren
                  </Link>
                  <button
                    type="button"
                    onClick={startCheckout}
                    disabled={!canCheckout}
                    className="block w-full rounded-lg border border-green-900 bg-green-800 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-900 disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-stone-200 disabled:text-stone-500"
                  >
                    {checkoutStatus === "loading" ? "Weiterleitung..." : "Zur Kasse"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </nav>
  );
}
