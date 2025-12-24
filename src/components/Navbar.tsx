"use client";

import Link from "next/link";
import Image from "next/image";
import {
  HeartIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";
import { useWishlist } from "@/hooks/useWishlist";

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

export function Navbar() {
  const { cart, loading } = useCart();
  const { ids } = useWishlist();

  const count = loading ? 0 : cart?.totalQuantity ?? 0;
  const wishlistCount = ids.length;
  return (
    <nav className="relative w-full border-b border-black/10">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="relative flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-8 text-sm font-semibold text-stone-800">
            <Link href="/products" className="hover:opacity-70 hover:underline underline-offset-4">
              Products
            </Link>
            <Link href="/customizer" className="hover:opacity-70 hover:underline underline-offset-4">
              Customizer
            </Link>
          </div>

          {/* CENTER (ABSOLUTE) */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2"
          >
            <img 
              src="/images/smokeify2.png" 
              alt="Smokeify Logo"
              className="h-16 w-auto object-contain"
            />
          </Link>

          {/* RIGHT */}
          <div className="flex items-center gap-6 text-stone-800">
            <div className="relative group pb-3 -mb-3">
              <Link href="/cart" className="relative hover:opacity-70">
                <ShoppingBagIcon className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-black px-1.5 text-xs text-white bg-red-600">
                    {count}
                  </span>
                )}
              </Link>
              <div className="invisible absolute right-0 top-full z-20 mt-3 w-80 translate-y-1 rounded-xl border border-black/10 bg-white p-4 text-sm opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {loading ? (
                  <p className="text-stone-500">Warenkorb wird geladen...</p>
                ) : !cart || cart.lines.length === 0 ? (
                  <p className="text-stone-500">Warenkorb ist leer.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-3">
                      {cart.lines.slice(0, 4).map((line) => {
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
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-md bg-stone-100" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs text-stone-500">
                                {line.merchandise.product.title}
                              </p>
                              <p className="truncate text-sm font-semibold">
                                {line.merchandise.title}
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
                    </div>
                    {cart.lines.length > 4 && (
                      <p className="text-xs text-stone-500">
                        + {cart.lines.length - 4} weitere Artikel
                      </p>
                    )}
                    <div className="flex items-center justify-between border-t border-black/10 pt-3">
                      <span className="text-xs text-stone-500">Gesamt</span>
                      <span className="text-sm font-semibold text-black/80">
                        {formatPrice(
                          cart.cost.totalAmount.amount,
                          cart.cost.totalAmount.currencyCode
                        )}
                      </span>
                    </div>
                    <Link
                      href="/cart"
                      className="block w-full rounded-md bg-black px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-90"
                    >
                      Zum Warenkorb
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <Link href="/wishlist" className="relative hover:opacity-70">
              <HeartIcon className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-black px-1.5 text-xs text-white bg-red-600">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link href="/account" className="hover:opacity-70">
              <UserCircleIcon className="h-5 w-5" />
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}

