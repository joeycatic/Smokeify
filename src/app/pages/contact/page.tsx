"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
          Contact
        </h1>
        <p className="text-sm text-stone-600 mb-12">
          Send a message and I will get back to you shortly.
        </p>

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
                  setError(data.error ?? "Message could not be sent.");
                  setStatus("error");
                  return;
                }
                form.reset();
                setStatus("ok");
                setTimeout(() => setStatus("idle"), 2000);
              } catch {
                setError("Message could not be sent.");
                setStatus("error");
              }
            }}
            className="space-y-4 rounded-xl border border-black/10 bg-white p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-600">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="mt-2 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600">
                Message
              </label>
              <textarea
                name="message"
                required
                rows={6}
                className="mt-2 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </div>
            {status === "ok" && (
              <p className="text-xs text-green-700">Message sent.</p>
            )}
            {status === "error" && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
