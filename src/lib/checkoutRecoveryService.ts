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

type RecoverySessionWithAttempts = Prisma.CheckoutRecoverySessionGetPayload<{
  include: {
    attempts: {
      orderBy: [{ stepIndex: "asc" }];
    };
  };
}>;

type RecoverySessionRecord = {
  id: string;
  paymentOrderCode: string;
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
    activeSessions: number;
    suppressedSessions: number;
    completedSessions: number;
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
  sessions: CheckoutRecoverySessionPreview[];
  sessionPage: number;
  hasMoreSessions: boolean;
};

export type CheckoutRecoveryCandidatePreview = {
  sessionId: string;
  paymentOrderCode: string;
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

export type CheckoutRecoverySessionPreview = {
  id: string;
  paymentOrderCode: string;
  customerEmail: string | null;
  storefront: StorefrontCode | null;
  totalCents: number;
  isGuest: boolean;
  state: "active" | "suppressed" | "completed";
  suppressedAt: string | null;
  suppressionReason: string | null;
  completedAt: string | null;
  createdAt: string;
  nextStep: {
    stepIndex: number;
    stepLabel: string;
    scheduledFor: string;
    isDueNow: boolean;
  } | null;
  lastAttempt: {
    stepIndex: number;
    status: string;
    sentAt: string | null;
    scheduledFor: string;
    skipReason: string | null;
    errorMessage: string | null;
  } | null;
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

async function getCustomerType(
  session: Pick<RecoverySessionWithAttempts, "userId" | "customerEmail" | "createdAt">,
): Promise<"FIRST_TIME" | "RETURNING"> {
  const priorPaidOrders = await getPriorPaidOrders(session);
  return priorPaidOrders > 0 ? "RETURNING" : "FIRST_TIME";
}

const serializeCandidate = (input: {
  session: RecoverySessionWithAttempts;
  stepIndex: number;
  scheduledFor: Date;
  customerType: "FIRST_TIME" | "RETURNING";
}) => ({
  sessionId: input.session.id,
  paymentOrderCode: input.session.paymentOrderCode,
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

async function listRecoverySessions(page = 1, pageSize = 12) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 12;
  return prisma.checkoutRecoverySession.findMany({
    include: {
      attempts: {
        orderBy: [{ stepIndex: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
}

async function resolveNextRecoveryStep(
  session: RecoverySessionWithAttempts,
  config: CheckoutRecoveryCampaignConfig,
  now: Date,
) {
  const customerType = await getCustomerType(session);
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
    return {
      customerType,
      stepIndex: step.stepIndex,
      scheduledFor,
      isDueNow: scheduledFor <= now,
    };
  }

  return null;
}

async function resolveDueCandidate(
  session: RecoverySessionWithAttempts,
  config: CheckoutRecoveryCampaignConfig,
  now: Date,
): Promise<CheckoutRecoveryCandidatePreview | null> {
  if (!session.customerEmail?.trim()) return null;
  const nextStep = await resolveNextRecoveryStep(session, config, now);
  if (!nextStep || !nextStep.isDueNow) return null;
  return serializeCandidate({
    session,
    stepIndex: nextStep.stepIndex,
    scheduledFor: nextStep.scheduledFor,
    customerType: nextStep.customerType,
  });
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

function getSessionRecoveryState(
  session: Pick<RecoverySessionWithAttempts, "suppressedAt" | "completedAt">,
): CheckoutRecoverySessionPreview["state"] {
  if (session.completedAt) return "completed";
  if (session.suppressedAt) return "suppressed";
  return "active";
}

async function sendRecoveryEmailForStep(input: {
  session: RecoverySessionWithAttempts;
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
    sessionId: input.session.paymentOrderCode,
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

async function sendRecoveryAttempt(input: {
  session: RecoverySessionWithAttempts;
  config: CheckoutRecoveryCampaignConfig;
  stepIndex: number;
  scheduledFor: Date;
  actor?: RecoveryActor | null;
}) {
  if (!input.session.customerEmail?.trim()) {
    await prisma.checkoutRecoveryAttempt.upsert({
      where: {
        sessionId_stepIndex: {
          sessionId: input.session.id,
          stepIndex: input.stepIndex,
        },
      },
      update: {
        status: "SKIPPED",
        skipReason: "missing_email",
      },
      create: {
        sessionId: input.session.id,
        stepIndex: input.stepIndex,
        scheduledFor: input.scheduledFor,
        status: "SKIPPED",
        skipReason: "missing_email",
      },
    });
    return { status: "SKIPPED" as const, reason: "missing_email" };
  }

  try {
    await prisma.checkoutRecoveryAttempt.create({
      data: {
        sessionId: input.session.id,
        stepIndex: input.stepIndex,
        scheduledFor: input.scheduledFor,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "SKIPPED" as const, reason: "duplicate_attempt" };
    }
    throw error;
  }

  try {
    const emailResult = await sendRecoveryEmailForStep({
      session: input.session,
      config: input.config,
      stepIndex: input.stepIndex,
    });
    await prisma.checkoutRecoveryAttempt.update({
      where: {
        sessionId_stepIndex: {
          sessionId: input.session.id,
          stepIndex: input.stepIndex,
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
    return { status: "SENT" as const };
  } catch (error) {
    await prisma.checkoutRecoveryAttempt.update({
      where: {
        sessionId_stepIndex: {
          sessionId: input.session.id,
          stepIndex: input.stepIndex,
        },
      },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Checkout recovery send failed.",
      },
    });
    return {
      status: "FAILED" as const,
      reason:
        error instanceof Error ? error.message : "Checkout recovery send failed.",
    };
  }
}

export async function persistCheckoutRecoverySession(input: {
  paymentOrderCode: string;
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
    where: { paymentOrderCode: input.paymentOrderCode },
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
      paymentOrderCode: input.paymentOrderCode,
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
  paymentOrderCode?: string | null;
  recoverySessionId?: string | null;
  orderId: string;
}) {
  const where: Prisma.CheckoutRecoverySessionWhereInput = {
    OR: [
      ...(input.paymentOrderCode ? [{ paymentOrderCode: input.paymentOrderCode }] : []),
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

export async function getCheckoutRecoveryOverview(input?: {
  page?: number;
  pageSize?: number;
}): Promise<CheckoutRecoveryOverview> {
  const { record, config } = await getCheckoutRecoverySchedule();
  const sessionPage =
    typeof input?.page === "number" && Number.isFinite(input.page) && input.page > 0
      ? Math.floor(input.page)
      : 1;
  const sessionPageSize =
    typeof input?.pageSize === "number" &&
    Number.isFinite(input.pageSize) &&
    input.pageSize > 0
      ? Math.floor(input.pageSize)
      : 12;
  const [totalSessions, consentedSessions, activeSessions, suppressedSessions, completedSessions, recovered, attempts, due, sessions] = await Promise.all([
    prisma.checkoutRecoverySession.count(),
    prisma.checkoutRecoverySession.count({ where: { consentGranted: true } }),
    prisma.checkoutRecoverySession.count({
      where: { consentGranted: true, suppressedAt: null, completedAt: null },
    }),
    prisma.checkoutRecoverySession.count({
      where: { consentGranted: true, suppressedAt: { not: null }, completedAt: null },
    }),
    prisma.checkoutRecoverySession.count({
      where: { consentGranted: true, completedAt: { not: null } },
    }),
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
    listRecoverySessions(sessionPage, sessionPageSize + 1),
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

  const visibleSessions = sessions.slice(0, sessionPageSize);
  const sessionPreviews = await Promise.all(
    visibleSessions.map(async (session) => {
      const nextStep = await resolveNextRecoveryStep(session, config, new Date());
      const lastAttempt = session.attempts.at(-1) ?? null;

      return {
        id: session.id,
        paymentOrderCode: session.paymentOrderCode,
        customerEmail: session.customerEmail,
        storefront: parseStorefront(session.sourceStorefront ?? null),
        totalCents: session.totalCents,
        isGuest: session.isGuest,
        state: getSessionRecoveryState(session),
        suppressedAt: session.suppressedAt?.toISOString() ?? null,
        suppressionReason: session.suppressionReason,
        completedAt: session.completedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        nextStep: nextStep
          ? {
              stepIndex: nextStep.stepIndex,
              stepLabel: formatCheckoutRecoveryStepLabel(nextStep.stepIndex),
              scheduledFor: nextStep.scheduledFor.toISOString(),
              isDueNow: nextStep.isDueNow,
            }
          : null,
        lastAttempt: lastAttempt
          ? {
              stepIndex: lastAttempt.stepIndex,
              status: lastAttempt.status,
              sentAt: lastAttempt.sentAt?.toISOString() ?? null,
              scheduledFor: lastAttempt.scheduledFor.toISOString(),
              skipReason: lastAttempt.skipReason,
              errorMessage: lastAttempt.errorMessage,
            }
          : null,
      } satisfies CheckoutRecoverySessionPreview;
    }),
  );

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
      activeSessions,
      suppressedSessions,
      completedSessions,
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
    sessions: sessionPreviews,
    sessionPage,
    hasMoreSessions: sessions.length > sessionPageSize,
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
    const result = await sendRecoveryAttempt({
      session,
      config,
      stepIndex: candidate.stepIndex,
      scheduledFor: new Date(candidate.scheduledFor),
      actor: input.actor,
    });
    if (result.status === "SENT") sent += 1;
    if (result.status === "SKIPPED") skipped += 1;
    if (result.status === "FAILED") failed += 1;
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

export async function suppressCheckoutRecoverySession(input: {
  sessionId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Suppression reason is required.");
  }

  const updated = await prisma.checkoutRecoverySession.update({
    where: { id: input.sessionId },
    data: {
      suppressedAt: new Date(),
      suppressionReason: reason,
    },
    include: {
      attempts: { orderBy: [{ stepIndex: "asc" }] },
    },
  });

  return serializeCheckoutRecoverySessionRecord(updated);
}

export async function resumeCheckoutRecoverySession(sessionId: string) {
  const updated = await prisma.checkoutRecoverySession.update({
    where: { id: sessionId },
    data: {
      suppressedAt: null,
      suppressionReason: null,
    },
    include: {
      attempts: { orderBy: [{ stepIndex: "asc" }] },
    },
  });

  return serializeCheckoutRecoverySessionRecord(updated);
}

export async function sendCheckoutRecoverySessionNow(input: {
  sessionId: string;
  actor?: RecoveryActor | null;
}) {
  const { config } = await getCheckoutRecoverySchedule();
  const session = await loadRecoverySessionOrThrow(input.sessionId);
  if (!session.consentGranted) {
    throw new Error("Recovery consent is required before sending.");
  }
  if (session.completedAt) {
    throw new Error("Completed recovery sessions cannot be sent again.");
  }
  if (session.suppressedAt) {
    throw new Error("Suppressed recovery sessions must be resumed first.");
  }

  const nextStep = await resolveNextRecoveryStep(session, config, new Date());
  if (!nextStep) {
    throw new Error("No eligible recovery step is available for this session.");
  }

  const result = await sendRecoveryAttempt({
    session,
    config,
    stepIndex: nextStep.stepIndex,
    scheduledFor: new Date(),
    actor: input.actor,
  });
  if (result.status === "FAILED") {
    throw new Error(result.reason ?? "Checkout recovery send failed.");
  }
  if (result.status === "SKIPPED") {
    throw new Error(result.reason ?? "Checkout recovery send skipped.");
  }

  return {
    session: serializeCheckoutRecoverySessionRecord(
      await loadRecoverySessionOrThrow(input.sessionId),
    ),
    stepIndex: nextStep.stepIndex,
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
    sessionId: "viva_test_checkout_recovery",
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
    paymentOrderCode: session.paymentOrderCode,
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
