"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { trackAnalyticsEvent } from "@/lib/analytics";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const strength = (() => {
    if (!password) {
      return { score: 0, label: "Bitte Passwort eingeben." };
    }
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const lengthOk = password.length >= 8;
    const score =
      Number(lengthOk) +
      Number(hasLower) +
      Number(hasUpper) +
      Number(hasNumber) +
      Number(hasSymbol);

    if (score <= 2) return { score, label: "Schwach" };
    if (score === 3) return { score, label: "Okay" };
    if (score === 4) return { score, label: "Gut" };
    return { score, label: "Sehr stark" };
  })();

  const strengthPercent = Math.min(100, Math.round((strength.score / 5) * 100));
  const strengthHue = Math.round((strength.score / 5) * 120);
  const strengthColor = `hsl(${strengthHue} 75% 45%)`;
  const strengthTrack = `hsla(${strengthHue} 75% 60% / 0.25)`;
  const canLogin = strength.score >= 3 && hasSymbol;

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#2f3e36" }}
            >
              Registrieren
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Erstelle ein Konto. Du erhältst einen Code zur Bestätigung.
            </p>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setLoading(true);
              try {
                if (password !== confirmPassword) {
                  setError("Passwoerter stimmen nicht ueberein.");
                  return;
                }
                if (!hasSymbol) {
                  setError("Passwort braucht mindestens ein Symbol.");
                  return;
                }
                const res = await fetch("/api/auth/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    email,
                    firstName,
                    lastName,
                    street,
                    houseNumber,
                    postalCode,
                    city,
                    country,
                    birthDate: birthDate || undefined,
                    password,
                    newsletterOptIn,
                    privacyAccepted,
                  }),
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    setError(
                      "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
                    );
                    return;
                  }
                  const data = (await res.json()) as { error?: string };
                  setError(data.error ?? "Registrierung fehlgeschlagen.");
                  return;
                }
                trackAnalyticsEvent("sign_up", { method: "email" });
                const returnTo = searchParams.get("returnTo") || "/";
                sessionStorage.setItem("smokeify_verify_email", email);
                sessionStorage.setItem("smokeify_return_to", returnTo);
                router.push(
                  `/auth/verify?email=${encodeURIComponent(
                    email
                  )}&returnTo=${encodeURIComponent(returnTo)}`
                );
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Username *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Vorname *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Nachname *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Straße *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Hausnummer *
                </label>
                <input
                  type="text"
                  required
                  value={houseNumber}
                  onChange={(event) => setHouseNumber(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Postleitzahl *
                </label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">
                  Stadt *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Land *
              </label>
              <select
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
              >
                <option value="DE">Deutschland</option>
                <option value="AT">Oesterreich</option>
                <option value="CH">Schweiz</option>
                <option value="EU">EU (sonstige)</option>
                <option value="UK">Vereinigtes Koenigreich</option>
                <option value="US">USA</option>
                <option value="OTHER">Andere</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Geburtstag (optional)
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Passwort *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 pr-12 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-800"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M4 4l16 16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-600">
                Passwort bestätigen *
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="space-y-1">
              <div
                className="h-2 w-full rounded-full"
                style={{ backgroundColor: strengthTrack }}
              >
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${strengthPercent}%`,
                    backgroundColor: strengthColor,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Passwortstärke: {strength.label}</span>
                <span className={canLogin ? "text-green-600" : "text-red-600"}>
                  {canLogin ? "OK" : "X"}
                </span>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-md border border-black/10 bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-emerald-700 focus:ring-emerald-600/30"
                checked={newsletterOptIn}
                onChange={(event) => setNewsletterOptIn(event.target.checked)}
              />
              <span>
                Ich möchte den Newsletter erhalten (jederzeit abbestellbar).
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-black/10 bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <input
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-emerald-700 focus:ring-emerald-600/30"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              <span>
                Ich habe die{" "}
                <a
                  href="/pages/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-700 underline underline-offset-4"
                >
                  DSGVO
                </a>{" "}
                gelesen und akzeptiere sie.
              </span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full cursor-pointer rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner
                    size="sm"
                    className="border-white/40 border-t-white"
                  />
                  Bitte warten...
                </span>
              ) : (
                "Registrieren"
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push("/auth/signin")}
              className="h-12 w-full cursor-pointer rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
            >
              Zurück zum Login
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
