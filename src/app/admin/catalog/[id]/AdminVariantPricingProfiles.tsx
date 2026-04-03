"use client";

import { useMemo, useState } from "react";
import {
  AdminButton,
  AdminDrawer,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import {
  PRICING_PRODUCT_SEGMENTS,
  type PricingProductSegment,
  type VariantPricingProfileRecord,
} from "@/lib/adminPricingIntegration";

type VariantSummary = {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
};

type Props = {
  variants: VariantSummary[];
  pricingProfilesByVariantId: Record<string, VariantPricingProfileRecord>;
  pricingIntegrationError?: string | null;
};

type PricingProfileFormState = {
  supplierShippingCostCents: string;
  inboundShippingCostCents: string;
  packagingCostCents: string;
  handlingCostCents: string;
  paymentFeePercentBasisPoints: string;
  paymentFixedFeeCents: string;
  returnRiskBufferBasisPoints: string;
  targetMarginBasisPoints: string;
  competitorMinPriceCents: string;
  competitorAveragePriceCents: string;
  competitorObservedAt: string;
  competitorSourceLabel: string;
  competitorSourceCount: string;
  competitorReliabilityScore: string;
  productSegment: PricingProductSegment;
  autoRepriceEnabled: boolean;
};

const formatCurrency = (amountCents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "n/a";

const toInputString = (value: number | null) => (value === null ? "" : String(value));

const toDateTimeLocalValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const buildFormState = (record: VariantPricingProfileRecord): PricingProfileFormState => ({
  supplierShippingCostCents: toInputString(
    record.pricingProfile.supplierShippingCostCents
  ),
  inboundShippingCostCents: toInputString(record.pricingProfile.inboundShippingCostCents),
  packagingCostCents: toInputString(record.pricingProfile.packagingCostCents),
  handlingCostCents: toInputString(record.pricingProfile.handlingCostCents),
  paymentFeePercentBasisPoints: toInputString(
    record.pricingProfile.paymentFeePercentBasisPoints
  ),
  paymentFixedFeeCents: toInputString(record.pricingProfile.paymentFixedFeeCents),
  returnRiskBufferBasisPoints: toInputString(
    record.pricingProfile.returnRiskBufferBasisPoints
  ),
  targetMarginBasisPoints: toInputString(record.pricingProfile.targetMarginBasisPoints),
  competitorMinPriceCents: toInputString(record.pricingProfile.competitorMinPriceCents),
  competitorAveragePriceCents: toInputString(
    record.pricingProfile.competitorAveragePriceCents
  ),
  competitorObservedAt: toDateTimeLocalValue(record.pricingProfile.competitorObservedAt),
  competitorSourceLabel: record.pricingProfile.competitorSourceLabel ?? "",
  competitorSourceCount: toInputString(record.pricingProfile.competitorSourceCount),
  competitorReliabilityScore: toInputString(
    record.pricingProfile.competitorReliabilityScore
  ),
  productSegment: record.pricingProfile.productSegment,
  autoRepriceEnabled: record.pricingProfile.autoRepriceEnabled,
});

const parseOptionalInteger = (value: string, label: string) => {
  if (!value.trim()) return { value: null, error: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { value: null, error: `${label} must be an integer.` };
  }
  return { value: parsed, error: null };
};

const parseOptionalNumber = (value: string, label: string) => {
  if (!value.trim()) return { value: null, error: null };
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${label} must be numeric.` };
  }
  return { value: parsed, error: null };
};

export default function AdminVariantPricingProfiles({
  variants,
  pricingProfilesByVariantId,
  pricingIntegrationError,
}: Props) {
  const [recordsByVariantId, setRecordsByVariantId] = useState(pricingProfilesByVariantId);
  const [formByVariantId, setFormByVariantId] = useState<Record<string, PricingProfileFormState>>(
    () =>
      Object.fromEntries(
        Object.entries(pricingProfilesByVariantId).map(([variantId, record]) => [
          variantId,
          buildFormState(record),
        ])
      )
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRecord = selectedVariantId ? recordsByVariantId[selectedVariantId] ?? null : null;
  const selectedForm =
    selectedVariantId && formByVariantId[selectedVariantId]
      ? formByVariantId[selectedVariantId]
      : null;

  const missingVariantCount = useMemo(
    () => variants.filter((variant) => !recordsByVariantId[variant.id]).length,
    [recordsByVariantId, variants]
  );

  const updateField = <Key extends keyof PricingProfileFormState>(
    variantId: string,
    key: Key,
    value: PricingProfileFormState[Key]
  ) => {
    const existingRecord = recordsByVariantId[variantId];
    setFormByVariantId((prev) => ({
      ...prev,
      [variantId]: {
        ...(prev[variantId] ??
          (existingRecord
            ? buildFormState(existingRecord)
            : {
                supplierShippingCostCents: "",
                inboundShippingCostCents: "",
                packagingCostCents: "",
                handlingCostCents: "",
                paymentFeePercentBasisPoints: "",
                paymentFixedFeeCents: "",
                returnRiskBufferBasisPoints: "",
                targetMarginBasisPoints: "",
                competitorMinPriceCents: "",
                competitorAveragePriceCents: "",
                competitorObservedAt: "",
                competitorSourceLabel: "",
                competitorSourceCount: "",
                competitorReliabilityScore: "",
                productSegment: "CORE",
                autoRepriceEnabled: true,
              })),
        [key]: value,
      },
    }));
  };

  const saveVariantProfile = async (variantId: string) => {
    const record = recordsByVariantId[variantId];
    const form = formByVariantId[variantId];
    if (!record || !form) return;

    setSavingVariantId(variantId);
    setMessage("");
    setError("");

    const integerFields = [
      ["supplierShippingCostCents", "Supplier shipping cost"],
      ["inboundShippingCostCents", "Inbound shipping cost"],
      ["packagingCostCents", "Packaging cost"],
      ["handlingCostCents", "Handling cost"],
      ["paymentFeePercentBasisPoints", "Payment fee percent"],
      ["paymentFixedFeeCents", "Payment fixed fee"],
      ["returnRiskBufferBasisPoints", "Return risk buffer"],
      ["targetMarginBasisPoints", "Target margin"],
      ["competitorMinPriceCents", "Competitor minimum price"],
      ["competitorAveragePriceCents", "Competitor average price"],
      ["competitorSourceCount", "Competitor source count"],
    ] as const;

    const payload: Record<string, unknown> = {
      productSegment: form.productSegment,
      autoRepriceEnabled: form.autoRepriceEnabled,
      competitorSourceLabel: form.competitorSourceLabel.trim() || null,
      competitorObservedAt: form.competitorObservedAt
        ? new Date(form.competitorObservedAt).toISOString()
        : null,
    };

    for (const [key, label] of integerFields) {
      const result = parseOptionalInteger(form[key], label);
      if (result.error) {
        setError(result.error);
        setSavingVariantId(null);
        return;
      }
      payload[key] = result.value;
    }

    const reliabilityResult = parseOptionalNumber(
      form.competitorReliabilityScore,
      "Competitor reliability score"
    );
    if (reliabilityResult.error) {
      setError(reliabilityResult.error);
      setSavingVariantId(null);
      return;
    }
    payload.competitorReliabilityScore = reliabilityResult.value;

    try {
      const response = await fetch(`/api/admin/pricing/variants/${variantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pricingProfile: payload,
          expectedUpdatedAt: record.variantUpdatedAt,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        variantPricing?: VariantPricingProfileRecord;
      };

      if (!response.ok || !data.variantPricing) {
        setError(data.error ?? "Unable to save pricing profile.");
        return;
      }

      setRecordsByVariantId((prev) => ({
        ...prev,
        [variantId]: data.variantPricing!,
      }));
      setFormByVariantId((prev) => ({
        ...prev,
        [variantId]: buildFormState(data.variantPricing!),
      }));
      setMessage("Pricing profile saved to Growvault.");
    } catch {
      setError("Unable to save pricing profile.");
    } finally {
      setSavingVariantId(null);
    }
  };

  return (
    <section
      id="pricing"
      className="admin-product-section admin-reveal scroll-mt-32 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.96),rgba(9,14,21,0.9))] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
            05
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Pricing automation
            </p>
            <p className="text-xs text-slate-400">
              Shared-admin-backed per-variant pricing profiles. No pricing logic runs locally.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {pricingIntegrationError ? (
          <AdminNotice tone="error">{pricingIntegrationError}</AdminNotice>
        ) : null}
        {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
        {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        {!pricingIntegrationError && missingVariantCount > 0 ? (
          <AdminNotice tone="info">
            {missingVariantCount} variant(s) do not have a pricing profile record yet.
          </AdminNotice>
        ) : null}

        <div className="space-y-3">
          {variants.map((variant) => {
            const record = recordsByVariantId[variant.id];
            return (
              <div
                key={variant.id}
                className="grid gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.7fr]"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{variant.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {variant.sku ? `SKU ${variant.sku}` : "No SKU"} · Current price{" "}
                    {formatCurrency(variant.priceCents)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {record ? (
                      <>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                          {record.pricingProfile.productSegment}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 ${
                            record.pricingProfile.autoRepriceEnabled
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                              : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          }`}
                        >
                          {record.pricingProfile.autoRepriceEnabled
                            ? "Auto repricing on"
                            : "Auto repricing off"}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-red-200">
                        Growvault variant missing
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Shipping + handling inputs
                  </div>
                  <div className="mt-2">
                    Supplier {record ? toInputString(record.pricingProfile.supplierShippingCostCents) : "n/a"}
                  </div>
                  <div>Inbound {record ? toInputString(record.pricingProfile.inboundShippingCostCents) : "n/a"}</div>
                  <div>Packaging {record ? toInputString(record.pricingProfile.packagingCostCents) : "n/a"}</div>
                  <div>Handling {record ? toInputString(record.pricingProfile.handlingCostCents) : "n/a"}</div>
                </div>

                <div className="text-xs text-slate-400">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Competitor inputs
                  </div>
                  <div className="mt-2">
                    Min {record ? toInputString(record.pricingProfile.competitorMinPriceCents) : "n/a"}
                  </div>
                  <div>
                    Avg {record ? toInputString(record.pricingProfile.competitorAveragePriceCents) : "n/a"}
                  </div>
                  <div>
                    Observed {record ? formatDateTime(record.pricingProfile.competitorObservedAt) : "n/a"}
                  </div>
                </div>

                <div className="flex flex-col items-start justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Remote variant sync {record ? formatDateTime(record.variantUpdatedAt) : "n/a"}
                  </div>
                  <AdminButton
                    tone="secondary"
                    onClick={() => setSelectedVariantId(variant.id)}
                    disabled={!record || Boolean(pricingIntegrationError)}
                  >
                    Edit profile
                  </AdminButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AdminDrawer
        open={selectedRecord !== null && selectedForm !== null}
        onClose={() => setSelectedVariantId(null)}
        title={selectedRecord?.variantTitle ?? "Pricing profile"}
        description={
          selectedRecord
            ? `${selectedRecord.sku ? `SKU ${selectedRecord.sku} · ` : ""}Remote sync ${formatDateTime(
                selectedRecord.variantUpdatedAt
              )}`
            : undefined
        }
        widthClassName="w-full max-w-3xl"
      >
        {selectedRecord && selectedForm ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Product segment">
                <AdminSelect
                  value={selectedForm.productSegment}
                  onChange={(event) =>
                    updateField(
                      selectedRecord.variantId,
                      "productSegment",
                      event.target.value as PricingProductSegment
                    )
                  }
                >
                  {PRICING_PRODUCT_SEGMENTS.map((segment) => (
                    <option key={segment} value={segment}>
                      {segment}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>

              <AdminField label="Auto repricing">
                <AdminSelect
                  value={selectedForm.autoRepriceEnabled ? "enabled" : "disabled"}
                  onChange={(event) =>
                    updateField(
                      selectedRecord.variantId,
                      "autoRepriceEnabled",
                      event.target.value === "enabled"
                    )
                  }
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </AdminSelect>
              </AdminField>
            </div>

            <ProfileFieldGrid
              title="Cost inputs"
              fields={[
                ["supplierShippingCostCents", "Supplier shipping cost (cents)"],
                ["inboundShippingCostCents", "Inbound shipping cost (cents)"],
                ["packagingCostCents", "Packaging cost (cents)"],
                ["handlingCostCents", "Handling cost (cents)"],
                ["paymentFeePercentBasisPoints", "Payment fee percent (bps)"],
                ["paymentFixedFeeCents", "Payment fixed fee (cents)"],
                ["returnRiskBufferBasisPoints", "Return risk buffer (bps)"],
                ["targetMarginBasisPoints", "Target margin (bps)"],
              ]}
              form={selectedForm}
              variantId={selectedRecord.variantId}
              onChange={updateField}
            />

            <ProfileFieldGrid
              title="Competitor inputs"
              fields={[
                ["competitorMinPriceCents", "Competitor minimum price (cents)"],
                ["competitorAveragePriceCents", "Competitor average price (cents)"],
                ["competitorSourceCount", "Competitor source count"],
                ["competitorReliabilityScore", "Competitor reliability score"],
              ]}
              form={selectedForm}
              variantId={selectedRecord.variantId}
              onChange={updateField}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Competitor observed at">
                <AdminInput
                  type="datetime-local"
                  value={selectedForm.competitorObservedAt}
                  onChange={(event) =>
                    updateField(
                      selectedRecord.variantId,
                      "competitorObservedAt",
                      event.target.value
                    )
                  }
                />
              </AdminField>
              <AdminField label="Competitor source label">
                <AdminInput
                  value={selectedForm.competitorSourceLabel}
                  onChange={(event) =>
                    updateField(
                      selectedRecord.variantId,
                      "competitorSourceLabel",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Idealo, Google Shopping"
                />
              </AdminField>
            </div>

            <div className="flex justify-end">
              <AdminButton
                onClick={() => saveVariantProfile(selectedRecord.variantId)}
                disabled={savingVariantId === selectedRecord.variantId}
              >
                {savingVariantId === selectedRecord.variantId
                  ? "Saving..."
                  : "Save pricing profile"}
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminDrawer>
    </section>
  );
}

function ProfileFieldGrid({
  title,
  fields,
  form,
  variantId,
  onChange,
}: {
  title: string;
  fields: Array<[keyof PricingProfileFormState, string]>;
  form: PricingProfileFormState;
  variantId: string;
  onChange: <Key extends keyof PricingProfileFormState>(
    variantId: string,
    key: Key,
    value: PricingProfileFormState[Key]
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <AdminField key={String(key)} label={label}>
            <AdminInput
              value={form[key] as string}
              onChange={(event) => onChange(variantId, key, event.target.value)}
              placeholder="leave empty to clear"
            />
          </AdminField>
        ))}
      </div>
    </div>
  );
}
