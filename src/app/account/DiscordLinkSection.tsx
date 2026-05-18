"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type DiscordLinkResponse = {
  token: string;
  instruction: string;
  expiresAt: string;
};

export default function DiscordLinkSection() {
  const [discordUserId, setDiscordUserId] = useState("");
  const [challenge, setChallenge] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiscordLinkResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    setResult(null);
    setCopyStatus("idle");

    try {
      const response = await fetch("/api/account/discord-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordUserId,
          challenge,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | (DiscordLinkResponse & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !data || !("token" in data) || !data.token) {
        setError(data?.error ?? "Discord-Linking fehlgeschlagen.");
        setStatus("error");
        return;
      }

      setResult({
        token: data.token,
        instruction: data.instruction,
        expiresAt: data.expiresAt,
      });
      setStatus("success");
    } catch {
      setError("Discord-Linking fehlgeschlagen.");
      setStatus("error");
    }
  };

  const handleCopyToken = async () => {
    if (!result?.token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.token);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const inputClass =
    "smk-input w-full rounded-xl px-3 py-2.5 text-sm";
  const labelClass =
    "mb-1 block text-[11px] font-semibold tracking-wide text-[var(--smk-text-muted)]";

  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold tracking-widest text-[var(--smk-text-dim)]">
        DISCORD VERKNÜPFEN
      </p>
      <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
        <p className="text-sm font-semibold text-[var(--smk-text)]">
          Temporärer Discord-Link
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--smk-text-muted)]">
          Starte in Discord mit <span className="font-semibold">`/account connect provider:Smokeify`</span>,
          kopiere den Challenge-Code und trage ihn hier ein.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--smk-text-muted)]">
          Aktuell benötigt dieser manuelle Flow zusätzlich deine Discord User ID.
          Aktiviere dafür in Discord den Entwicklermodus und kopiere deine eigene User ID.
        </p>
        {/* TODO: Replace the manual Discord user ID + token copy/paste flow with a direct bot callback or OAuth handoff. */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="discord-user-id" className={labelClass}>
                Discord User ID *
              </label>
              <input
                id="discord-user-id"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={discordUserId}
                onChange={(event) => setDiscordUserId(event.target.value)}
                className={inputClass}
                placeholder="123456789012345678"
                required
              />
            </div>
            <div>
              <label htmlFor="discord-challenge" className={labelClass}>
                Challenge-Code *
              </label>
              <input
                id="discord-challenge"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={challenge}
                onChange={(event) => setChallenge(event.target.value.toUpperCase())}
                className={inputClass}
                placeholder="ABCD-EFGH"
                required
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {result && (
            <div className="space-y-3 rounded-[22px] border border-[rgba(127,207,150,0.28)] bg-[rgba(22,52,39,0.82)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Token bereit
              </p>
              <textarea
                readOnly
                value={result.token}
                className="min-h-28 w-full rounded-xl border border-[rgba(127,207,150,0.22)] bg-[rgba(18,16,14,0.82)] px-3 py-2 text-xs text-[var(--smk-text)] outline-none"
              />
              <p className="text-xs leading-5 text-[var(--smk-text-muted)]">
                {result.instruction}
              </p>
              <p className="text-xs text-[var(--smk-text-dim)]">
                Läuft ab: {new Date(result.expiresAt).toLocaleString("de-DE")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="smk-button-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold"
                >
                  Token kopieren
                </button>
                {copyStatus === "copied" && (
                  <span className="text-xs font-semibold text-emerald-700">
                    Token kopiert.
                  </span>
                )}
                {copyStatus === "error" && (
                  <span className="text-xs font-semibold text-red-700">
                    Kopieren fehlgeschlagen.
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="smk-button-primary h-11 w-full rounded-full px-4 text-sm font-semibold disabled:opacity-60 sm:h-12 sm:w-auto sm:text-base"
          >
            {status === "submitting" ? "Token wird erstellt..." : "Discord-Link Token erstellen"}
          </button>
        </form>
      </div>
    </div>
  );
}
