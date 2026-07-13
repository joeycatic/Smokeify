"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

export default function FooterNewsletter() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(
    null
  );

  return (
    <div className="w-full max-w-[500px]">
      <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
        Newsletter
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch"
        onSubmit={async (event) => {
          event.preventDefault();
          const email = newsletterEmail.trim();
          if (!email) {
            setNewsletterStatus("error");
            setNewsletterMessage("Bitte E-Mail eingeben.");
            return;
          }
          setNewsletterStatus("loading");
          setNewsletterMessage(null);
          try {
            const res = await fetch("/api/newsletter/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              setNewsletterStatus("error");
              setNewsletterMessage(data?.error ?? "Anmeldung fehlgeschlagen.");
              return;
            }
            setNewsletterStatus("ok");
            setNewsletterMessage("Danke! Du bist eingetragen.");
            setNewsletterEmail("");
            trackAnalyticsEvent("generate_lead", { method: "newsletter" });
          } catch {
            setNewsletterStatus("error");
            setNewsletterMessage("Anmeldung fehlgeschlagen.");
          }
        }}
      >
        <input
          className="gv-input h-[3.25rem] min-h-[3.25rem] w-full min-w-0 flex-1 appearance-none rounded-2xl px-4 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15 sm:h-11 sm:min-h-11"
          placeholder="E-Mail"
          value={newsletterEmail}
          onChange={(event) => setNewsletterEmail(event.target.value)}
          type="email"
          name="email"
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={newsletterStatus === "loading"}
          className="gv-pulse h-13 shrink-0 rounded-2xl bg-[color:var(--gv-lime)] px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:min-w-[138px]"
        >
          {newsletterStatus === "loading" ? "Senden..." : "Eintragen"}
        </button>
      </form>
      <p className="mt-2 text-xs text-[color:var(--gv-text-muted)]">
        Kein Spam. Abmelden jederzeit möglich.
      </p>
      {newsletterMessage && (
        <p
          className={`mt-2 text-xs font-semibold ${
            newsletterStatus === "ok"
              ? "text-[color:var(--gv-success)]"
              : "text-[color:var(--gv-error)]"
          }`}
        >
          {newsletterMessage}
        </p>
      )}
    </div>
  );
}
