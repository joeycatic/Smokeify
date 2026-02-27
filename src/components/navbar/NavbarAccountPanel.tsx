"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

type Props = {
  mounted: boolean;
  isAuthenticated: boolean;
  returnTo: string;
};

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

export default function NavbarAccountPanel({
  mounted,
  isAuthenticated,
  returnTo,
}: Props) {
  const router = useRouter();
  const [loginStatus, setLoginStatus] = useState<"idle" | "ok" | "error">(
    "idle",
  );
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [logoutStatus, setLogoutStatus] = useState<"idle" | "ok">("idle");

  useEffect(() => {
    if (isAuthenticated) {
      setLogoutStatus("idle");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (logoutStatus !== "ok") return;
    const timer = setTimeout(() => setLogoutStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [logoutStatus]);

  useEffect(() => {
    if (loginStatus !== "ok") return;
    const timer = setTimeout(() => setLoginStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [loginStatus]);

  if (!mounted) {
    return <div className="h-24" />;
  }

  return (
    <>
      <div className="mb-4 text-center">
        <p className="text-2xl font-bold" style={{ color: "#2f3e36" }}>
          Account
        </p>
        <p className="mt-1 text-xs text-black/60">
          {isAuthenticated
            ? "Verwalten Sie Ihr Profil oder loggen sich aus."
            : "Melde dich an oder erstelle ein Konto."}
        </p>
      </div>
      {!isAuthenticated && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setLoginStatus("idle");
            setLoginMessage(null);
            setLogoutStatus("idle");
            setLoginLoading(true);
            const form = event.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const email = String(formData.get("email") ?? "");
            const password = String(formData.get("password") ?? "");
            let res: Awaited<ReturnType<typeof signIn>> | undefined | null =
              null;
            try {
              res = await signIn("credentials", {
                email,
                password,
                redirect: false,
              });
              if (res?.ok) {
                setLoginStatus("ok");
                setLoginMessage("Erfolgreich angemeldet.");
                setLogoutStatus("idle");
                return;
              }
              if (res?.error === "NEW_DEVICE") {
                sessionStorage.setItem("smokeify_verify_email", email);
                sessionStorage.setItem("smokeify_return_to", returnTo);
                router.push(
                  `/auth/verify?email=${encodeURIComponent(
                    email,
                  )}&returnTo=${encodeURIComponent(returnTo)}`,
                );
                return;
              }
              if (res?.error) {
                try {
                  const rateRes = await fetch("/api/auth/rate-limit", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ identifier: email }),
                  });
                  if (rateRes.ok) {
                    const data = (await rateRes.json()) as {
                      limited?: boolean;
                    };
                    if (data.limited) {
                      setLoginStatus("error");
                      setLoginMessage(
                        "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
                      );
                      return;
                    }
                  }
                } catch {
                  // Ignore rate-limit status failures.
                }
                setLoginStatus("error");
                setLoginMessage(getLoginErrorMessage(res.error));
                return;
              }
              setLoginStatus("error");
              setLoginMessage(getLoginErrorMessage(res?.error ?? undefined));
            } catch {
              setLoginStatus("error");
              setLoginMessage(
                "Login fehlgeschlagen. Bitte pruefe deine Verbindung und versuche es erneut.",
              );
            } finally {
              setLoginLoading(false);
            }
          }}
          className="space-y-2"
        >
          <input
            name="email"
            type="text"
            required
            aria-label="Email oder Username"
            placeholder="Email oder Username"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
          <input
            name="password"
            type="password"
            required
            aria-label="Passwort"
            placeholder="Passwort"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
          <div className="flex justify-between">
            <Link
              href="/auth/verify"
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Account verifizieren
            </Link>
            <Link
              href="/auth/reset"
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Passwort vergessen?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="h-10 w-full cursor-pointer rounded-md bg-[#43584c] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60"
          >
            {loginLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
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
      )}
      <div className="mt-2 flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              href="/account"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Anzeigen
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                setLoginStatus("idle");
                setLogoutStatus("ok");
              }}
              className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-black/15 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Ausloggen
            </button>
          </>
        ) : (
          <Link
            href={`/auth/register?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#E4C56C] px-4 text-sm font-semibold text-[#2f3e36] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Registrieren
          </Link>
        )}
      </div>
      {!isAuthenticated &&
        (logoutStatus === "ok" ||
          loginStatus === "ok" ||
          loginStatus === "error") && (
          <p
            className={`mt-2 text-xs ${
              logoutStatus === "ok" || loginStatus === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {logoutStatus === "ok"
              ? "Erfolgreich abgemeldet."
              : (loginMessage ?? "Login fehlgeschlagen.")}
          </p>
        )}
      {isAuthenticated && loginStatus === "ok" && (
        <p className="mt-2 text-xs text-green-700">Erfolgreich angemeldet.</p>
      )}
    </>
  );
}
