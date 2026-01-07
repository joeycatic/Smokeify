"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function PasswordResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "sending" | "sent" | "limited" | "error"
  >("idle");
  const [saving, setSaving] = useState(false);

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#2f3e36" }}
            >
              Passwort zurücksetzen
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Wir senden dir einen Code, mit dem du dein Passwort ändern kannst.
            </p>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setNotice("");
              if (newPassword !== confirmPassword) {
                setError("Passwoerter stimmen nicht ueberein.");
                return;
              }
              setSaving(true);
              try {
                const res = await fetch("/api/auth/password-reset/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, code, newPassword }),
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    setError(
                      "Zu viele Versuche. Bitte später erneut versuchen."
                    );
                    return;
                  }
                  const data = (await res.json()) as { error?: string };
                  setError(data.error ?? "Zurücksetzen fehlgeschlagen.");
                  return;
                }
                setNotice("Passwort aktualisiert. Bitte einloggen.");
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-3"
          >
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
            <button
              type="button"
              disabled={requestStatus === "sending"}
              onClick={async () => {
                setError("");
                setNotice("");
                if (!email) {
                  setError("Bitte Email eingeben.");
                  return;
                }
                setRequestStatus("sending");
                try {
                  const res = await fetch("/api/auth/password-reset/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  if (res.status === 429) {
                    setRequestStatus("limited");
                    return;
                  }
                  if (!res.ok) {
                    setRequestStatus("error");
                    return;
                  }
                  setRequestStatus("sent");
                } catch {
                  setRequestStatus("error");
                }
              }}
              className="h-11 w-full rounded-md border border-black/20 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90 disabled:opacity-60"
            >
              Code senden
            </button>

            <label className="block text-xs font-semibold text-stone-600">
              Code *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Neues Passwort *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Passwort bestätigen *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />

            {requestStatus === "sent" && (
              <p className="text-xs text-green-700">Code wurde gesendet.</p>
            )}
            {requestStatus === "limited" && (
              <p className="text-xs text-red-600">
                Zu viele Anfragen. Bitte später erneut versuchen.
              </p>
            )}
            {requestStatus === "error" && (
              <p className="text-xs text-red-600">
                Code konnte nicht gesendet werden.
              </p>
            )}
            {notice && <p className="text-xs text-green-700">{notice}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Bitte warten..." : "Passwort aktualisieren"}
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  email
                    ? `/auth/signin?email=${encodeURIComponent(email)}`
                    : "/auth/signin"
                )
              }
              className="h-12 w-full rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
            >
              Zurück zum login
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
