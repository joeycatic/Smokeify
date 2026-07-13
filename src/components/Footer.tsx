import Image from "next/image";
import Link from "next/link";
import {
  CheckBadgeIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import FooterNewsletter from "@/components/FooterNewsletter";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { businessDetails } from "@/lib/businessDetails";
import {
  buildGrowvaultAnalyzerUrl,
  buildGrowvaultCustomizerUrl,
  buildGrowvaultPublicUrl,
} from "@/lib/growvaultPublicStorefront";
import { SITE_NAME } from "@/lib/siteConfig";

const trustItems = [
  { label: "Kostenloser Versand ab 69 €", icon: TruckIcon },
  { label: "Sichere Zahlung", icon: ShieldCheckIcon },
  { label: "Aktives MAIN-Sortiment", icon: CheckBadgeIcon },
  { label: "Transparenter Checkout", icon: CreditCardIcon },
] as const;

const linkClass =
  "transition hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/45";

export default function Footer() {
  const { contactEmail, contactPhone, cityPostalLine, streetLine, vatId } =
    businessDetails;

  return (
    <footer className="mt-20 border-t border-[color:var(--gv-border)] bg-[color:var(--gv-forest)] text-[color:var(--gv-text)]">
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.45fr)] xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.25fr)_minmax(320px,0.95fr)]">
          <div className="space-y-5">
            <div>
              <p className="font-[family:var(--font-syne)] text-3xl font-extrabold tracking-[-0.06em]">
                <span className="text-[color:var(--gv-text)]">Smoke</span>
                <span className="text-[color:var(--gv-lime)]">ify</span>
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[color:var(--gv-text-muted)]">
                Equipment ohne Rätselraten. Klare Auswahl, aktive Bestände und
                ein Checkout, der den Gesamtpreis rechtzeitig zeigt.
              </p>
            </div>

            <div className="space-y-1 text-sm text-[color:var(--gv-text-muted)]">
              <p>{streetLine}</p>
              <p>{cityPostalLine}</p>
              <a href={`mailto:${contactEmail}`} className={linkClass}>
                {contactEmail}
              </a>
              {contactPhone ? (
                <a
                  href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                  className={`block ${linkClass}`}
                >
                  {contactPhone}
                </a>
              ) : null}
              {vatId ? <p>USt-IdNr.: {vatId}</p> : null}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
                Shop
              </p>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--gv-text-muted)]">
                <li><Link href="/products" className={linkClass}>Alle Produkte</Link></li>
                <li><Link href="/neuheiten" className={linkClass}>Neuheiten</Link></li>
                <li><Link href="/bestseller" className={linkClass}>Bestseller</Link></li>
                <li><Link href="/wishlist" className={linkClass}>Wunschliste</Link></li>
                <li><Link href="/products/compare" className={linkClass}>Produktvergleich</Link></li>
                <li><a href={buildGrowvaultCustomizerUrl()} className={linkClass}>Setup-Konfigurator</a></li>
                <li><a href={buildGrowvaultPublicUrl("/setups")} className={linkClass}>Setup-Presets</a></li>
                <li><a href={buildGrowvaultAnalyzerUrl()} className={linkClass}>Pflanzen-Analyzer</a></li>
                <li><a href={buildGrowvaultPublicUrl("/blog")} className={linkClass}>Guides &amp; Tipps</a></li>
              </ul>
            </div>

            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
                Hilfe
              </p>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--gv-text-muted)]">
                <li><Link href="/pages/about" className={linkClass}>Über uns</Link></li>
                <li><Link href="/pages/shipping" className={linkClass}>Versand &amp; Zahlungsbedingungen</Link></li>
                <li><Link href="/pages/return" className={linkClass}>Rückgabe</Link></li>
                <li><Link href="/pages/contact" className={linkClass}>Kontakt</Link></li>
                <li><Link href="/pages/faq" className={linkClass}>FAQ</Link></li>
              </ul>
            </div>

            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
                Rechtliches
              </p>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--gv-text-muted)]">
                <li><Link href="/datenschutz" className={linkClass}>Datenschutz</Link></li>
                <li><Link href="/agb" className={linkClass}>AGB</Link></li>
                <li><Link href="/widerruf" className={linkClass}>Widerruf</Link></li>
                <li><Link href="/impressum" className={linkClass}>Impressum</Link></li>
              </ul>
            </div>
          </div>

          <div className="gv-glass w-full max-w-[560px] rounded-[28px] p-6 md:col-span-2 md:justify-self-start xl:col-span-1">
            <FooterNewsletter />
          </div>
        </div>

        <div className="mt-8 grid gap-3 border-t border-[color:var(--gv-border)] pt-6 sm:grid-cols-2 xl:grid-cols-4">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="gv-glass flex items-center gap-3 rounded-[22px] px-4 py-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-lime)]/10 text-[color:var(--gv-lime)]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-[color:var(--gv-text)]">{item.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-5 border-t border-[color:var(--gv-border)] pt-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5 text-xs text-[color:var(--gv-text-muted)]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-[family:var(--font-jetbrains-mono)] uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
                Zahlung
              </span>
              <PaymentMethodLogos
                className="flex-wrap gap-4 sm:gap-5"
                logoClassName="h-8"
                pillClassName="border-[color:var(--gv-border)] bg-white"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="font-[family:var(--font-jetbrains-mono)] uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
                Versand
              </span>
              <Image
                src="/shipping-provider-logos/dhl-logo.png"
                alt="DHL"
                className="h-8 w-12 object-contain"
                width={48}
                height={32}
                sizes="48px"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 text-xs text-[color:var(--gv-text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {SITE_NAME}. Alle Rechte vorbehalten.</p>
            <div className="flex flex-wrap gap-4">
              <CookieSettingsButton className={linkClass}>Cookie-Einstellungen</CookieSettingsButton>
              <Link href="/datenschutz" className={linkClass}>Datenschutz</Link>
              <Link href="/agb" className={linkClass}>AGB</Link>
              <Link href="/impressum" className={linkClass}>Impressum</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
