"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "joey@smokeify.de";
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  return (
    <PageLayout>
      <div className="bg-[radial-gradient(120%_120%_at_70%_90%,#b8d39a_0%,#4f7b62_38%,#21443a_68%,#0f2924_100%)] px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h1 className="text-4xl font-semibold">Kontakt</h1>
            <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-white/80" />
            <p className="mt-4 text-sm text-white/80 sm:text-base">
              Schreib uns eine Nachricht und wir antworten dir per E-Mail.
            </p>
            <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 px-5 py-4 text-left text-sm text-white/85">
              <p className="font-semibold text-white">Direktkontakt</p>
              <p className="mt-1">E-Mail: {contactEmail}</p>
              {contactPhone ? <p>Telefon: {contactPhone}</p> : null}
              <p className="mt-1">
                Anschrift: Smokeify, Joey Bennett Catic, Brinkeweg 106a, 33758
                Schloß Holte-Stukenbrock, Deutschland
              </p>
            </div>
            <ul className="mt-4 inline-flex flex-col gap-2 text-sm text-white/80">
              {[
                "Schnelle & kompetente Antwort",
                "Support bei Fragen zu Produkten & Bestellungen",
                "Feedback & Anregungen",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-emerald-200">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 mx-auto max-w-4xl">
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
              className="rounded-3xl border border-white/10 bg-black/35 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-white/70">
                    Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70">
                    E-mail
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-white/70">
                  Nachricht
                </label>
                <textarea
                  name="message"
                  required
                  rows={6}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                />
              </div>
              {status === "ok" && (
                <p className="mt-3 text-xs text-emerald-200">
                  Nachricht gesendet.
                </p>
              )}
              {status === "error" && (
                <p className="mt-3 text-xs text-red-300">{error}</p>
              )}
              <div className="mt-5 flex justify-center">
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-full bg-white px-8 py-2.5 text-sm font-semibold text-[#21443a] shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition hover:bg-white/90 disabled:opacity-60"
                >
                  {status === "sending" ? "Sende..." : "Nachricht senden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
