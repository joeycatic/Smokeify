"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { trackAnalyticsEvent } from "@/lib/analytics";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Bitte verifiziere deine Email, bevor du dich einloggst.",
  RATE_LIMIT: "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
  NEW_DEVICE:
    "Neues Geraet erkannt. Code wurde per Email gesendet. Bitte bestaetigen.",
  CredentialsSignin: "Email oder Passwort ist falsch.",
  AccessDenied: "Zugriff verweigert. Bitte pruefe deine Berechtigung.",
};

const getLoginErrorMessage = (code?: string) => {
  if (!code) {
    return "Login fehlgeschlagen. Bitte pruefe deine Daten.";
  }
  return (
    LOGIN_ERROR_MESSAGES[code] ?? `Login fehlgeschlagen. Fehlercode: ${code}.`
  );
};

export default function CheckoutAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/cart";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "ok" | "error">(
    "idle"
  );
  const [loginLoading, setLoginLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<"register" | "login">(
    "register"
  );

  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regStreet, setRegStreet] = useState("");
  const [regHouseNumber, setRegHouseNumber] = useState("");
  const [regPostalCode, setRegPostalCode] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regCountry, setRegCountry] = useState("DE");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const hasSymbol = /[^A-Za-z0-9]/.test(regPassword);
  const strength = (() => {
    if (!regPassword) {
      return { score: 0, label: "Bitte Passwort eingeben." };
    }
    const hasLower = /[a-z]/.test(regPassword);
    const hasUpper = /[A-Z]/.test(regPassword);
    const hasNumber = /\d/.test(regPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(regPassword);
    const lengthOk = regPassword.length >= 8;
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
  const canRegister = strength.score >= 3 && hasSymbol;

  useEffect(() => {
    const paramsError = searchParams.get("error");
    if (paramsError === "NEW_DEVICE") {
      setLoginError("Neues Geraet erkannt. Code wurde per Email gesendet.");
    }
    const verified = searchParams.get("verified");
    const emailParam = searchParams.get("email");
    if (verified === "1") {
      setLoginNotice("Email verifiziert. Bitte einloggen.");
    }
    if (emailParam) {
      setEmail(emailParam);
    }
    setLoginStatus("idle");
  }, [searchParams]);

  useEffect(() => {
    if (!email || !password) {
      setLoginStatus("idle");
    }
  }, [email, password]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold" style={{ color: "#2f3e36" }}>
            Checkout Login
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Logge dich ein oder registriere dich, um zur Kasse zu gehen.
          </p>
        </div>
        <div className="mx-auto w-full max-w-5xl grid gap-6 md:grid-cols-2">
          <section>
            <div className="mb-4 border-b border-black/10 pb-3">
              <h2 className="text-lg font-semibold">Ich bin bereits Kunde</h2>
            </div>
            <button
              type="button"
              aria-expanded={activePanel === "login"}
              aria-controls="checkout-login-panel"
              onClick={() => setActivePanel("login")}
              className="w-full rounded-md border border-black/10 bg-[#2f3e36] px-6 py-3 text-left text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
            >
              Ich bin bereits Kunde
            </button>
            <div
              id="checkout-login-panel"
              className={`overflow-hidden transition-all duration-300 ${
                activePanel === "login"
                  ? "max-h-[1200px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div
                className={`pt-5 transition-transform duration-300 ${
                  activePanel === "login" ? "translate-y-0" : "-translate-y-2"
                }`}
              >
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setLoginError("");
                    setLoginNotice("");
                    setLoginStatus("idle");
                    setLoginLoading(true);
                    let res:
                      | Awaited<ReturnType<typeof signIn>>
                      | undefined
                      | null = null;
                    try {
                      res = await signIn("credentials", {
                        email,
                        password,
                        redirect: false,
                        callbackUrl: returnTo,
                      });
                      if (res?.ok) {
                        setLoginStatus("ok");
                        setTimeout(() => router.push(returnTo), 400);
                        return;
                      }
                      if (res?.error === "NEW_DEVICE") {
                        sessionStorage.setItem("smokeify_verify_email", email);
                        sessionStorage.setItem(
                          "smokeify_verify_password",
                          password
                        );
                        sessionStorage.setItem("smokeify_return_to", returnTo);
                        router.push(
                          `/auth/verify?email=${encodeURIComponent(
                            email
                          )}&returnTo=${encodeURIComponent(returnTo)}`
                        );
                        return;
                      }
                      if (res?.error) {
                        try {
                          const rateRes = await fetch("/api/auth/rate-limit", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ identifier: email }),
                          });
                          if (rateRes.ok) {
                            const data = (await rateRes.json()) as {
                              limited?: boolean;
                            };
                            if (data.limited) {
                              setLoginError(
                                "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
                              );
                              setLoginStatus("error");
                              return;
                            }
                          }
                        } catch {
                          // Ignore rate-limit status failures.
                        }
                        setLoginError(getLoginErrorMessage(res.error));
                        setLoginStatus("error");
                        return;
                      }
                      setLoginError(
                        getLoginErrorMessage(res?.error ?? undefined)
                      );
                      setLoginStatus("error");
                    } catch {
                      setLoginError(
                        "Login fehlgeschlagen. Bitte pruefe deine Verbindung und versuche es erneut."
                      );
                      setLoginStatus("error");
                    } finally {
                      setLoginLoading(false);
                    }
                  }}
                  className="space-y-2"
                >
                  <label className="block text-xs font-semibold text-stone-600">
                    Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email oder Username"
                    className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                  />
                  <label className="block text-xs font-semibold text-stone-600">
                    Passwort *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                  />
                  <div className="flex justify-between">
                    <Link
                      href="/auth/verify"
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                    >
                      Account verifizieren
                    </Link>
                    <Link
                      href="/auth/reset"
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                    >
                      Passwort vergessen?
                    </Link>
                  </div>
                  {loginNotice && (
                    <p className="text-xs text-green-700">{loginNotice}</p>
                  )}
                  {loginStatus === "ok" && (
                    <p className="text-xs text-green-700">
                      Erfolgreich angemeldet.
                    </p>
                  )}
                  {loginError && (
                    <p className="text-xs text-red-600">{loginError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {loginLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner
                          size="sm"
                          className="border-white/40 border-t-white"
                        />
                        Bitte warten...
                      </span>
                    ) : (
                      "Login"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 border-b border-black/10 pb-3">
              <h2 className="text-lg font-semibold">Im Shop registrieren</h2>
            </div>
            <button
              type="button"
              aria-expanded={activePanel === "register"}
              aria-controls="checkout-register-panel"
              onClick={() => setActivePanel("register")}
              className="w-full rounded-md border border-black/10 bg-[#E4C56C] px-6 py-3 text-left text-sm font-semibold uppercase tracking-wide text-[#2f3e36] transition hover:opacity-90"
            >
              Ich bin neu im Shop
            </button>
            <div
              id="checkout-register-panel"
              className={`overflow-hidden transition-all duration-300 ${
                activePanel === "register"
                  ? "max-h-[1200px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div
                className={`pt-5 transition-transform duration-300 ${
                  activePanel === "register"
                    ? "translate-y-0"
                    : "-translate-y-2"
                }`}
              >
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setRegisterError("");
                    setRegisterLoading(true);
                    try {
                      if (regPassword !== regConfirmPassword) {
                        setRegisterError("Passwoerter stimmen nicht ueberein.");
                        return;
                      }
                      if (!hasSymbol) {
                        setRegisterError(
                          "Passwort braucht mindestens ein Symbol."
                        );
                        return;
                      }
                      const res = await fetch("/api/auth/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name,
                          email: regEmail,
                          firstName: regFirstName,
                          lastName: regLastName,
                          street: regStreet,
                          houseNumber: regHouseNumber,
                          postalCode: regPostalCode,
                          city: regCity,
                          country: regCountry,
                          birthDate: regBirthDate || undefined,
                          password: regPassword,
                        }),
                      });
                      if (!res.ok) {
                        if (res.status === 429) {
                          setRegisterError(
                            "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
                          );
                          return;
                        }
                        const data = (await res.json()) as { error?: string };
                        setRegisterError(
                          data.error ?? "Registrierung fehlgeschlagen."
                        );
                        return;
                      }
                      trackAnalyticsEvent("sign_up", { method: "email" });
                      sessionStorage.setItem("smokeify_verify_email", regEmail);
                      sessionStorage.setItem(
                        "smokeify_verify_password",
                        regPassword
                      );
                      sessionStorage.setItem("smokeify_return_to", returnTo);
                      router.push(
                        `/auth/verify?email=${encodeURIComponent(
                          regEmail
                        )}&returnTo=${encodeURIComponent(returnTo)}`
                      );
                    } finally {
                      setRegisterLoading(false);
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
                      value={regEmail}
                      onChange={(event) => setRegEmail(event.target.value)}
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
                        value={regFirstName}
                        onChange={(event) =>
                          setRegFirstName(event.target.value)
                        }
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
                        value={regLastName}
                        onChange={(event) => setRegLastName(event.target.value)}
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
                        value={regStreet}
                        onChange={(event) => setRegStreet(event.target.value)}
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
                        value={regHouseNumber}
                        onChange={(event) =>
                          setRegHouseNumber(event.target.value)
                        }
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
                        value={regPostalCode}
                        onChange={(event) =>
                          setRegPostalCode(event.target.value)
                        }
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
                        value={regCity}
                        onChange={(event) => setRegCity(event.target.value)}
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
                      value={regCountry}
                      onChange={(event) => setRegCountry(event.target.value)}
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
                      value={regBirthDate}
                      onChange={(event) => setRegBirthDate(event.target.value)}
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
                        value={regPassword}
                        onChange={(event) => setRegPassword(event.target.value)}
                        className="w-full rounded-md border border-black/15 bg-stone-50 px-3 py-2 pr-12 text-sm outline-none ring-1 ring-black/5 focus:border-black/40 focus:bg-white focus:ring-2 focus:ring-black/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-800"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
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
                      value={regConfirmPassword}
                      onChange={(event) =>
                        setRegConfirmPassword(event.target.value)
                      }
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
                      <span
                        className={
                          canRegister ? "text-green-600" : "text-red-600"
                        }
                      >
                        {canRegister ? "OK" : "X"}
                      </span>
                    </div>
                  </div>
                  {registerError && (
                    <p className="text-xs text-red-600">{registerError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="h-12 w-full cursor-pointer rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {registerLoading ? (
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
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
