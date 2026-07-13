import Link from "next/link";

const PRIMARY_LINKS = [
  { href: "/products", label: "Produkte" },
  { href: "/bestseller", label: "Bestseller" },
  { href: "/pages/about", label: "Über uns" },
  { href: "/pages/contact", label: "Kontakt" },
];

export default function SimpleHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--gv-border)] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-[family:var(--font-syne)] text-xl font-extrabold tracking-[-0.05em] text-[color:var(--gv-text)]"
        >
          Smokeify
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-medium text-[color:var(--gv-text-muted)]">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[color:var(--gv-lime)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
