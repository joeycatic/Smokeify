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
  const [loginStatus, setLoginStatus] = useState<"idle" | "ok" | "error">(
    "idle"
  );
  const router = useRouter();
  const searchParams = useSearchParams();

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
              Account
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Melde dich an oder erstelle ein Konto mit Passwort und
              Code-Verification.
            </p>
          </div>

          <section>
            <h2 className="text-xs font-semibold tracking-widest text-black/60 mb-3">
              LOGIN
            </h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setNotice("");
                setLoginStatus("idle");
                const res = await signIn("credentials", {
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
                  sessionStorage.setItem("smokeify_return_to", returnTo);
                  router.push(
                    `/auth/verify?email=${encodeURIComponent(
                      email
                    )}&returnTo=${encodeURIComponent(returnTo)}`
                  );
                  return;
                }
                setError("Login fehlgeschlagen. Bitte pruefe deine Daten.");
                setLoginStatus("error");
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
              {notice && <p className="text-xs text-green-700">{notice}</p>}
              {loginStatus === "ok" && (
                <p className="text-xs text-green-700">
                  Erfolgreich angemeldet.
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90"
              >
                Login
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

