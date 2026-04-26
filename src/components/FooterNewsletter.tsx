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
    <div className="smk-surface rounded-[28px] p-5">
      <p className="smk-kicker">
        Newsletter
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
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
          className="smk-input h-11 w-full rounded-full px-4 text-sm"
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
          className="smk-button-primary h-11 shrink-0 rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {newsletterStatus === "loading" ? "Senden..." : "Join"}
        </button>
      </form>
      <p className="mt-3 text-xs text-[var(--smk-text-dim)]">
        Kein Spam. Abmelden jederzeit möglich.
      </p>
      {newsletterMessage && (
        <p
          className={`mt-2 text-xs font-semibold ${
            newsletterStatus === "ok"
              ? "text-[var(--smk-success)]"
              : "text-[var(--smk-error)]"
          }`}
        >
          {newsletterMessage}
        </p>
      )}
    </div>
  );
}
