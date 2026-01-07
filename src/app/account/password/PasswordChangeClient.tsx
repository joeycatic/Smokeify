"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordChangeClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);

  const strength = (() => {
    if (!newPassword) {
      return { score: 0, label: "Bitte Passwort eingeben." };
    }
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const lengthOk = newPassword.length >= 8;
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
  const canLogin = strength.score >= 3 && hasSymbol;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError("");

    if (!currentPassword || !newPassword) {
      setError("Bitte alle Felder ausfuellen.");
      setStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein.");
      setStatus("error");
      return;
    }
    if (!hasSymbol) {
      setError("Passwort braucht mindestens ein Symbol.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        setStatus("error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Update failed");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-stone-600">
          Aktuelles Passwort *
        </label>
        <button
          type="button"
          onClick={() => setShowPasswords((prev) => !prev)}
          className="inline-flex items-center text-stone-600 hover:text-stone-800"
          aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
        >
          {showPasswords ? (
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
      <input
        type={showPasswords ? "text" : "password"}
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
      <label className="block text-xs font-semibold text-stone-600">
        Neues Passwort *
      </label>
      <input
        type={showPasswords ? "text" : "password"}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
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
          <span>Passwort-Stärke: {strength.label}</span>
          <span className={canLogin ? "text-green-600" : "text-red-600"}>
            {canLogin ? "OK" : "X"}
          </span>
        </div>
      </div>
      <label className="block text-xs font-semibold text-stone-600">
        Neues Passwort wiederholen *
      </label>
      <input
        type={showPasswords ? "text" : "password"}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {status === "ok" && <p className="text-xs text-green-700">Updated.</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Passwort ändern"}
      </button>
      <button
        type="button"
        onClick={() => router.push("/account")}
        className="h-12 w-full rounded-md border border-black/10 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
      >
        Zurück
      </button>
    </form>
  );
}
