"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "./CartProvider";

export function Navbar() {
  const { cart, loading } = useCart();

  const count = loading ? 0 : cart?.totalQuantity ?? 0;
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
            <Link href="/cart" className="hover:opacity-70">
              <ShoppingBagIcon className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute right-8 -top-2 rounded-full bg-black px-1.5 text-xs text-white bg-red-600">
                  {count}
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
