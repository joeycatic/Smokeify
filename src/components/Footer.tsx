// components/Footer.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { FaDiscord, FaInstagram, FaTiktok } from "react-icons/fa";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(
    null,
  );

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

            <div>
              <p className="text-xs font-semibold tracking-widest text-white/80">
                NEWSLETTER
              </p>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const email = newsletterEmail.trim();
                  if (!email) {
                    setNewsletterStatus("error");
                    setNewsletterMessage("Bitte E-Mail eingeben.");
                    return;
                  }
                  setNewsletterStatus("loading");
                  setNewsletterMessage(null);
                  try {
                    const res = await fetch("/api/newsletter/subscribe", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) {
                      setNewsletterStatus("error");
                      setNewsletterMessage(data?.error ?? "Anmeldung fehlgeschlagen.");
                      return;
                    }
                    setNewsletterStatus("ok");
                    setNewsletterMessage("Danke! Du bist eingetragen.");
                    setNewsletterEmail("");
                  } catch {
                    setNewsletterStatus("error");
                    setNewsletterMessage("Anmeldung fehlgeschlagen.");
                  }
                }}
              >
                <input
                  className="h-10 w-full rounded-md bg-white/10 px-3 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/30"
                  placeholder="E-Mail"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  type="email"
                  name="email"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "loading"}
                  className="h-10 shrink-0 rounded-md bg-white px-4 text-sm font-semibold text-[#2f3e36] hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {newsletterStatus === "loading" ? "Senden..." : "Join"}
                </button>
              </form>
              <p className="mt-2 text-xs text-white/55">
                Kein Spam. Abmelden jederzeit möglich.
              </p>
              {newsletterMessage && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    newsletterStatus === "ok" ? "text-emerald-200" : "text-rose-200"
                  }`}
                >
                  {newsletterMessage}
                </p>
              )}
            </div>
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
