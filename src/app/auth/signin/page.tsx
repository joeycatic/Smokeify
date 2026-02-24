"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Bitte verifiziere deine Email, bevor du dich einloggst.",
  RATE_LIMIT: "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
  NEW_DEVICE:
    "Neues Geraet erkannt. Code wurde per Email gesendet. Bitte bestaetigen.",
  CredentialsSignin: "Email oder Passwort ist falsch.",
  AccessDenied: "Zugriff verweigert. Bitte pruefe deine Berechtigung.",
  OAuthSignin: "Google Login konnte nicht gestartet werden.",
  OAuthCallback: "Google Login Rueckgabe ist fehlgeschlagen.",
  OAuthCreateAccount: "Google Konto konnte nicht angelegt werden.",
  OAuthAccountNotLinked:
    "Diese Email ist bereits mit einer anderen Login-Methode verknuepft.",
  Configuration: "Google Login ist derzeit nicht korrekt konfiguriert.",
};

const getLoginErrorMessage = (code?: string) => {
  if (!code) {
    return "Login fehlgeschlagen. Bitte pruefe deine Daten.";
  }
  return (
    LOGIN_ERROR_MESSAGES[code] ?? `Login fehlgeschlagen. Fehlercode: ${code}.`
  );
};

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "ok" | "error">(
    "idle"
  );
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const paramsError = searchParams.get("error");
    if (paramsError) {
      if (paramsError === "NEW_DEVICE") {
        setError("Neues Geraet erkannt. Code wurde per Email gesendet.");
      } else {
        setError(getLoginErrorMessage(paramsError));
      }
    }
    const verified = searchParams.get("verified");
    const emailParam = searchParams.get("email");
    if (verified === "1") {
      setNotice("Email verifiziert. Bitte einloggen.");
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
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#2f3e36" }}
            >
              Account Login
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Melde dich an oder erstelle ein Konto mit Passwort und
              Code-Verification.
            </p>
          </div>

          <section>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setNotice("");
                setLoginStatus("idle");
                setLoading(true);
                let res: Awaited<ReturnType<typeof signIn>> | undefined | null =
                  null;
                try {
                  res = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                    callbackUrl: "/account",
                  });
                  if (res?.ok) {
                    setLoginStatus("ok");
                    setTimeout(() => router.push("/account"), 600);
                    return;
                  }
                  if (res?.error === "NEW_DEVICE") {
                    const returnTo = searchParams.get("returnTo") || "/";
                    sessionStorage.setItem("smokeify_verify_email", email);
                    sessionStorage.setItem("smokeify_verify_password", password);
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
                          setError(
                            "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
                          );
                          setLoginStatus("error");
                          return;
                        }
                      }
                    } catch {
                      // Ignore rate-limit status failures and fall back to generic error.
                    }
                    setError(getLoginErrorMessage(res.error));
                    setLoginStatus("error");
                    return;
                  }
                  setError(getLoginErrorMessage(res?.error ?? undefined));
                  setLoginStatus("error");
                } catch {
                  setError(
                    "Login fehlgeschlagen. Bitte pruefe deine Verbindung und versuche es erneut."
                  );
                  setLoginStatus("error");
                } finally {
                  setLoading(false);
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
                placeholder="Email or username"
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
              <label className="block text-xs font-semibold text-stone-600">
                Passwort *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
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
              {notice && <p className="text-xs text-green-700">{notice}</p>}
              {loginStatus === "ok" && (
                <p className="text-xs text-green-700">
                  Erfolgreich angemeldet.
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="button"
                disabled={oauthLoading || loading}
                onClick={async () => {
                  setError("");
                  setNotice("");
                  setLoginStatus("idle");
                  setOauthLoading(true);
                  const returnTo = searchParams.get("returnTo") || "/account";
                  try {
                    const providers = await getProviders();
                    if (!providers?.google) {
                      setError(
                        "Google Login ist nicht aktiviert. Bitte spaeter erneut versuchen."
                      );
                      setLoginStatus("error");
                      return;
                    }
                    const oauthRes = await signIn("google", {
                      redirect: false,
                      callbackUrl: returnTo,
                    });
                    if (oauthRes?.error) {
                      setError(getLoginErrorMessage(oauthRes.error));
                      setLoginStatus("error");
                      return;
                    }
                    if (oauthRes?.url) {
                      router.push(oauthRes.url);
                      return;
                    }
                    setError(
                      "Google Login konnte nicht gestartet werden. Bitte erneut versuchen."
                    );
                    setLoginStatus("error");
                  } catch {
                    setError(
                      "Google Login fehlgeschlagen. Bitte pruefe die Konfiguration."
                    );
                    setLoginStatus("error");
                  } finally {
                    setOauthLoading(false);
                  }
                }}
                className="h-12 w-full cursor-pointer rounded-md border border-[#1647a6] bg-[#1e5bcc] px-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#174aa7] disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-white">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                    >
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.8 3.9 14.7 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.8 0-.6-.1-1.1-.2-1.5H12z"
                      />
                      <path
                        fill="#34A853"
                        d="M3 7.3l3.2 2.3C7 7.2 9.3 5.6 12 5.6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.8 3.9 14.7 3 12 3 8.1 3 4.7 5.3 3 8.7z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M12 21c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.8 1-3.4 1-2.7 0-5-1.8-5.8-4.3L3 15.2C4.7 18.7 8.1 21 12 21z"
                      />
                      <path
                        fill="#4285F4"
                        d="M21 12.2c0-.6-.1-1.1-.2-1.6H12v3.5h5c-.2 1.1-.9 2.1-1.9 2.8l3 2.4c1.8-1.6 2.9-4 2.9-7.1z"
                      />
                    </svg>
                  </span>
                  {oauthLoading ? "Google wird geöffnet..." : "Mit Google fortfahren"}
                </span>
              </button>
              <div className="relative py-1">
                <div className="h-px w-full bg-black/10" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  oder
                </span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
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
                  "Login"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  const returnTo = searchParams.get("returnTo");
                  router.push(
                    returnTo
                      ? `/auth/register?returnTo=${encodeURIComponent(
                          returnTo
                        )}`
                      : "/auth/register"
                  );
                }}
                className="h-12 w-full rounded-md bg-[#E4C56C] px-4 text-base font-semibold text-[#2f3e36] transition hover:opacity-90"
              >
                Registrieren
              </button>
            </form>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
