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
    <div>
      <p className="text-xs font-semibold tracking-widest text-white/80">
        NEWSLETTER
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
          className="h-10 w-full rounded-md bg-white/10 px-3 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/30"
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
          className="h-10 shrink-0 rounded-md bg-white px-4 text-sm font-semibold text-[#2f3e36] hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {newsletterStatus === "loading" ? "Senden..." : "Join"}
        </button>
      </form>
      <p className="mt-2 text-xs text-white/55">
        Kein Spam. Abmelden jederzeit möglich.
      </p>
      {newsletterMessage && (
        <p
          className={`mt-2 text-xs font-semibold ${
            newsletterStatus === "ok" ? "text-emerald-200" : "text-rose-200"
          }`}
        >
          {newsletterMessage}
        </p>
      )}
    </div>
  );
}
