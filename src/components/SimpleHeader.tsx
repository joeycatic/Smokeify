import Link from "next/link";

const PRIMARY_LINKS = [
  { href: "/products", label: "Produkte" },
  { href: "/blog", label: "Blog" },
  { href: "/pages/about", label: "Über uns" },
  { href: "/pages/contact", label: "Kontakt" },
];

export default function SimpleHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-stone-50/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-black tracking-[0.18em] text-stone-900 uppercase"
        >
          Smokeify
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-medium text-stone-600">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-stone-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

