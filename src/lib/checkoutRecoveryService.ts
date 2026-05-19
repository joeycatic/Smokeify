import "server-only";

import { Prisma } from "@prisma/client";
import { sendResendEmail } from "@/lib/resend";
import { prisma } from "@/lib/prisma";
import {
  buildCheckoutRecoveryUrl,
  DEFAULT_CHECKOUT_RECOVERY_CONFIG,
  formatCheckoutRecoveryStepLabel,
  getCheckoutRecoveryScheduledFor,
  parseCheckoutRecoveryConfig,
  serializeCheckoutRecoveryConfig,
  type CheckoutRecoveryCampaignConfig,
  type CheckoutRecoveryCartItem,
  type CheckoutRecoveryCartSummary,
} from "@/lib/checkoutRecovery";
import { getStorefrontOrigin } from "@/lib/storefrontEmailBrand";
import { buildCheckoutRecoveryEmail } from "@/lib/storefrontNotificationEmail";
import {
  parseAdminStorefrontScope,
  parseStorefront,
  type AdminStorefrontScope,
  type StorefrontCode,
} from "@/lib/storefronts";

export const CHECKOUT_RECOVERY_SCHEDULE_KEY = "checkout-recovery-run";
export const CHECKOUT_RECOVERY_HANDLER = "checkout.recovery.run";
const CHECKOUT_RECOVERY_LINK_WINDOW_DAYS = 7;

type RecoveryActor = {
  id?: string | null;
  email?: string | null;
};

type RecoverySessionMetadata = {
  cartSummary?: CheckoutRecoveryCartSummary;
};

type RecoverySessionRecord = {
  id: string;
  stripeSessionId: string;
  userId: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  sourceStorefront: StorefrontCode | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
  isGuest: boolean;
  consentGranted: boolean;
  consentCapturedAt: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  cartLineCount: number;
  discountCode: string | null;
  shippingCountry: string | null;
  suppressedAt: string | null;
  suppressionReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutRecoveryOverview = {
  schedule: {
    key: string;
    status: "ACTIVE" | "PAUSED";
    cronExpression: string | null;
    lastSucceededAt: string | null;
    lastFailedAt: string | null;
    lastError: string | null;
    payload: CheckoutRecoveryCampaignConfig;
  };
  metrics: {
    totalSessions: number;
    consentedSessions: number;
    dueNowCount: number;
    recoveredOrders: number;
    recoveredRevenueCents: number;
    sentAttempts: number;
    skippedAttempts: number;
    failedAttempts: number;
  };
  recentAttempts: Array<{
    id: string;
    sessionId: string;
    customerEmail: string | null;
    stepIndex: number;
    stepLabel: string;
    status: string;
    scheduledFor: string;
    sentAt: string | null;
    skipReason: string | null;
    errorMessage: string | null;
  }>;
  topSkipReasons: Array<{ reason: string; count: number }>;
  dueCandidates: CheckoutRecoveryCandidatePreview[];
};

export type CheckoutRecoveryCandidatePreview = {
  sessionId: string;
  stripeSessionId: string;
  customerEmail: string | null;
  storefront: StorefrontCode | null;
  customerType: "FIRST_TIME" | "RETURNING";
  stepIndex: number;
  stepLabel: string;
  scheduledFor: string;
  totalCents: number;
  isGuest: boolean;
};

export type CheckoutRecoveryRunResult = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  paused: boolean;
  dueCount: number;
  candidates: CheckoutRecoveryCandidatePreview[];
};

const asMetadata = (value: Prisma.JsonValue | null | undefined): RecoverySessionMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as RecoverySessionMetadata;
};

const toJson = (value: unknown) => value as Prisma.InputJsonValue;

const defaultSchedulePayload = serializeCheckoutRecoveryConfig(
  DEFAULT_CHECKOUT_RECOVERY_CONFIG,
);

async function ensureCheckoutRecoverySchedule() {
  return prisma.automationSchedule.upsert({
    where: { key: CHECKOUT_RECOVERY_SCHEDULE_KEY },
    update: {
      label: "Checkout recovery run",
      handler: CHECKOUT_RECOVERY_HANDLER,
      cronExpression: "*/15 * * * *",
      maxAttempts: 3,
    },
    create: {
      key: CHECKOUT_RECOVERY_SCHEDULE_KEY,
      label: "Checkout recovery run",
      handler: CHECKOUT_RECOVERY_HANDLER,
      status: "PAUSED",
      cronExpression: "*/15 * * * *",
      payload: toJson(defaultSchedulePayload),
      maxAttempts: 3,
    },
  });
}

async function getCheckoutRecoverySchedule() {
  const schedule = await ensureCheckoutRecoverySchedule();
  return {
    record: schedule,
    config: parseCheckoutRecoveryConfig(schedule.payload),
  };
}

export async function getCheckoutRecoveryScheduleSnapshot() {
  const { record, config } = await getCheckoutRecoverySchedule();
  return {
    key: record.key,
    status: record.status,
    cronExpression: record.cronExpression,
    payload: config,
  };
}

const getPriorPaidOrders = async (session: {
  userId: string | null;
  customerEmail: string | null;
  createdAt: Date;
}) => {
  const paidStatuses = ["paid", "succeeded", "refunded", "partially_refunded"];
  const email = session.customerEmail?.trim().toLowerCase();
  return prisma.order.count({
    where: {
      createdAt: { lt: session.createdAt },
      paymentStatus: { in: paidStatuses },
      OR: [
        ...(session.userId ? [{ userId: session.userId }] : []),
        ...(email
          ? [{ customerEmail: { equals: email, mode: "insensitive" as const } }]
          : []),
      ],
    },
  });
};

const serializeCandidate = (input: {
  session: Awaited<ReturnType<typeof listOpenRecoverySessions>>[number];
  stepIndex: number;
  scheduledFor: Date;
  customerType: "FIRST_TIME" | "RETURNING";
}) => ({
  sessionId: input.session.id,
  stripeSessionId: input.session.stripeSessionId,
  customerEmail: input.session.customerEmail,
  storefront: parseStorefront(input.session.sourceStorefront ?? null),
  customerType: input.customerType,
  stepIndex: input.stepIndex,
  stepLabel: formatCheckoutRecoveryStepLabel(input.stepIndex),
  scheduledFor: input.scheduledFor.toISOString(),
  totalCents: input.session.totalCents,
  isGuest: input.session.isGuest,
});

async function listOpenRecoverySessions() {
  return prisma.checkoutRecoverySession.findMany({
    where: {
      consentGranted: true,
      suppressedAt: null,
      completedAt: null,
    },
    include: {
      attempts: {
        orderBy: [{ stepIndex: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function resolveDueCandidate(
  session: Awaited<ReturnType<typeof listOpenRecoverySessions>>[number],
  config: CheckoutRecoveryCampaignConfig,
  now: Date,
): Promise<CheckoutRecoveryCandidatePreview | null> {
  if (!session.customerEmail?.trim()) return null;

  if (
    config.segmentation.minCartTotalCents > 0 &&
    session.totalCents < config.segmentation.minCartTotalCents
  ) {
    return null;
  }

  if (config.segmentation.guestMode === "GUEST_ONLY" && !session.isGuest) return null;
  if (config.segmentation.guestMode === "LOGGED_IN_ONLY" && session.isGuest) return null;

  const storefront = parseStorefront(session.sourceStorefront ?? null);
  if (
    config.segmentation.storefrontScope !== "ALL" &&
    storefront !== config.segmentation.storefrontScope
  ) {
    return null;
  }

  const priorPaidOrders = await getPriorPaidOrders(session);
  const customerType = priorPaidOrders > 0 ? "RETURNING" : "FIRST_TIME";
  if (
    config.segmentation.customerType !== "ANY" &&
    config.segmentation.customerType !== customerType
  ) {
    return null;
  }

  const attemptsByStep = new Set(session.attempts.map((attempt) => attempt.stepIndex));

  for (const step of config.steps.filter((entry) => entry.enabled)) {
    if (attemptsByStep.has(step.stepIndex)) continue;
    const scheduledFor = getCheckoutRecoveryScheduledFor(session.createdAt, step.delayMinutes);
    if (scheduledFor > now) continue;
    return serializeCandidate({
      session,
      stepIndex: step.stepIndex,
      scheduledFor,
      customerType,
    });
  }

  return null;
}

async function getDueCandidates(
  config: CheckoutRecoveryCampaignConfig,
  now = new Date(),
) {
  const sessions = await listOpenRecoverySessions();
  const candidates = (
    await Promise.all(sessions.map((session) => resolveDueCandidate(session, config, now)))
  ).filter((entry): entry is CheckoutRecoveryCandidatePreview => Boolean(entry));

  return { sessions, candidates };
}

async function loadRecoverySessionOrThrow(sessionId: string) {
  const session = await prisma.checkoutRecoverySession.findUnique({
    where: { id: sessionId },
    include: {
      attempts: { orderBy: [{ stepIndex: "asc" }] },
    },
  });
  if (!session) {
    throw new Error("Checkout recovery session not found.");
  }
  return session;
}

function getCartSummaryForEmail(
  session: Awaited<ReturnType<typeof loadRecoverySessionOrThrow>>,
): CheckoutRecoveryCartSummary {
  const metadata = asMetadata(session.metadata);
  return (
    metadata.cartSummary ?? {
      currency: session.currency,
      subtotalCents: session.subtotalCents,
      discountCents: session.discountCents,
      shippingCents: session.shippingCents,
      totalCents: session.totalCents,
      items: [],
    }
  );
}

function getConfiguredStep(
  config: CheckoutRecoveryCampaignConfig,
  stepIndex: number,
) {
  const step = config.steps.find((entry) => entry.stepIndex === stepIndex);
  if (!step) {
    throw new Error(`Checkout recovery step ${stepIndex} is not configured.`);
  }
  return step;
}

async function sendRecoveryEmailForStep(input: {
  session: Awaited<ReturnType<typeof loadRecoverySessionOrThrow>>;
  config: CheckoutRecoveryCampaignConfig;
  stepIndex: number;
}) {
  const storefront = parseStorefront(input.session.sourceStorefront ?? null) ?? "MAIN";
  const step = getConfiguredStep(input.config, input.stepIndex);
  const origin = getStorefrontOrigin(storefront, input.session.sourceOrigin);
  const recoveryUrl = buildCheckoutRecoveryUrl(origin, {
    sessionId: input.session.id,
    stepIndex: input.stepIndex,
    promoCode: step.promoCode,
    expiresAt: Date.now() + CHECKOUT_RECOVERY_LINK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  });
  if (!recoveryUrl) {
    throw new Error("Checkout recovery link secret is not configured.");
  }
  const email = buildCheckoutRecoveryEmail({
    storefront,
    recipientEmail: input.session.customerEmail ?? "",
    sessionId: input.session.stripeSessionId,
    step: input.stepIndex,
    recoveryUrl,
    cartSummary: getCartSummaryForEmail(input.session),
    promoCode: step.promoCode,
    promoMessage: step.promoMessage,
    fallbackOrigin: origin,
  });

  await sendResendEmail({
    to: input.session.customerEmail ?? "",
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return {
    recoveryUrl,
    promoCode: step.promoCode,
    promoMessage: step.promoMessage,
    storefront,
  };
}

export async function persistCheckoutRecoverySession(input: {
  stripeSessionId: string;
  userId?: string | null;
  customerEmail?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  sourceStorefront?: string | null;
  sourceHost?: string | null;
  sourceOrigin?: string | null;
  isGuest: boolean;
  consentGranted: boolean;
  cartItems: CheckoutRecoveryCartItem[];
  cartSummary: CheckoutRecoveryCartSummary;
  discountCode?: string | null;
  shippingCountry?: string | null;
}) {
  const now = new Date();
  return prisma.checkoutRecoverySession.upsert({
    where: { stripeSessionId: input.stripeSessionId },
    update: {
      userId: input.userId ?? null,
      customerEmail: input.customerEmail ?? null,
      customerFirstName: input.customerFirstName ?? null,
      customerLastName: input.customerLastName ?? null,
      sourceStorefront: parseStorefront(input.sourceStorefront ?? null) ?? undefined,
      sourceHost: input.sourceHost ?? null,
      sourceOrigin: input.sourceOrigin ?? null,
      isGuest: input.isGuest,
      consentGranted: input.consentGranted,
      consentCapturedAt: input.consentGranted ? now : null,
      cartItems: toJson(input.cartItems),
      currency: input.cartSummary.currency,
      subtotalCents: input.cartSummary.subtotalCents,
      discountCents: input.cartSummary.discountCents,
      shippingCents: input.cartSummary.shippingCents,
      totalCents: input.cartSummary.totalCents,
      cartLineCount: input.cartSummary.items.reduce((sum, item) => sum + item.quantity, 0),
      discountCode: input.discountCode ?? null,
      shippingCountry: input.shippingCountry ?? null,
      metadata: toJson({ cartSummary: input.cartSummary }),
    },
    create: {
      stripeSessionId: input.stripeSessionId,
      userId: input.userId ?? null,
      customerEmail: input.customerEmail ?? null,
      customerFirstName: input.customerFirstName ?? null,
      customerLastName: input.customerLastName ?? null,
      sourceStorefront: parseStorefront(input.sourceStorefront ?? null) ?? undefined,
      sourceHost: input.sourceHost ?? null,
      sourceOrigin: input.sourceOrigin ?? null,
      isGuest: input.isGuest,
      consentGranted: input.consentGranted,
      consentCapturedAt: input.consentGranted ? now : null,
      cartItems: toJson(input.cartItems),
      currency: input.cartSummary.currency,
      subtotalCents: input.cartSummary.subtotalCents,
      discountCents: input.cartSummary.discountCents,
      shippingCents: input.cartSummary.shippingCents,
      totalCents: input.cartSummary.totalCents,
      cartLineCount: input.cartSummary.items.reduce((sum, item) => sum + item.quantity, 0),
      discountCode: input.discountCode ?? null,
      shippingCountry: input.shippingCountry ?? null,
      metadata: toJson({ cartSummary: input.cartSummary }),
    },
  });
}

export async function markCheckoutRecoveryOrderLinked(input: {
  stripeSessionId?: string | null;
  recoverySessionId?: string | null;
  orderId: string;
}) {
  const where: Prisma.CheckoutRecoverySessionWhereInput = {
    OR: [
      ...(input.stripeSessionId ? [{ stripeSessionId: input.stripeSessionId }] : []),
      ...(input.recoverySessionId ? [{ id: input.recoverySessionId }] : []),
    ],
  };
  if (!where.OR?.length) return;
  await prisma.checkoutRecoverySession.updateMany({
    where,
    data: {
      completedAt: new Date(),
      suppressionReason: "order_completed",
    },
  });
}

export async function getCheckoutRecoveryRestorePayload(sessionId: string) {
  const session = await loadRecoverySessionOrThrow(sessionId);
  return {
    id: session.id,
    cartItems: session.cartItems as CheckoutRecoveryCartItem[],
    shippingCountry: session.shippingCountry,
    discountCode: session.discountCode,
  };
}

export async function getCheckoutRecoveryOverview(): Promise<CheckoutRecoveryOverview> {
  const { record, config } = await getCheckoutRecoverySchedule();
  const [totalSessions, consentedSessions, recovered, attempts, due] = await Promise.all([
    prisma.checkoutRecoverySession.count(),
    prisma.checkoutRecoverySession.count({ where: { consentGranted: true } }),
    prisma.order.aggregate({
      _count: { id: true },
      _sum: { amountTotal: true },
      where: { recoveredFromCheckoutSessionId: { not: null } },
    }),
    prisma.checkoutRecoveryAttempt.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: {
        session: {
          select: {
            id: true,
            customerEmail: true,
          },
        },
      },
    }),
    getDueCandidates(config),
  ]);

  const sentAttempts = attempts.filter((attempt) => attempt.status === "SENT").length;
  const skippedAttempts = attempts.filter((attempt) => attempt.status === "SKIPPED").length;
  const failedAttempts = attempts.filter((attempt) => attempt.status === "FAILED").length;
  const reasonCounts = new Map<string, number>();
  for (const attempt of attempts) {
    const reason = attempt.skipReason ?? attempt.errorMessage ?? null;
    if (!reason) continue;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  return {
    schedule: {
      key: record.key,
      status: record.status,
      cronExpression: record.cronExpression,
      lastSucceededAt: record.lastSucceededAt?.toISOString() ?? null,
      lastFailedAt: record.lastFailedAt?.toISOString() ?? null,
      lastError: record.lastError,
      payload: config,
    },
    metrics: {
      totalSessions,
      consentedSessions,
      dueNowCount: due.candidates.length,
      recoveredOrders: recovered._count.id ?? 0,
      recoveredRevenueCents: recovered._sum.amountTotal ?? 0,
      sentAttempts,
      skippedAttempts,
      failedAttempts,
    },
    recentAttempts: attempts.map((attempt) => ({
      id: attempt.id,
      sessionId: attempt.sessionId,
      customerEmail: attempt.session.customerEmail,
      stepIndex: attempt.stepIndex,
      stepLabel: formatCheckoutRecoveryStepLabel(attempt.stepIndex),
      status: attempt.status,
      scheduledFor: attempt.scheduledFor.toISOString(),
      sentAt: attempt.sentAt?.toISOString() ?? null,
      skipReason: attempt.skipReason,
      errorMessage: attempt.errorMessage,
    })),
    topSkipReasons: Array.from(reasonCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    dueCandidates: due.candidates.slice(0, 10),
  };
}

export async function updateCheckoutRecoveryConfig(
  nextConfig: CheckoutRecoveryCampaignConfig,
) {
  const schedule = await ensureCheckoutRecoverySchedule();
  const updated = await prisma.automationSchedule.update({
    where: { id: schedule.id },
    data: {
      payload: toJson(serializeCheckoutRecoveryConfig(nextConfig)),
    },
  });

  return {
    key: updated.key,
    status: updated.status,
    payload: parseCheckoutRecoveryConfig(updated.payload),
  };
}

export async function previewCheckoutRecoveryRun(input?: {
  limit?: number;
}) {
  const { config } = await getCheckoutRecoverySchedule();
  const due = await getDueCandidates(config);
  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit) && input.limit > 0
      ? Math.floor(input.limit)
      : 20;
  return {
    config,
    dueCount: due.candidates.length,
    candidates: due.candidates.slice(0, limit),
  };
}

export async function runCheckoutRecoveryCampaign(input: {
  limit?: number;
  bypassPaused?: boolean;
  actor?: RecoveryActor | null;
} = {}): Promise<CheckoutRecoveryRunResult> {
  const { record, config } = await getCheckoutRecoverySchedule();
  if (!input.bypassPaused && record.status === "PAUSED") {
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      paused: true,
      dueCount: 0,
      candidates: [],
    };
  }

  const { candidates } = await getDueCandidates(config);
  const maxSends = Math.min(
    candidates.length,
    config.maxSendsPerRun,
    typeof input.limit === "number" && Number.isFinite(input.limit) && input.limit > 0
      ? Math.floor(input.limit)
      : config.maxSendsPerRun,
  );
  const selectedCandidates = candidates.slice(0, maxSends);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of selectedCandidates) {
    const session = await loadRecoverySessionOrThrow(candidate.sessionId);
    if (!session.customerEmail?.trim()) {
      await prisma.checkoutRecoveryAttempt.upsert({
        where: {
          sessionId_stepIndex: {
            sessionId: candidate.sessionId,
            stepIndex: candidate.stepIndex,
          },
        },
        update: {
          status: "SKIPPED",
          skipReason: "missing_email",
        },
        create: {
          sessionId: candidate.sessionId,
          stepIndex: candidate.stepIndex,
          scheduledFor: new Date(candidate.scheduledFor),
          status: "SKIPPED",
          skipReason: "missing_email",
        },
      });
      skipped += 1;
      continue;
    }

    try {
      await prisma.checkoutRecoveryAttempt.create({
        data: {
          sessionId: candidate.sessionId,
          stepIndex: candidate.stepIndex,
          scheduledFor: new Date(candidate.scheduledFor),
          status: "PENDING",
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        skipped += 1;
        continue;
      }
      throw error;
    }

    try {
      const emailResult = await sendRecoveryEmailForStep({
        session,
        config,
        stepIndex: candidate.stepIndex,
      });
      await prisma.checkoutRecoveryAttempt.update({
        where: {
          sessionId_stepIndex: {
            sessionId: candidate.sessionId,
            stepIndex: candidate.stepIndex,
          },
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          promoCode: emailResult.promoCode,
          promoMessage: emailResult.promoMessage,
          deliveryMetadata: toJson({
            recoveryUrl: emailResult.recoveryUrl,
            storefront: emailResult.storefront,
            actor: input.actor?.email ?? "system",
          }),
        },
      });
      sent += 1;
    } catch (error) {
      await prisma.checkoutRecoveryAttempt.update({
        where: {
          sessionId_stepIndex: {
            sessionId: candidate.sessionId,
            stepIndex: candidate.stepIndex,
          },
        },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Checkout recovery send failed.",
        },
      });
      failed += 1;
    }
  }

  return {
    processed: selectedCandidates.length,
    sent,
    skipped,
    failed,
    paused: false,
    dueCount: candidates.length,
    candidates: selectedCandidates,
  };
}

export async function sendCheckoutRecoveryTestEmail(input: {
  to: string;
  storefront: StorefrontCode;
  stepIndex: number;
  recoveryUrl?: string | null;
  promoCode?: string | null;
  promoMessage?: string | null;
  cartSummary?: CheckoutRecoveryCartSummary | null;
}) {
  const recoveryUrl =
    input.recoveryUrl?.trim() ||
    `${getStorefrontOrigin(input.storefront)}/checkout/start?${new URLSearchParams({
      [CHECKOUT_RECOVERY_SCHEDULE_KEY]: "test",
    }).toString()}`;
  const email = buildCheckoutRecoveryEmail({
    storefront: input.storefront,
    recipientEmail: input.to,
    sessionId: "cs_test_checkout_recovery",
    step: input.stepIndex,
    recoveryUrl,
    cartSummary:
      input.cartSummary ?? {
        currency: "EUR",
        subtotalCents: 8990,
        discountCents: 0,
        shippingCents: 690,
        totalCents: 9680,
        items: [
          {
            name: "Beispiel-Artikel",
            quantity: 1,
            lineTotalCents: 8990,
          },
        ],
      },
    promoCode: input.promoCode ?? null,
    promoMessage: input.promoMessage ?? null,
    fallbackOrigin: getStorefrontOrigin(input.storefront),
  });
  await sendResendEmail({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

export function serializeCheckoutRecoverySessionRecord(
  session: Awaited<ReturnType<typeof loadRecoverySessionOrThrow>>,
): RecoverySessionRecord {
  return {
    id: session.id,
    stripeSessionId: session.stripeSessionId,
    userId: session.userId,
    customerEmail: session.customerEmail,
    customerFirstName: session.customerFirstName,
    customerLastName: session.customerLastName,
    sourceStorefront: parseStorefront(session.sourceStorefront ?? null),
    sourceHost: session.sourceHost,
    sourceOrigin: session.sourceOrigin,
    isGuest: session.isGuest,
    consentGranted: session.consentGranted,
    consentCapturedAt: session.consentCapturedAt?.toISOString() ?? null,
    subtotalCents: session.subtotalCents,
    discountCents: session.discountCents,
    shippingCents: session.shippingCents,
    totalCents: session.totalCents,
    cartLineCount: session.cartLineCount,
    discountCode: session.discountCode,
    shippingCountry: session.shippingCountry,
    suppressedAt: session.suppressedAt?.toISOString() ?? null,
    suppressionReason: session.suppressionReason,
    completedAt: session.completedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function parseCheckoutRecoveryScope(value: unknown): AdminStorefrontScope {
  return parseAdminStorefrontScope(typeof value === "string" ? value : undefined);
}
