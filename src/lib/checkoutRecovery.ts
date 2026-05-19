import crypto from "crypto";
import type { StorefrontCode } from "@/lib/storefronts";

export type CheckoutRecoveryCartItem = {
  variantId: string;
  quantity: number;
  options?: Array<{ name: string; value: string }>;
};

export type CheckoutRecoveryEmailCartItem = {
  name: string;
  quantity: number;
  lineTotalCents: number;
};

export type CheckoutRecoveryCartSummary = {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  items: CheckoutRecoveryEmailCartItem[];
};

export type CheckoutRecoveryCustomerType = "ANY" | "FIRST_TIME" | "RETURNING";
export type CheckoutRecoveryGuestMode = "ANY" | "GUEST_ONLY" | "LOGGED_IN_ONLY";
export type CheckoutRecoveryStorefrontScope = "ALL" | StorefrontCode;

export type CheckoutRecoveryStepConfig = {
  stepIndex: number;
  enabled: boolean;
  delayMinutes: number;
  promoCode: string | null;
  promoMessage: string | null;
};

export type CheckoutRecoveryCampaignConfig = {
  maxSendsPerRun: number;
  segmentation: {
    minCartTotalCents: number;
    customerType: CheckoutRecoveryCustomerType;
    storefrontScope: CheckoutRecoveryStorefrontScope;
    guestMode: CheckoutRecoveryGuestMode;
  };
  steps: CheckoutRecoveryStepConfig[];
};

const DEFAULT_STEPS: CheckoutRecoveryStepConfig[] = [
  {
    stepIndex: 1,
    enabled: true,
    delayMinutes: 45,
    promoCode: null,
    promoMessage: null,
  },
  {
    stepIndex: 2,
    enabled: true,
    delayMinutes: 24 * 60,
    promoCode: null,
    promoMessage: null,
  },
  {
    stepIndex: 3,
    enabled: true,
    delayMinutes: 72 * 60,
    promoCode: null,
    promoMessage: null,
  },
] as const;

export const DEFAULT_CHECKOUT_RECOVERY_CONFIG: CheckoutRecoveryCampaignConfig = {
  maxSendsPerRun: 50,
  segmentation: {
    minCartTotalCents: 0,
    customerType: "ANY",
    storefrontScope: "ALL",
    guestMode: "ANY",
  },
  steps: [...DEFAULT_STEPS],
};

export const CHECKOUT_RECOVERY_REFERENCE_PARAM = "recoverySession";

type CheckoutRecoveryTokenInput = {
  sessionId: string;
  stepIndex: number;
  expiresAt: number;
  promoCode?: string | null;
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getCheckoutRecoveryLinkSecret = () =>
  process.env.CHECKOUT_RECOVERY_LINK_SECRET ??
  process.env.ORDER_VIEW_LINK_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "";

const signRecoveryToken = ({
  sessionId,
  stepIndex,
  expiresAt,
  promoCode,
}: CheckoutRecoveryTokenInput) => {
  const secret = getCheckoutRecoveryLinkSecret();
  if (!secret) return null;
  const payload = `checkout-recovery.${sessionId}.${stepIndex}.${expiresAt}.${promoCode ?? ""}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

export const buildCheckoutRecoveryToken = (input: CheckoutRecoveryTokenInput) =>
  signRecoveryToken(input);

export const verifyCheckoutRecoveryToken = (
  input: CheckoutRecoveryTokenInput & { token: string },
) => {
  if (!Number.isFinite(input.expiresAt) || Date.now() > input.expiresAt) {
    return false;
  }
  const expected = signRecoveryToken(input);
  if (!expected || expected.length !== input.token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.token));
};

export const buildCheckoutRecoveryUrl = (
  origin: string,
  input: CheckoutRecoveryTokenInput & { daysValid?: number },
) => {
  const expiresAt =
    input.expiresAt ?? Date.now() + (input.daysValid ?? 7) * 24 * 60 * 60 * 1000;
  const token = buildCheckoutRecoveryToken({
    sessionId: input.sessionId,
    stepIndex: input.stepIndex,
    expiresAt,
    promoCode: input.promoCode ?? null,
  });
  if (!token) return null;
  const url = new URL(`/checkout/recover/${token}`, origin);
  url.searchParams.set("session", input.sessionId);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("step", String(input.stepIndex));
  if (input.promoCode?.trim()) {
    url.searchParams.set("promo", input.promoCode.trim());
  }
  return url.toString();
};

export const parseCheckoutRecoveryConfig = (
  value: unknown,
): CheckoutRecoveryCampaignConfig => {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const segmentationRecord =
    record.segmentation &&
    typeof record.segmentation === "object" &&
    !Array.isArray(record.segmentation)
      ? (record.segmentation as Record<string, unknown>)
      : {};
  const rawSteps = Array.isArray(record.steps) ? record.steps : [];
  const parsedSteps = rawSteps
    .map((entry, index) => {
      const step =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : {};
      const parsedDelay = Number(step.delayMinutes);
      const parsedStepIndex = Number(step.stepIndex);
      return {
        stepIndex:
          Number.isFinite(parsedStepIndex) && parsedStepIndex > 0
            ? Math.floor(parsedStepIndex)
            : index + 1,
        enabled: step.enabled !== false,
        delayMinutes:
          Number.isFinite(parsedDelay) && parsedDelay > 0
            ? Math.floor(parsedDelay)
            : DEFAULT_STEPS[index]?.delayMinutes ?? 60,
        promoCode: toOptionalString(step.promoCode),
        promoMessage: toOptionalString(step.promoMessage),
      } satisfies CheckoutRecoveryStepConfig;
    })
    .sort((left, right) => left.stepIndex - right.stepIndex);

  const steps =
    parsedSteps.length > 0
      ? parsedSteps
      : DEFAULT_STEPS.map((step) => ({ ...step }));

  const maxSendsPerRun = Number(record.maxSendsPerRun);
  const minCartTotalCents = Number(segmentationRecord.minCartTotalCents);
  const customerType = toOptionalString(segmentationRecord.customerType);
  const storefrontScope = toOptionalString(segmentationRecord.storefrontScope);
  const guestMode = toOptionalString(segmentationRecord.guestMode);

  return {
    maxSendsPerRun:
      Number.isFinite(maxSendsPerRun) && maxSendsPerRun > 0
        ? Math.min(500, Math.floor(maxSendsPerRun))
        : DEFAULT_CHECKOUT_RECOVERY_CONFIG.maxSendsPerRun,
    segmentation: {
      minCartTotalCents:
        Number.isFinite(minCartTotalCents) && minCartTotalCents >= 0
          ? Math.floor(minCartTotalCents)
          : DEFAULT_CHECKOUT_RECOVERY_CONFIG.segmentation.minCartTotalCents,
      customerType:
        customerType === "FIRST_TIME" ||
        customerType === "RETURNING" ||
        customerType === "ANY"
          ? customerType
          : DEFAULT_CHECKOUT_RECOVERY_CONFIG.segmentation.customerType,
      storefrontScope:
        storefrontScope === "MAIN" ||
        storefrontScope === "GROW" ||
        storefrontScope === "ALL"
          ? storefrontScope
          : DEFAULT_CHECKOUT_RECOVERY_CONFIG.segmentation.storefrontScope,
      guestMode:
        guestMode === "GUEST_ONLY" ||
        guestMode === "LOGGED_IN_ONLY" ||
        guestMode === "ANY"
          ? guestMode
          : DEFAULT_CHECKOUT_RECOVERY_CONFIG.segmentation.guestMode,
    },
    steps,
  };
};

export const serializeCheckoutRecoveryConfig = (
  config: CheckoutRecoveryCampaignConfig,
) => ({
  maxSendsPerRun: config.maxSendsPerRun,
  segmentation: {
    minCartTotalCents: config.segmentation.minCartTotalCents,
    customerType: config.segmentation.customerType,
    storefrontScope: config.segmentation.storefrontScope,
    guestMode: config.segmentation.guestMode,
  },
  steps: config.steps.map((step) => ({
    stepIndex: step.stepIndex,
    enabled: step.enabled,
    delayMinutes: step.delayMinutes,
    promoCode: step.promoCode,
    promoMessage: step.promoMessage,
  })),
});

export const getCheckoutRecoveryScheduledFor = (createdAt: Date, delayMinutes: number) =>
  new Date(createdAt.getTime() + delayMinutes * 60 * 1000);

export const formatCheckoutRecoveryStepLabel = (stepIndex: number) => {
  if (stepIndex === 1) return "Reminder 1";
  if (stepIndex === 2) return "Reminder 2";
  if (stepIndex === 3) return "Reminder 3";
  return `Reminder ${stepIndex}`;
};

type CheckoutSessionLike = {
  id?: string | null;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
};

export const CHECKOUT_RECOVERY_EVENT_PREFIX = "checkout_recovery:";

export const getCheckoutRecoveryEventId = (sessionId: string) =>
  `${CHECKOUT_RECOVERY_EVENT_PREFIX}${sessionId}`;

export const parseCheckoutRecoveryDelayMinutes = (raw?: string | null) => {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.floor(parsed);
};

export const parseCheckoutRecoveryBatchSize = (raw?: string | null) => {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(100, Math.floor(parsed));
};

export const isRecoverableCheckoutSession = (session: CheckoutSessionLike) =>
  Boolean(
    session.id &&
      session.mode === "payment" &&
      session.status === "open" &&
      session.payment_status !== "paid",
  );
