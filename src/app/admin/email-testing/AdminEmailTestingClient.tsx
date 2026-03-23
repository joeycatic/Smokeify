"use client";

import { useMemo, useState } from "react";
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type EmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "return_confirmation"
  | "cancellation"
  | "newsletter"
  | "newsletter_confirmation"
  | "back_in_stock"
  | "checkout_recovery";

type ItemRow = {
  id: string;
  name: string;
  quantity: string;
  total: string;
};

const EMAIL_TYPE_LABELS: Record<EmailType, { title: string; subtitle: string }> = {
  confirmation: { title: "Order confirmation", subtitle: "Mock order confirmation payload" },
  shipping: { title: "Shipping", subtitle: "Tracking mail with carrier data" },
  refund: { title: "Refund", subtitle: "Refund amount and item payload" },
  return_confirmation: { title: "Return confirmation", subtitle: "Return request confirmation mail" },
  cancellation: { title: "Cancellation", subtitle: "Canceled order notification" },
  newsletter: { title: "Newsletter", subtitle: "Custom subject/body send test" },
  newsletter_confirmation: { title: "Newsletter opt-in", subtitle: "Subscription confirmation mail" },
  back_in_stock: { title: "Back in stock", subtitle: "Product reavailability alert" },
  checkout_recovery: { title: "Checkout recovery", subtitle: "Recovery mail with mock session id" },
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
  const [amountShipping, setAmountShipping] = useState("6.90");
  const [amountDiscount, setAmountDiscount] = useState("0");
  const [amountTotal, setAmountTotal] = useState("110.16");
  const [amountRefunded, setAmountRefunded] = useState("0");
  const [discountCode, setDiscountCode] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("DHL");
  const [trackingNumber, setTrackingNumber] = useState("00340434161000000000");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);
  const [newsletterSubject, setNewsletterSubject] = useState("Neu bei Smokeify");
  const [newsletterBody, setNewsletterBody] = useState(
    "Hallo,\n\nhier ist ein Test-Newsletter von Smokeify.\n\nViele Grüße,\nSmokeify-Team"
  );
  const [productTitle, setProductTitle] = useState("Beispiel-Shisha");
  const [variantTitle, setVariantTitle] = useState("Schwarz / Medium");
  const [sessionId, setSessionId] = useState("cs_test_XXXXXXXXXXXXXXXX");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const isNewsletter = type === "newsletter";
  const isNewsletterConfirmation = type === "newsletter_confirmation";
  const isBackInStock = type === "back_in_stock";
  const isCheckoutRecovery = type === "checkout_recovery";
  const isShipping = type === "shipping";
  const isRefund = type === "refund";
  const isOrderEmail =
    type === "confirmation" ||
    type === "shipping" ||
    type === "refund" ||
    type === "return_confirmation" ||
    type === "cancellation";

  const orderItemsValid = useMemo(() => {
    if (!isOrderEmail) return true;
    return items.some((item) => item.name.trim());
  }, [isOrderEmail, items]);

  const payloadPreview = useMemo(() => {
    if (isNewsletter) {
      return {
        type,
        to: recipient.trim(),
        subject: newsletterSubject.trim(),
        body: newsletterBody.trim(),
      };
    }
    if (isNewsletterConfirmation) {
      return { type, to: recipient.trim() };
    }
    if (isBackInStock) {
      return {
        type,
        to: recipient.trim(),
        productTitle: productTitle.trim(),
        variantTitle: variantTitle.trim(),
      };
    }
    if (isCheckoutRecovery) {
      return {
        type,
        to: recipient.trim(),
        sessionId: sessionId.trim(),
      };
    }
    return {
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
  }, [
    amountDiscount,
    amountRefunded,
    amountShipping,
    amountSubtotal,
    amountTax,
    amountTotal,
    currency,
    discountCode,
    isBackInStock,
    isCheckoutRecovery,
    isNewsletter,
    isNewsletterConfirmation,
    items,
    newsletterBody,
    newsletterSubject,
    orderId,
    productTitle,
    recipient,
    sessionId,
    trackingCarrier,
    trackingNumber,
    trackingUrl,
    type,
    variantTitle,
  ]);

  const handleAddItem = () => setItems((prev) => [...prev, makeItem()]);
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };
  const handleItemChange = (id: string, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const resetStatus = () => {
    setStatus("idle");
    setMessage("");
  };

  const submit = async () => {
    resetStatus();
    if (!recipient.trim()) {
      setStatus("error");
      setMessage("Enter a recipient email.");
      return;
    }
    if (isNewsletter) {
      if (!newsletterSubject.trim() || !newsletterBody.trim()) {
        setStatus("error");
        setMessage("Enter a newsletter subject and body.");
        return;
      }
    } else if (!isNewsletterConfirmation && !isBackInStock && !isCheckoutRecovery && !orderItemsValid) {
      setStatus("error");
      setMessage("Add at least one item with a name.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/admin/email-testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadPreview),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Send failed.");
        return;
      }
      setStatus("ok");
      setMessage("Test email sent.");
    } catch {
      setStatus("error");
      setMessage("Send failed.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Email Testing"
        title="Email QA workbench"
        description="Test transactional, newsletter, and recovery emails from a dedicated dark lab surface with mock payload controls and a live payload summary."
        metrics={
          <div className="grid gap-3 md:grid-cols-4">
            <AdminMetricCard label="Templates" value="9" detail="Supported testable flows" />
            <AdminMetricCard label="Selected type" value={EMAIL_TYPE_LABELS[type].title} detail="Active configuration" />
            <AdminMetricCard label="Items" value={String(items.length)} detail="Mock line items" />
            <AdminMetricCard label="Recipient" value={recipient.trim() || "Unset"} detail="Current target" />
          </div>
        }
      />

      {status === "ok" ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {status === "error" ? <AdminNotice tone="error">{message}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          eyebrow="Configure"
          title="Email type and payload"
          description="Pick an email type, then configure only the payload fields relevant to that template."
          className="admin-reveal-delay-1"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.entries(EMAIL_TYPE_LABELS) as Array<[EmailType, { title: string; subtitle: string }]>).map(
              ([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    type === key
                      ? "border-cyan-400/20 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="font-semibold text-white">{value.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{value.subtitle}</div>
                </button>
              )
            )}
          </div>

          <div className="mt-5 grid gap-4">
            <AdminField label="Recipient">
              <AdminInput
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="test@example.com"
              />
            </AdminField>

            {isNewsletter ? (
              <>
                <AdminField label="Subject">
                  <AdminInput
                    value={newsletterSubject}
                    onChange={(event) => setNewsletterSubject(event.target.value)}
                  />
                </AdminField>
                <AdminField label="Body">
                  <AdminTextarea
                    rows={8}
                    value={newsletterBody}
                    onChange={(event) => setNewsletterBody(event.target.value)}
                  />
                </AdminField>
              </>
            ) : isNewsletterConfirmation ? (
              <AdminNotice tone="info">
                This sends the newsletter double opt-in confirmation to the selected recipient.
              </AdminNotice>
            ) : isBackInStock ? (
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Product title">
                  <AdminInput
                    value={productTitle}
                    onChange={(event) => setProductTitle(event.target.value)}
                  />
                </AdminField>
                <AdminField label="Variant title" optional="optional">
                  <AdminInput
                    value={variantTitle}
                    onChange={(event) => setVariantTitle(event.target.value)}
                  />
                </AdminField>
              </div>
            ) : isCheckoutRecovery ? (
              <AdminField label="Mock session id">
                <AdminInput
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                />
              </AdminField>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Mock order id">
                    <AdminInput
                      value={orderId}
                      onChange={(event) => setOrderId(event.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Currency">
                    <AdminInput
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    />
                  </AdminField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Subtotal">
                    <AdminInput
                      value={amountSubtotal}
                      onChange={(event) => setAmountSubtotal(event.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Tax">
                    <AdminInput
                      value={amountTax}
                      onChange={(event) => setAmountTax(event.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Shipping">
                    <AdminInput
                      value={amountShipping}
                      onChange={(event) => setAmountShipping(event.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Discount">
                    <AdminInput
                      value={amountDiscount}
                      onChange={(event) => setAmountDiscount(event.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Total">
                    <AdminInput
                      value={amountTotal}
                      onChange={(event) => setAmountTotal(event.target.value)}
                    />
                  </AdminField>
                  {isRefund ? (
                    <AdminField label="Refunded">
                      <AdminInput
                        value={amountRefunded}
                        onChange={(event) => setAmountRefunded(event.target.value)}
                      />
                    </AdminField>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Discount code" optional="optional">
                    <AdminInput
                      value={discountCode}
                      onChange={(event) => setDiscountCode(event.target.value)}
                    />
                  </AdminField>
                  {isShipping ? (
                    <AdminField label="Carrier">
                      <AdminInput
                        value={trackingCarrier}
                        onChange={(event) => setTrackingCarrier(event.target.value)}
                      />
                    </AdminField>
                  ) : null}
                  {isShipping ? (
                    <AdminField label="Tracking number">
                      <AdminInput
                        value={trackingNumber}
                        onChange={(event) => setTrackingNumber(event.target.value)}
                      />
                    </AdminField>
                  ) : null}
                  {isShipping ? (
                    <AdminField label="Tracking URL" optional="optional">
                      <AdminInput
                        value={trackingUrl}
                        onChange={(event) => setTrackingUrl(event.target.value)}
                      />
                    </AdminField>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel
            eyebrow="Preview"
            title="Payload summary"
            description="Live preview of the payload that will be sent to the email testing API."
            className="admin-reveal-delay-2"
          >
            <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-4">
              <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-300">
                {JSON.stringify(payloadPreview, null, 2)}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton onClick={() => void submit()} disabled={status === "loading"}>
                {status === "loading" ? "Sending..." : "Send test email"}
              </AdminButton>
              <AdminButton tone="secondary" onClick={resetStatus}>
                Reset status
              </AdminButton>
            </div>
          </AdminPanel>

          {isOrderEmail ? (
            <AdminPanel
              eyebrow="Mock Items"
              title="Line item builder"
              description="Build a compact mock order item list for transactional email tests."
            >
              <div className="mb-4 flex justify-end">
                <AdminButton tone="secondary" onClick={handleAddItem}>
                  Add item
                </AdminButton>
              </div>
              {items.length === 0 ? (
                <AdminEmptyState
                  title="No items"
                  description="Add an item to build the mock order payload."
                />
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-[#070a0f] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Item {index + 1}
                        </div>
                        {items.length > 1 ? (
                          <AdminButton tone="danger" onClick={() => handleRemoveItem(item.id)}>
                            Remove
                          </AdminButton>
                        ) : null}
                      </div>
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                        <AdminInput
                          value={item.name}
                          onChange={(event) => handleItemChange(item.id, "name", event.target.value)}
                          placeholder="Product name"
                        />
                        <AdminInput
                          value={item.quantity}
                          onChange={(event) => handleItemChange(item.id, "quantity", event.target.value)}
                          placeholder="Qty"
                        />
                        <AdminInput
                          value={item.total}
                          onChange={(event) => handleItemChange(item.id, "total", event.target.value)}
                          placeholder="Total"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
