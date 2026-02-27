import Link from "next/link";
import Image from "next/image";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import FooterNewsletter from "@/components/FooterNewsletter";

function IconInstagram() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z" />
    </svg>
  );
}

function IconDiscord() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 00-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 00-5.487 0 12.36 12.36 0 00-.617-1.23A.077.077 0 008.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 00-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 00.031.055 20.03 20.03 0 005.993 2.98.078.078 0 00.084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 01-1.872-.878.075.075 0 01-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 01.078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 01.079.009c.12.098.245.195.372.288a.075.075 0 01-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 00-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 00.084.028 19.963 19.963 0 006.002-2.981.076.076 0 00.032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 00-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
    </svg>
  );
}

export default function Footer() {
  const socialLinks = [
    {
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim(),
      label: "Instagram",
      icon: <IconInstagram />,
    },
    {
      href: process.env.NEXT_PUBLIC_TIKTOK_URL?.trim(),
      label: "TikTok",
      icon: <IconTikTok />,
    },
    {
      href: process.env.NEXT_PUBLIC_DISCORD_URL?.trim(),
      label: "Discord",
      icon: <IconDiscord />,
    },
  ];

  return (
    <footer className="mt-6 bg-[#2f3e36] text-white/90">
      {/* Top */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">
                Smokeify
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/70 max-w-sm">
                Quality products & trusted service. Curated gear for your setup.
              </p>
            </div>

            {socialLinks.some((entry) => Boolean(entry.href)) && (
              <div className="flex items-center gap-4">
                {socialLinks.map((entry) =>
                  entry.href ? (
                    <a
                      key={entry.label}
                      href={entry.href}
                      aria-label={entry.label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/70 hover:text-white transition"
                    >
                      {entry.icon}
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>

          {/* Shop */}
          <div>
            <p className="text-sm font-semibold text-white">Shop</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/products"
                >
                  Alle Produkte
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/neuheiten"
                >
                  Neuheiten
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/bestseller"
                >
                  Bestseller
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/blog"
                >
                  Guides & Tipps
                </Link>
              </li>
            </ul>
          </div>

          {/* Hilfe */}
          <div>
            <p className="text-sm font-semibold text-white">Hilfe</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/pages/shipping"
                >
                  Versand & Zahlungsbedingungen
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/pages/return"
                >
                  Rückgabe
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/pages/contact"
                >
                  Kontakt
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/pages/faq"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Rechtliches + Newsletter */}
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-white">Rechtliches</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    className="text-white/70 hover:text-white transition"
                    href="/pages/privacy"
                  >
                    Datenschutz
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-white/70 hover:text-white transition"
                    href="/pages/agb"
                  >
                    AGB
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-white/70 hover:text-white transition"
                    href="/pages/refund"
                  >
                    Widerruf
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-white/70 hover:text-white transition"
                    href="/pages/jugendschutzhinweise"
                  >
                    Jugendschutzhinweise
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-white/70 hover:text-white transition"
                    href="/pages/imprint"
                  >
                    Impressum
                  </Link>
                </li>
              </ul>
            </div>

            <FooterNewsletter />
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
            <span className="mr-1 text-xs font-semibold text-white/80">
              Zahlungsarten:
            </span>
            <PaymentMethodLogos />
            <span className="ml-1 mr-1 text-xs font-semibold text-white/80">
              Versand:
            </span>
            <span className="inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3">
              <Image
                src="/shipping-provider-logos/dhl-logo.png"
                alt="DHL"
                className="h-5 w-auto object-contain"
                width={60}
                height={20}
                sizes="60px"
              />
            </span>
          </div>
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Smokeify — Alle Rechte vorbehalten.
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <Link
              className="text-white/60 hover:text-white transition"
              href="/pages/privacy"
            >
              Datenschutz
            </Link>
            <Link
              className="text-white/60 hover:text-white transition"
              href="/pages/agb"
            >
              AGB
            </Link>
            <Link
              className="text-white/60 hover:text-white transition"
              href="/pages/imprint"
            >
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
