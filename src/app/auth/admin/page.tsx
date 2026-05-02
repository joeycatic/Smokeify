"use client";

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
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
} from "@/components/admin/AdminWorkspace";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Verify the account email before requesting admin access.",
  RATE_LIMIT: "Too many attempts. Admin login is temporarily rate-limited.",
  AccessDenied: "Admin access is restricted to admin accounts.",
  CredentialsSignin: "Invalid email or password.",
  ADMIN_MFA_REQUIRED:
    "This admin account requires an authenticator code after password verification.",
  INVALID_TOTP: "The authenticator code is invalid or has expired.",
};

function getAdminErrorMessage(code?: string | null) {
  if (!code) {
    return "Admin sign-in failed. Check your credentials and try again.";
  }

  return ADMIN_ERROR_MESSAGES[code] ?? "Admin sign-in failed. Check your credentials and try again.";
}

export default function AdminSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState(() => getAdminErrorMessage(searchParams.get("error")));
  const [errorHint, setErrorHint] = useState("");
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
    setErrorHint("");

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
      if (response?.error === "RATE_LIMIT") {
        setErrorHint("Current admin limit: 4 attempts per identifier, 5 per IP, 3 per IP+identifier within 15 minutes.");
      } else if (response?.error === "ADMIN_MFA_REQUIRED") {
        setErrorHint("Enter the 6-digit code from your authenticator app to continue.");
      } else if (response?.error === "INVALID_TOTP") {
        setErrorHint("Codes rotate every 30 seconds. Wait for a fresh code and retry.");
      } else if (response?.error === "CredentialsSignin") {
        setErrorHint("Password re-entry is mandatory for admin access, even with an existing session.");
      }
    } catch {
      setError("Admin sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-shell min-h-screen overflow-x-hidden bg-[#05070a] text-slate-100">
      <div className="admin-shell__backdrop" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,30rem)] lg:gap-6">
          <section className="admin-reveal overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(12,18,30,0.98),rgba(7,10,16,0.98))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.38)] sm:rounded-[32px] sm:p-7">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                Smokeify Admin
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Secure admin access
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Re-authenticate before entering the control layer. Access stays limited to admin accounts and requires current credentials.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <ShieldCheckIcon className="h-5 w-5 text-cyan-300" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Target
                </p>
                <p className="mt-2 text-sm font-medium text-white">{returnTo}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <LockClosedIcon className="h-5 w-5 text-cyan-300" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Password
                </p>
                <p className="mt-2 text-sm font-medium text-white">Fresh re-entry required</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <KeyIcon className="h-5 w-5 text-cyan-300" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  MFA
                </p>
                <p className="mt-2 text-sm font-medium text-white">6-digit code when enabled</p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-cyan-400/15 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-100">
              <p className="font-semibold text-white">Admin rules</p>
              <p className="mt-2 leading-6 text-cyan-50/80">
                Failed attempts are rate-limited. Authenticator codes rotate every 30 seconds. Existing storefront sessions do not bypass admin re-checks.
              </p>
            </div>
          </section>

          <section className="admin-reveal admin-reveal-delay-1 rounded-[28px] border border-white/10 bg-[#090d12]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] sm:rounded-[32px] sm:p-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Sign in
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Admin login</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use your admin account and add an authenticator code only if this account requires MFA.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <AdminField label="Email or username">
                <AdminInput
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="admin@smokeify.de"
                />
              </AdminField>

              <AdminField label="Password">
                <AdminInput
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </AdminField>

              <AdminField label="Authenticator code" optional="Optional">
                <AdminInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                />
              </AdminField>

              {error ? (
                <AdminNotice tone="error">
                  <p>{error}</p>
                  {errorHint ? <p className="mt-2 text-xs text-red-100/80">{errorHint}</p> : null}
                </AdminNotice>
              ) : null}

              <AdminButton
                type="submit"
                tone="primary"
                disabled={loading}
                className="h-11 w-full rounded-2xl"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="sm" className="border-slate-900/20 border-t-slate-900" />
                    Verifying
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Continue
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                )}
              </AdminButton>
            </form>

            <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/auth/reset" className="transition hover:text-white">
                Reset password
              </Link>
              <Link href="/" className="transition hover:text-white">
                Return to storefront
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
