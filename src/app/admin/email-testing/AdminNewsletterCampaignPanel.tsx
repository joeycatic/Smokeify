"use client";

import { useMemo, useState } from "react";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import { STOREFRONT_OPTION_ROWS, STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

type SendStatus = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type NewsletterAudienceSummary = {
  activeRecipientCount: number;
  unresolvedRecipientCount: number;
  byStorefront: Record<
    StorefrontCode,
    {
      attributedRecipientCount: number;
    }
  >;
};

export default function AdminNewsletterCampaignPanel({
  initialAudienceSummary,
  initialStorefront,
}: {
  initialAudienceSummary: NewsletterAudienceSummary;
  initialStorefront: StorefrontCode;
}) {
  const [storefront, setStorefront] = useState<StorefrontCode>(initialStorefront);
  const [testRecipient, setTestRecipient] = useState("");
  const [subject, setSubject] = useState(
    initialStorefront === "GROW" ? "Neu bei GrowVault" : "Neu bei Smokeify",
  );
  const [body, setBody] = useState(
    "Hallo,\n\nhier ist unser neuester Newsletter mit frischen Highlights, Angeboten und Empfehlungen.\n\nViele Grüße,\nDein Team",
  );
  const [testSending, setTestSending] = useState(false);
  const [campaignSending, setCampaignSending] = useState(false);
  const [status, setStatus] = useState<SendStatus>(null);

  const storefrontLabel = STOREFRONT_LABELS[storefront];
  const selectedAudienceCount =
    initialAudienceSummary.byStorefront[storefront].attributedRecipientCount;
  const validation = useMemo(
    () => ({
      subjectReady: Boolean(subject.trim()),
      bodyReady: Boolean(body.trim()),
      audienceReady: selectedAudienceCount > 0,
      testRecipientReady: Boolean(testRecipient.trim()),
    }),
    [body, selectedAudienceCount, subject, testRecipient],
  );

  const previewPayload = useMemo(
    () => ({
      storefront,
      storefrontLabel,
      subject: subject.trim(),
      body: body.trim(),
      activeAudienceCount: selectedAudienceCount,
      unresolvedRecipientCount: initialAudienceSummary.unresolvedRecipientCount,
    }),
    [body, initialAudienceSummary.unresolvedRecipientCount, selectedAudienceCount, storefront, storefrontLabel, subject],
  );

  const canSendCampaign =
    validation.subjectReady && validation.bodyReady && validation.audienceReady && !campaignSending;
  const canSendTest =
    validation.subjectReady && validation.bodyReady && validation.testRecipientReady && !testSending;

  const sendNewsletter = async (mode: "test" | "campaign") => {
    setStatus(null);

    if (mode === "campaign") {
      const confirmed = window.confirm(
        `Send this ${storefrontLabel} newsletter to ${selectedAudienceCount} attributed recipients?`,
      );
      if (!confirmed) return;
      setCampaignSending(true);
    } else {
      setTestSending(true);
    }

    try {
      const response = await fetch("/api/admin/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          storefront,
          recipient: testRecipient.trim(),
          subject,
          body,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            sentCount?: number;
            failedCount?: number;
            audienceCount?: number;
            unresolvedCount?: number;
          }
        | null;

      if (!response.ok) {
        setStatus({
          tone: "error",
          message: data?.error ?? "Newsletter send failed.",
        });
        return;
      }

      if (mode === "campaign") {
        const sentCount = data?.sentCount ?? 0;
        const failedCount = data?.failedCount ?? 0;
        setStatus({
          tone: failedCount > 0 ? "info" : "success",
          message:
            failedCount > 0
              ? `Campaign sent to ${sentCount} recipients. ${failedCount} failed.${data?.unresolvedCount ? ` ${data.unresolvedCount} unresolved recipient(s) were excluded.` : ""}`
              : `Campaign sent to ${sentCount} recipients.${data?.unresolvedCount ? ` ${data.unresolvedCount} unresolved recipient(s) were excluded.` : ""}`,
        });
        return;
      }

      setStatus({
        tone: "success",
        message: `Test newsletter sent to ${testRecipient.trim()}.`,
      });
    } catch {
      setStatus({
        tone: "error",
        message: "Newsletter send failed.",
      });
    } finally {
      setTestSending(false);
      setCampaignSending(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <AdminPanel
        eyebrow="Campaigns"
        title="Newsletter composer"
        description="Create a newsletter, choose the storefront branding, send yourself a test, then send the campaign to the active newsletter audience from admin."
        className="admin-reveal-delay-1"
      >
          <div className="grid gap-3 md:grid-cols-4">
            <AdminMetricCard label="Storefront" value={storefrontLabel} detail="Brand and links" />
          <AdminMetricCard label="Exact audience" value={String(selectedAudienceCount)} detail="Attributed recipients" />
          <AdminMetricCard label="Unresolved" value={String(initialAudienceSummary.unresolvedRecipientCount)} detail="Excluded from brand sends" />
          <AdminMetricCard label="Test target" value={testRecipient.trim() || "Unset"} detail="Preview recipient" />
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="Storefront">
              <AdminSelect
                value={storefront}
                onChange={(event) => {
                  const nextStorefront = event.target.value as StorefrontCode;
                  setStorefront(nextStorefront);
                  if (nextStorefront === "GROW" && subject === "Neu bei Smokeify") {
                    setSubject("Neu bei GrowVault");
                  }
                  if (nextStorefront === "MAIN" && subject === "Neu bei GrowVault") {
                    setSubject("Neu bei Smokeify");
                  }
                }}
              >
                {STOREFRONT_OPTION_ROWS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            <AdminField label="Test recipient" optional="for preview sends">
              <AdminInput
                type="email"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="you@example.com"
              />
            </AdminField>
          </div>

          <AdminField label="Subject">
            <AdminInput value={subject} onChange={(event) => setSubject(event.target.value)} />
          </AdminField>

          <AdminField label="Body">
            <AdminTextarea
              rows={10}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </AdminField>

          <AdminNotice
            tone={initialAudienceSummary.unresolvedRecipientCount > 0 ? "info" : "success"}
          >
            Newsletter campaigns now use storefront-attributed recipients only. {selectedAudienceCount}{" "}
            recipient(s) are currently eligible for {storefrontLabel}.
            {initialAudienceSummary.unresolvedRecipientCount > 0
              ? ` ${initialAudienceSummary.unresolvedRecipientCount} active recipient(s) still lack exact storefront attribution and are excluded instead of being guessed.`
              : ""}
          </AdminNotice>

          {status ? <AdminNotice tone={status.tone}>{status.message}</AdminNotice> : null}

          <div className="flex flex-wrap gap-2">
            <AdminButton onClick={() => void sendNewsletter("test")} disabled={!canSendTest}>
              {testSending ? "Sending test..." : "Send test newsletter"}
            </AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() => void sendNewsletter("campaign")}
              disabled={!canSendCampaign}
            >
              {campaignSending ? "Sending campaign..." : `Send to ${selectedAudienceCount} recipients`}
            </AdminButton>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        eyebrow="Preview"
        title="Campaign payload"
        description="Review the selected storefront and newsletter content before sending."
        className="admin-reveal-delay-2"
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Storefront notes
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {storefrontLabel} branding is active for this campaign. Links in the email will open the selected storefront.
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-4">
            <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-300">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Readiness
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                Subject: {validation.subjectReady ? "Ready" : "Missing"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                Body: {validation.bodyReady ? "Ready" : "Missing"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                Audience: {validation.audienceReady ? `${selectedAudienceCount} recipients` : "No recipients"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                Test: {validation.testRecipientReady ? "Recipient set" : "Recipient missing"}
              </div>
            </div>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
