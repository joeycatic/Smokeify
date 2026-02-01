"use client";

import { useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type EmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "return_confirmation"
  | "cancellation"
  | "newsletter";

type ItemRow = {
  id: string;
  name: string;
  quantity: string;
  total: string;
};

const makeItem = (): ItemRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: "",
  quantity: "1",
  total: "49.90",
});

const toCents = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
};

export default function AdminEmailTestingClient() {
  const [type, setType] = useState<EmailType>("confirmation");
  const [recipient, setRecipient] = useState("");
  const [orderId, setOrderId] = useState("TEST-ORDER-0001");
  const [currency, setCurrency] = useState("EUR");
  const [amountSubtotal, setAmountSubtotal] = useState("89.90");
  const [amountTax, setAmountTax] = useState("14.36");
  const [amountShipping, setAmountShipping] = useState("5.90");
  const [amountDiscount, setAmountDiscount] = useState("0");
  const [amountTotal, setAmountTotal] = useState("110.16");
  const [amountRefunded, setAmountRefunded] = useState("0");
  const [discountCode, setDiscountCode] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("DHL");
  const [trackingNumber, setTrackingNumber] = useState("00340434161000000000");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);
  const [newsletterSubject, setNewsletterSubject] = useState(
    "Neu bei Smokeify"
  );
  const [newsletterBody, setNewsletterBody] = useState(
    "Hallo,\n\nhier ist ein Test-Newsletter von Smokeify.\n\nViele Grüße,\nSmokeify-Team"
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const isNewsletter = type === "newsletter";
  const isShipping = type === "shipping";
  const isRefund = type === "refund";
  const canUseOrderInputs = !isNewsletter;

  const orderItemsValid = useMemo(() => {
    if (!canUseOrderInputs) return true;
    return items.some((item) => item.name.trim());
  }, [canUseOrderInputs, items]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, makeItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ItemRow, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const resetStatus = () => {
    setStatus("idle");
    setMessage("");
  };

  const submit = async () => {
    resetStatus();
    if (!recipient.trim()) {
      setStatus("error");
      setMessage("Bitte eine Empfänger-E-Mail angeben.");
      return;
    }
    if (isNewsletter) {
      if (!newsletterSubject.trim() || !newsletterBody.trim()) {
        setStatus("error");
        setMessage("Bitte Betreff und Inhalt für den Newsletter angeben.");
        return;
      }
    } else if (!orderItemsValid) {
      setStatus("error");
      setMessage("Bitte mindestens einen Artikel mit Namen angeben.");
      return;
    }

    const payload = isNewsletter
      ? {
          type,
          to: recipient.trim(),
          newsletter: {
            subject: newsletterSubject.trim(),
            body: newsletterBody.trim(),
          },
        }
      : {
          type,
          to: recipient.trim(),
          order: {
            id: orderId.trim() || "TEST-ORDER-0001",
            currency: currency.trim().toUpperCase() || "EUR",
            amountSubtotal: toCents(amountSubtotal),
            amountTax: toCents(amountTax),
            amountShipping: toCents(amountShipping),
            amountDiscount: toCents(amountDiscount),
            amountTotal: toCents(amountTotal),
            amountRefunded: toCents(amountRefunded),
            discountCode: discountCode.trim() || null,
            trackingCarrier: trackingCarrier.trim() || null,
            trackingNumber: trackingNumber.trim() || null,
            trackingUrl: trackingUrl.trim() || null,
            items: items
              .filter((item) => item.name.trim())
              .map((item) => ({
                name: item.name.trim(),
                quantity: Math.max(1, Number(item.quantity) || 1),
                totalAmount: toCents(item.total),
                currency: currency.trim().toUpperCase() || "EUR",
              })),
          },
        };

    setStatus("loading");
    try {
      const res = await fetch("/api/admin/email-testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Senden fehlgeschlagen.");
        return;
      }
      setStatus("ok");
      setMessage("Test-E-Mail wurde gesendet.");
    } catch {
      setStatus("error");
      setMessage("Senden fehlgeschlagen.");
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600/80">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "#2f3e36" }}>
            Email testing
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Sende Test-E-Mails mit Mock-Daten an eine Empfänger-Adresse.
          </p>
        </div>
        <AdminThemeToggle />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <div className="grid gap-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Empfänger
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="test@example.com"
                className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Email-Typ
              <select
                value={type}
                onChange={(event) => setType(event.target.value as EmailType)}
                className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
              >
                <option value="confirmation">Order confirmation</option>
                <option value="shipping">Shipping tracking</option>
                <option value="refund">Refund</option>
                <option value="return_confirmation">Return confirmation</option>
                <option value="cancellation">Cancellation</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </label>

            {isNewsletter ? (
              <>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Newsletter-Betreff
                  <input
                    value={newsletterSubject}
                    onChange={(event) => setNewsletterSubject(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Newsletter-Inhalt
                  <textarea
                    value={newsletterBody}
                    onChange={(event) => setNewsletterBody(event.target.value)}
                    rows={6}
                    className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Order-ID (Mock)
                  <input
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Währung
                    <input
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Rabattcode
                    <input
                      value={discountCode}
                      onChange={(event) => setDiscountCode(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Zwischensumme (EUR)
                    <input
                      value={amountSubtotal}
                      onChange={(event) => setAmountSubtotal(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Steuer (EUR)
                    <input
                      value={amountTax}
                      onChange={(event) => setAmountTax(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Versand (EUR)
                    <input
                      value={amountShipping}
                      onChange={(event) => setAmountShipping(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Rabatt (EUR)
                    <input
                      value={amountDiscount}
                      onChange={(event) => setAmountDiscount(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Gesamt (EUR)
                    <input
                      value={amountTotal}
                      onChange={(event) => setAmountTotal(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </label>
                  {isRefund ? (
                    <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Erstattet (EUR)
                      <input
                        value={amountRefunded}
                        onChange={(event) => setAmountRefunded(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                      />
                    </label>
                  ) : null}
                </div>

                {isShipping ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Carrier
                      <input
                        value={trackingCarrier}
                        onChange={(event) => setTrackingCarrier(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Tracking-Nr.
                      <input
                        value={trackingNumber}
                        onChange={(event) => setTrackingNumber(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Tracking-URL
                      <input
                        value={trackingUrl}
                        onChange={(event) => setTrackingUrl(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                      />
                    </label>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {!isNewsletter ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Artikel (Mock)
              </h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
              >
                + Artikel
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Item {index + 1}
                    </p>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                    <input
                      value={item.name}
                      onChange={(event) =>
                        handleItemChange(item.id, "name", event.target.value)
                      }
                      placeholder="Produktname"
                      className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                    <input
                      value={item.quantity}
                      onChange={(event) =>
                        handleItemChange(item.id, "quantity", event.target.value)
                      }
                      placeholder="Menge"
                      className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                    <input
                      value={item.total}
                      onChange={(event) =>
                        handleItemChange(item.id, "total", event.target.value)
                      }
                      placeholder="Summe (EUR)"
                      className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={status === "loading"}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500"
        >
          {status === "loading" ? "Sende..." : "Test-E-Mail senden"}
        </button>
        {status !== "idle" ? (
          <span
            className={`text-sm font-semibold ${
              status === "ok" ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
