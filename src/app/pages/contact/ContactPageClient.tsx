"use client";

import { useState } from "react";

type Props = {
  contactEmail: string;
  contactPhone: string;
  legalBusinessName: string;
};

export default function ContactPageClient({
  contactEmail,
  contactPhone,
  legalBusinessName,
}: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  return (
    <main className="mx-auto w-full max-w-[1100px] py-10">
      <section className="smk-panel relative overflow-hidden rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute left-0 top-0 h-44 w-44 -translate-x-10 -translate-y-10 rounded-full bg-[color:var(--smk-accent-2)]/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-52 w-52 translate-x-10 translate-y-10 rounded-full bg-[color:var(--smk-accent)]/10 blur-3xl" />
        <div className="relative text-center">
          <span className="smk-chip">Kontakt</span>
          <h1 className="mt-5 font-[family:var(--font-fraunces)] text-4xl font-bold tracking-[-0.07em] text-[color:var(--smk-text)] sm:text-5xl">
            Kontakt
          </h1>
          <p className="mt-4 text-sm text-[color:var(--smk-text-muted)] sm:text-base">
            Schreib uns eine Nachricht und wir antworten dir per E-Mail.
          </p>
          <p className="mt-3 text-sm text-[color:var(--smk-text-muted)]">
            Smokeify ist die Shop-Marke. Rechtlicher Betreiber dieses
            Onlineshops ist {legalBusinessName}.
          </p>
          <div className="mx-auto mt-6 max-w-xl smk-surface rounded-[24px] px-5 py-4 text-left text-sm text-[color:var(--smk-text-muted)]">
            <p className="font-semibold text-[color:var(--smk-text)]">
              Direktkontakt
            </p>
            <p className="mt-1">E-Mail: {contactEmail}</p>
            {contactPhone ? <p>Telefon: {contactPhone}</p> : null}
          </div>
          <ul className="mt-5 inline-flex flex-col gap-2 text-sm text-[color:var(--smk-text-muted)]">
            {[
              "Schnelle & kompetente Antwort",
              "Support bei Fragen zu Produkten & Bestellungen",
              "Feedback & Anregungen",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-[color:var(--smk-accent)]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 smk-panel rounded-[34px] px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus("sending");
              setError("");
              const form = event.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              const payload = {
                name: String(formData.get("name") ?? ""),
                email: String(formData.get("email") ?? ""),
                message: String(formData.get("message") ?? ""),
              };
              try {
                const res = await fetch("/api/contact", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  const data = (await res.json()) as { error?: string };
                  setError(data.error ?? "Nachricht konnte nicht gesendet werden.");
                  setStatus("error");
                  return;
                }
                form.reset();
                setStatus("ok");
                setTimeout(() => setStatus("idle"), 2000);
              } catch {
                setError("Nachricht konnte nicht gesendet werden.");
                setStatus("error");
              }
            }}
            className="grid gap-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--smk-text-dim)]">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="smk-input mt-2 h-12 w-full rounded-[18px] px-4 text-sm outline-none focus:border-[var(--smk-border-strong)] focus:ring-2 focus:ring-[rgba(233,188,116,0.12)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--smk-text-dim)]">
                  E-Mail
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="smk-input mt-2 h-12 w-full rounded-[18px] px-4 text-sm outline-none focus:border-[var(--smk-border-strong)] focus:ring-2 focus:ring-[rgba(233,188,116,0.12)]"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--smk-text-dim)]">
                Nachricht
              </label>
              <textarea
                name="message"
                required
                rows={6}
                className="smk-input mt-2 w-full rounded-[18px] px-4 py-3 text-sm outline-none focus:border-[var(--smk-border-strong)] focus:ring-2 focus:ring-[rgba(233,188,116,0.12)]"
              />
            </div>
            {status === "ok" && (
              <p className="mt-3 rounded-[18px] border border-[color:var(--smk-accent)]/18 bg-[color:var(--smk-accent)]/10 px-4 py-3 text-sm text-[color:var(--smk-text)]">
                Nachricht gesendet.
              </p>
            )}
            {status === "error" && (
              <p className="mt-3 rounded-[18px] border border-red-400/18 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-center">
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-full bg-[color:var(--smk-accent)] px-8 py-3 text-sm font-semibold text-[color:var(--smk-bg)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
              >
                {status === "sending" ? "Sende..." : "Nachricht senden"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
