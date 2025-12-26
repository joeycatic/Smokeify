"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [registerName, setRegisterName] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerStreet, setRegisterStreet] = useState("");
  const [registerHouseNumber, setRegisterHouseNumber] = useState("");
  const [registerPostalCode, setRegisterPostalCode] = useState("");
  const [registerCity, setRegisterCity] = useState("");
  const [registerCountry, setRegisterCountry] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    const paramsError = searchParams.get("error");
    if (paramsError === "NEW_DEVICE") {
      setError("Neues Geraet erkannt. Code wurde per Email gesendet.");
    }
    const verified = searchParams.get("verified");
    const emailParam = searchParams.get("email");
    if (verified === "1") {
      setNotice("Email verifiziert. Bitte einloggen.");
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
          Account
        </h1>
        <p className="text-sm text-stone-600 mb-8">
          Melde dich an oder erstelle ein Konto mit Passwort und Code-Verification.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-md border border-black/10 bg-white p-4">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              LOGIN
            </h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setNotice("");
                const res = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                  callbackUrl: "/account",
                });
                if (res?.ok) {
                  router.push("/account");
                  return;
                }
                if (res?.error === "NEW_DEVICE") {
                  router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
                  return;
                }
                setError("Login fehlgeschlagen. Bitte pruefe deine Daten.");
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-stone-600">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Passwort
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              {notice && <p className="text-xs text-green-700">{notice}</p>}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Login
              </button>
            </form>
          </section>

          <section className="rounded-md border border-black/10 bg-white p-4">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              REGISTER
            </h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setRegisterError("");
                setRegisterLoading(true);
                try {
                  const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: registerName,
                      firstName: registerFirstName,
                      lastName: registerLastName,
                      street: registerStreet,
                      houseNumber: registerHouseNumber,
                      postalCode: registerPostalCode,
                      city: registerCity,
                      country: registerCountry,
                      email: registerEmail,
                      password: registerPassword,
                    }),
                  });
                  if (!res.ok) {
                    const data = (await res.json()) as { error?: string };
                    setRegisterError(data.error ?? "Registrierung fehlgeschlagen.");
                    return;
                  }
                  router.push(
                    `/auth/verify?email=${encodeURIComponent(registerEmail)}`
                  );
                } finally {
                  setRegisterLoading(false);
                }
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-stone-600">
                Name
              </label>
              <input
                type="text"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Vorname
              </label>
              <input
                type="text"
                value={registerFirstName}
                onChange={(event) => setRegisterFirstName(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Nachname
              </label>
              <input
                type="text"
                value={registerLastName}
                onChange={(event) => setRegisterLastName(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Street
              </label>
              <input
                type="text"
                value={registerStreet}
                onChange={(event) => setRegisterStreet(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                House number
              </label>
              <input
                type="text"
                value={registerHouseNumber}
                onChange={(event) => setRegisterHouseNumber(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Postcode
              </label>
              <input
                type="text"
                value={registerPostalCode}
                onChange={(event) => setRegisterPostalCode(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                City
              </label>
              <input
                type="text"
                value={registerCity}
                onChange={(event) => setRegisterCity(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Country
              </label>
              <input
                type="text"
                value={registerCountry}
                onChange={(event) => setRegisterCountry(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Email
              </label>
              <input
                type="email"
                required
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Passwort
              </label>
              <input
                type="password"
                required
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              {registerError && (
                <p className="text-xs text-red-600">{registerError}</p>
              )}
              <button
                type="submit"
                disabled={registerLoading}
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {registerLoading ? "Bitte warten..." : "Register"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
