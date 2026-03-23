"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_32%),linear-gradient(180deg,#040507_0%,#090d12_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.96),rgba(6,9,14,0.98))] shadow-[0_40px_160px_rgba(0,0,0,0.55)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
              Smokeify Admin
            </p>
            <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
              Protected control room
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              Re-enter your credentials to unlock the admin workspace. Customer
              sessions and social sign-ins do not open this area.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Access policy
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Only accounts with the <span className="font-semibold text-white">ADMIN</span>{" "}
                  role can continue.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Security
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Admin attempts are rate-limited and require direct credential
                  verification.
                </p>
              </div>
            </div>
          </section>

          <section className="p-8 lg:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-6">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Sign in
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Continue to <span className="text-slate-200">{returnTo}</span>
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Email or username
                  </span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-black/40"
                    placeholder="admin@smokeify.de"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Password
                  </span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-black/40"
                    placeholder="Enter your password"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Authenticator code
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-black/40"
                    placeholder="6-digit code if MFA is enabled"
                  />
                </label>

                <div className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Password re-entry policy
                  </span>
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                    Every admin entry requires fresh credentials. If MFA is enabled, the authenticator code is required as well.
                  </p>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <p>{error}</p>
                    {errorHint ? <p className="mt-2 text-xs text-red-200/80">{errorHint}</p> : null}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" className="border-slate-950/30 border-t-slate-950" />
                      Verifying
                    </span>
                  ) : (
                    "Unlock admin"
                  )}
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <Link href="/auth/reset" className="transition hover:text-slate-300">
                  Reset password
                </Link>
                <Link href="/" className="transition hover:text-slate-300">
                  Return to storefront
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
