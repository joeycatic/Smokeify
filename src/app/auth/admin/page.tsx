"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowRightIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "@/components/LoadingSpinner";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Bitte bestätige zuerst dein Konto.",
  RATE_LIMIT: "Zu viele Anmeldeversuche. Bitte warte kurz und versuche es erneut.",
  AccessDenied: "Anmeldung nicht möglich.",
  CredentialsSignin: "E-Mail, Benutzername oder Passwort ist nicht korrekt.",
  ADMIN_MFA_REQUIRED:
    "Für diese Anmeldung wird ein Authenticator-Code benötigt.",
  INVALID_TOTP: "Der eingegebene Code konnte nicht bestätigt werden.",
};

function getAdminErrorMessage(code?: string | null) {
  if (!code) {
    return "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
  }

  return ADMIN_ERROR_MESSAGES[code] ?? "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
}

function SmokeifyField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
      <span>
        {label}
        {optional ? (
          <span className="ml-2 font-normal normal-case tracking-normal text-[var(--smk-text-muted)]">
            {optional}
          </span>
        ) : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SmokeifyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--smk-text)] outline-none transition placeholder:text-[var(--smk-text-dim)] focus:border-[rgba(241,198,132,0.34)] focus:bg-[rgba(255,255,255,0.06)] ${
        props.className ?? ""
      }`}
    />
  );
}

export default function AdminSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState(() =>
    searchError ? getAdminErrorMessage(searchError) : "",
  );
  const [loading, setLoading] = useState(false);

  const returnTo = useMemo(() => {
    const next = searchParams.get("returnTo");
    if (!next || !next.startsWith("/")) {
      return "/admin";
    }
    return next;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await signIn("credentials", {
        email,
        password,
        totpCode,
        adminIntent: "1",
        redirect: false,
        callbackUrl: returnTo,
      });

      if (response?.ok) {
        router.replace(returnTo);
        router.refresh();
        return;
      }

      setError(getAdminErrorMessage(response?.error));
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#140f0c_0%,#0b0908_100%)] text-[var(--smk-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(241,198,132,0.18),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(217,119,69,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_42%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,29rem)] lg:gap-6">
          <section className="overflow-hidden rounded-[34px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_10%_18%,rgba(241,198,132,0.18),transparent_26%),linear-gradient(135deg,rgba(31,25,20,0.98),rgba(13,11,10,0.98))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.38)] sm:p-8">
            <div className="max-w-xl">
              <p className="smk-kicker">Smokeify Intern</p>
              <h1 className="smk-heading mt-4 text-4xl leading-[0.95] text-[var(--smk-text)] sm:text-5xl">
                Geschützter
                <span className="smk-text-gradient block">Zugang für das Team.</span>
              </h1>
              <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                Melde dich mit deinem freigegebenen Konto an, um in den internen
                Bereich zu wechseln. Die Oberfläche bleibt bewusst knapp und
                zurückhaltend.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
                <ShieldCheckIcon className="h-5 w-5 text-[var(--smk-accent)]" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
                  Zugang
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--smk-text)]">
                  Nur für freigegebene Konten
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
                <LockClosedIcon className="h-5 w-5 text-[var(--smk-accent)]" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
                  Anmeldung
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--smk-text)]">
                  Konto und Passwort erneut eingeben
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
                <KeyIcon className="h-5 w-5 text-[var(--smk-accent)]" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
                  Bestätigung
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--smk-text)]">
                  Zusätzlicher Code nur bei aktivierter App
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[26px] border border-[rgba(241,198,132,0.16)] bg-[rgba(241,198,132,0.08)] px-5 py-4 text-sm text-[var(--smk-text-muted)]">
              <p className="font-semibold text-[var(--smk-text)]">Hinweis</p>
              <p className="mt-2 leading-6">
                Wenn dein Konto einen zusätzlichen Bestätigungscode verwendet,
                gib ihn nach Passwort und Benutzerkennung mit ein.
              </p>
            </div>
          </section>

          <section className="rounded-[34px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(24,20,17,0.96),rgba(13,11,10,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)] sm:p-7">
            <div>
              <p className="smk-kicker">Anmeldung</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                Intern einloggen
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
                Verwende deine internen Zugangsdaten. Der zusätzliche Code ist nur
                nötig, wenn dein Konto ihn nutzt.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <SmokeifyField label="E-Mail oder Benutzername">
                <SmokeifyInput
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="name@smokeify.de"
                />
              </SmokeifyField>

              <SmokeifyField label="Passwort">
                <SmokeifyInput
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Passwort eingeben"
                />
              </SmokeifyField>

              <SmokeifyField label="Authenticator-Code" optional="Optional">
                <SmokeifyInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                  }
                  placeholder="6-stelliger Code"
                />
              </SmokeifyField>

              {error ? (
                <div className="rounded-[22px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="smk-button-primary inline-flex h-12 w-full items-center justify-center rounded-[20px] px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="sm" className="border-[#1a140f]/25 border-t-[#1a140f]" />
                    Anmeldung wird geprüft
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Weiter
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.08)] pt-5 text-sm text-[var(--smk-text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <Link href="/auth/reset" className="transition hover:text-[var(--smk-text)]">
                Passwort zurücksetzen
              </Link>
              <Link href="/" className="transition hover:text-[var(--smk-text)]">
                Zurück zum Shop
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
