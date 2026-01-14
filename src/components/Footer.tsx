// components/Footer.tsx
import Link from "next/link";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";

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
                aria-label="YouTube"
                className="text-white/70 hover:text-white transition"
              >
                <FaYoutube size={18} />
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
                    href="/pages/imprint"
                  >
                    Impressum
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest text-white/80">
                NEWSLETTER
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  className="h-10 w-full rounded-md bg-white/10 px-3 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/30"
                  placeholder="E-Mail"
                />
                <button className="h-10 shrink-0 rounded-md bg-white px-4 text-sm font-semibold text-[#2f3e36] hover:opacity-90 transition">
                  Join
                </button>
              </div>
              <p className="mt-2 text-xs text-white/55">
                Kein Spam. Abmelden jederzeit möglich.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
