import Link from "next/link";
import { FaDiscord, FaInstagram, FaTiktok } from "react-icons/fa";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import FooterNewsletter from "@/components/FooterNewsletter";

export default function Footer() {
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

            <div className="flex items-center gap-4">
              <a
                href="#"
                aria-label="Instagram"
                className="text-white/70 hover:text-white transition"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="#"
                aria-label="TikTok"
                className="text-white/70 hover:text-white transition"
              >
                <FaTiktok size={18} />
              </a>
              <a
                href="#"
                aria-label="Discord"
                className="text-white/70 hover:text-white transition"
              >
                <FaDiscord size={18} />
              </a>
            </div>
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
                  href="/collections/new"
                >
                  Neuheiten
                </Link>
              </li>
              <li>
                <Link
                  className="text-white/70 hover:text-white transition"
                  href="/collections/bestseller"
                >
                  Bestseller
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
              <img
                src="/shipping-provider-logos/dhl-logo.png"
                alt="DHL"
                className="h-5 w-auto object-contain"
                loading="lazy"
                decoding="async"
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
