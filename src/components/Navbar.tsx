import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export function Navbar() {
  return (
    <nav className="relative w-full mb-4">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="relative flex h-16 items-center justify-between">

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