import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Leaf, LockKeyhole, ShieldCheck } from "lucide-react";
import { SITE_NAME } from "@/lib/siteConfig";

type CheckoutShellProps = {
  children: ReactNode;
  returnHref?: string;
  returnLabel?: string;
};

export default function CheckoutShell({
  children,
  returnHref = "/cart",
  returnLabel = "Zurück zum Warenkorb",
}: CheckoutShellProps) {
  return (
    <main className="gv-checkout-shell min-h-screen text-[color:var(--gv-text)]">
      <a
        href="#checkout-main"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-[color:var(--gv-lime)] px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Zum Checkout springen
      </a>

      <header className="border-b border-[color:var(--gv-border)] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-[family:var(--font-syne)] text-xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[color:var(--gv-lime)] text-white shadow-[0_8px_22px_rgba(31,95,63,0.2)]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </span>
            {SITE_NAME}
          </Link>

          <div aria-label="Sicherer Checkout" className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50/80 p-2 text-xs font-semibold text-emerald-900 sm:px-3 sm:py-1.5">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sicherer Checkout</span>
          </div>

          <Link
            href={returnHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-xs font-semibold text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-lime)] sm:px-3 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{returnLabel}</span>
            <span className="sm:hidden">Zurück</span>
          </Link>
        </div>
      </header>

      <div id="checkout-main">{children}</div>

      <footer className="border-t border-[color:var(--gv-border)] bg-white/72">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-6 text-xs text-[color:var(--gv-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 font-medium text-[color:var(--gv-text)]">
            <LockKeyhole className="h-4 w-4 text-[color:var(--gv-lime)]" aria-hidden="true" />
            Deine Daten werden verschlüsselt übertragen.
          </p>
          <nav aria-label="Rechtliche Informationen" className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/datenschutz" className="hover:text-[color:var(--gv-text)]">Datenschutz</Link>
            <Link href="/agb" className="hover:text-[color:var(--gv-text)]">AGB</Link>
            <Link href="/pages/shipping" className="hover:text-[color:var(--gv-text)]">Versand &amp; Zahlung</Link>
            <Link href="/pages/contact" className="hover:text-[color:var(--gv-text)]">Hilfe</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
