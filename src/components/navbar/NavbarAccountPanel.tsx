"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  RETURN_TO_STORAGE_KEY,
  VERIFY_EMAIL_STORAGE_KEY,
} from "@/lib/authStorage";

type Props = {
  mounted: boolean;
  isAuthenticated: boolean;
  returnTo: string;
};

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED:
    "Bitte verifiziere deine E-Mail-Adresse, bevor du dich anmeldest.",
  RATE_LIMIT: "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
  NEW_DEVICE:
    "Neues Gerät erkannt. Ein Code wurde per E-Mail gesendet. Bitte bestätige die Anmeldung.",
  CredentialsSignin: "E-Mail-Adresse oder Passwort ist falsch.",
  AccessDenied: "Zugriff verweigert. Bitte prüfe deine Berechtigung.",
};

const getLoginErrorMessage = (code?: string) => {
  if (!code) {
    return "Anmeldung fehlgeschlagen. Bitte prüfe deine Daten.";
  }
  return (
    LOGIN_ERROR_MESSAGES[code] ??
    `Anmeldung fehlgeschlagen. Fehlercode: ${code}.`
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

  const statusToneClass =
    loginStatus === "error"
      ? "border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 text-[color:var(--gv-error)]"
      : "border-[color:var(--gv-success)]/30 bg-[color:var(--gv-success)]/10 text-[color:var(--gv-success)]";
  const primaryActionClass =
    "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[color:var(--gv-lime)] px-4 text-sm font-semibold text-[color:var(--gv-forest)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[color:var(--gv-muted)] disabled:text-[color:var(--gv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]";
  const secondaryActionClass =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/30 hover:bg-[color:var(--gv-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]";

  return (
    <div className="rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-4 shadow-[var(--gv-shadow-lg)]">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--gv-border)] bg-[color:var(--gv-brand-soft)] text-[color:var(--gv-lime)]">
            <UserCircleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[color:var(--gv-text)]">
              Konto
            </p>
            <p className="mt-0.5 text-sm leading-5 text-[color:var(--gv-text-muted)]">
              {isAuthenticated
                ? "Du bist angemeldet."
                : "Einloggen oder neues Konto erstellen."}
            </p>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="space-y-2">
            <Link href="/account" className={primaryActionClass}>
              Account öffnen
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                setLoginStatus("idle");
                setLogoutStatus("ok");
              }}
              className={`${secondaryActionClass} text-[color:var(--gv-error)] hover:border-[color:var(--gv-error)]/30 hover:text-[color:var(--gv-error)]`}
            >
              Abmelden
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
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
                    sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, email);
                    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, returnTo);
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
                    "Anmeldung fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut.",
                  );
                } finally {
                  setLoginLoading(false);
                }
              }}
              className="space-y-3"
            >
              <input
                name="email"
                type="text"
                required
                aria-label="E-Mail-Adresse oder Benutzername"
                placeholder="E-Mail oder Benutzername"
                className="gv-input h-11 w-full rounded-lg px-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
              />
              <input
                name="password"
                type="password"
                required
                aria-label="Passwort"
                placeholder="Passwort"
                className="gv-input h-11 w-full rounded-lg px-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
              />
              <button
                type="submit"
                disabled={loginLoading}
                className={primaryActionClass}
              >
                {loginLoading ? (
                  <>
                    <LoadingSpinner
                      size="sm"
                      className="border-[color:var(--gv-forest)]/25 border-t-[color:var(--gv-forest)]"
                    />
                    Bitte warten...
                  </>
                ) : (
                  <>
                    Einloggen
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <Link
              href={`/auth/register?returnTo=${encodeURIComponent(returnTo)}`}
              className={secondaryActionClass}
            >
              Konto erstellen
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--gv-border)] pt-3 text-xs font-medium">
              <Link
                href="/auth/verify"
                className="text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                Konto verifizieren
              </Link>
              <Link
                href="/auth/reset"
                className="text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                Passwort vergessen?
              </Link>
            </div>
          </>
        )}

        {(logoutStatus === "ok" ||
          loginStatus === "ok" ||
          loginStatus === "error") && (
          <p
            aria-live="polite"
            className={`rounded-[18px] border px-3 py-2 text-xs font-medium ${statusToneClass}`}
          >
            {logoutStatus === "ok"
              ? "Erfolgreich abgemeldet."
              : (loginMessage ?? "Anmeldung fehlgeschlagen.")}
          </p>
        )}
      </div>
    </div>
  );
}
