import Link from "next/link";
import Image from "next/image";

export default function SimpleNavbar() {
  return (
    <>
      <nav className="fixed left-0 top-10 z-40 w-full border-b border-black/5 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[70px] w-full max-w-6xl items-center justify-between gap-6 px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-stone-900"
            aria-label="Smokeify Startseite"
          >
            <Image
              src="/images/smokeify2.png"
              alt="Smokeify"
              width={144}
              height={40}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>

          <div className="hidden items-center gap-5 text-sm font-semibold text-stone-700 sm:flex">
            <Link href="/products" className="transition hover:text-emerald-800">
              Produkte
            </Link>
            <Link href="/bestseller" className="transition hover:text-emerald-800">
              Bestseller
            </Link>
            <Link href="/neuheiten" className="transition hover:text-emerald-800">
              Neuheiten
            </Link>
            <Link href="/blog" className="transition hover:text-emerald-800">
              Blog
            </Link>
            <Link href="/pages/contact" className="transition hover:text-emerald-800">
              Kontakt
            </Link>
          </div>
        </div>
      </nav>
      <div className="h-[110px]" aria-hidden="true" />
    </>
  );
}
