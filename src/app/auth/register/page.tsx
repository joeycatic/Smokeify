"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
                if (!hasSymbol) {
                  setError("Passwort braucht mindestens ein Symbol.");
                  return;
                }
                const res = await fetch("/api/auth/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, email, password }),
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
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-stone-600">
              Username *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Passwort *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 pr-12 text-sm outline-none focus:border-black/30"
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
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full cursor-pointer rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Bitte warten..." : "Registrieren"}
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
