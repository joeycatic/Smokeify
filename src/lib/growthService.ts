import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
} from "@/lib/storefrontEmailBrand";
import { ensureCustomizerPresetsSeeded } from "@/lib/customizerPresetStore";

export const GROWTH_CONFIG_KEY = "growvault-growth";
const GROWTH_BOOTSTRAP_MESSAGE =
  "Growth control plane tables are missing. Apply the growth Prisma migration before using these controls.";
const GROWTH_TABLE_NAMES = [
  "GrowthConfig",
  "WelcomeSeriesEnrollment",
  "WelcomeSeriesAttempt",
  "ContentArticle",
];

export type GrowthConfigPayload = {
  welcomeEnabled: boolean;
  recoveryEnabled: boolean;
  popupDelaySeconds: number;
  welcomeSteps: Array<{ stepIndex: number; delayHours: number; enabled: boolean }>;
  contentCadenceDays: number;
};

export const DEFAULT_GROWTH_CONFIG: GrowthConfigPayload = {
  welcomeEnabled: false,
  recoveryEnabled: false,
  popupDelaySeconds: 7,
  welcomeSteps: [
    { stepIndex: 1, delayHours: 0, enabled: true },
    { stepIndex: 2, delayHours: 48, enabled: true },
    { stepIndex: 3, delayHours: 120, enabled: true },
  ],
  contentCadenceDays: 7,
};

export type GrowthOverview = {
  config: {
    enabled: boolean;
    payload: GrowthConfigPayload;
  };
  metrics: {
    activeSubscribers: number;
    activeWelcome: number;
    welcomeSent: number;
    pendingBackInStock: number;
    crossSells: number;
    crossSellCoverage: number;
    presets: number;
    articles: number;
    publishedArticles: number;
  };
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    excerpt: string;
    seoTitle: string | null;
    seoDescription: string | null;
    keyword: string | null;
    cluster: string | null;
    body: Prisma.JsonValue;
    scheduledAt: Date | null;
  }>;
  backInStock: Array<{
    productId: string;
    productTitle: string | null;
    _count: { _all: number };
  }>;
  unavailableReason?: string | null;
};

const asConfig = (value: Prisma.JsonValue | null | undefined): GrowthConfigPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_GROWTH_CONFIG;
  }
  const raw = value as Record<string, unknown>;
  return {
    welcomeEnabled: raw.welcomeEnabled === true,
    recoveryEnabled: raw.recoveryEnabled === true,
    popupDelaySeconds: Math.max(3, Math.min(60, Number(raw.popupDelaySeconds) || 7)),
    contentCadenceDays: Math.max(1, Math.min(30, Number(raw.contentCadenceDays) || 7)),
    welcomeSteps: Array.isArray(raw.welcomeSteps)
      ? raw.welcomeSteps.slice(0, 3).map((step, index) => {
          const item =
            step && typeof step === "object" && !Array.isArray(step)
              ? (step as Record<string, unknown>)
              : {};
          return {
            stepIndex: index + 1,
            delayHours: Math.max(0, Number(item.delayHours) || [0, 48, 120][index]),
            enabled: item.enabled !== false,
          };
        })
      : DEFAULT_GROWTH_CONFIG.welcomeSteps,
  };
};

export function isGrowthControlPlaneMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;

  const table = typeof error.meta?.table === "string" ? error.meta.table : "";
  if (GROWTH_TABLE_NAMES.some((name) => table.includes(name))) return true;

  return GROWTH_TABLE_NAMES.some((name) => error.message.includes(name));
}

export function getGrowthBootstrapMessage() {
  return GROWTH_BOOTSTRAP_MESSAGE;
}

const getUnavailableGrowthOverview = (reason: string): GrowthOverview => ({
  config: {
    enabled: false,
    payload: DEFAULT_GROWTH_CONFIG,
  },
  metrics: {
    activeSubscribers: 0,
    activeWelcome: 0,
    welcomeSent: 0,
    pendingBackInStock: 0,
    crossSells: 0,
    crossSellCoverage: 0,
    presets: 0,
    articles: 0,
    publishedArticles: 0,
  },
  articles: [],
  backInStock: [],
  unavailableReason: reason,
});

export async function getGrowthConfig() {
  const config = await prisma.growthConfig.upsert({
    where: { key: GROWTH_CONFIG_KEY },
    create: {
      key: GROWTH_CONFIG_KEY,
      storefront: "GROW",
      enabled: false,
      payload: DEFAULT_GROWTH_CONFIG as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
  return {
    enabled: config.enabled,
    payload: asConfig(config.payload),
  };
}

export async function updateGrowthConfig(input: {
  enabled?: boolean;
  payload?: Partial<GrowthConfigPayload>;
}) {
  const current = await getGrowthConfig();
  const next = asConfig({
    ...current.payload,
    ...(input.payload ?? {}),
  } as unknown as Prisma.JsonValue);
  return prisma.growthConfig.update({
    where: { key: GROWTH_CONFIG_KEY },
    data: {
      enabled: input.enabled ?? current.enabled,
      payload: next as unknown as Prisma.InputJsonValue,
    },
  });
}

const buildWelcomeEmail = (input: {
  email: string;
  stepIndex: number;
  discountCode?: string | null;
  discountExpiresAt?: Date | null;
}) => {
  const brand = getStorefrontEmailBrand("GROW");
  const links = getStorefrontLinks("GROW");
  const unsubscribeUrl = buildUnsubscribeUrl(links.origin, input.email);
  const expires = input.discountExpiresAt?.toLocaleDateString("de-DE") ?? "bald";
  const variants = {
    1: {
      subject: "Dein GrowVault 5-%-Willkommensrabatt",
      title: "Willkommen im Vault",
      intro: `Dein persönlicher Code ${input.discountCode ?? ""} ist bis ${expires} gültig.`,
      cta: "Setup entdecken",
      href: `${links.origin}/products`,
    },
    2: {
      subject: "Welches Setup passt zu dir?",
      title: "Drei Wege zum passenden Setup",
      intro:
        "Vergleiche Budget, Balanced und Premium – jeweils passend für 60×60, 80×80 oder 100×100 cm.",
      cta: "Starter-Setups vergleichen",
      href: `${links.origin}/starter-setups`,
    },
    3: {
      subject: "Dein 5-%-Code läuft bald ab",
      title: "Letzter Hinweis zu deinem Vorteil",
      intro: `Dein Code ${input.discountCode ?? ""} ist nur noch kurze Zeit gültig. Nutze ihn ohne Mindestbestellwert.`,
      cta: "Code jetzt nutzen",
      href: `${links.origin}/products`,
    },
  }[input.stepIndex] ?? {
    subject: "Neu bei GrowVault",
    title: "GrowVault",
    intro: "Entdecke passende Produkte und Setups.",
    cta: "Zum Shop",
    href: links.shopUrl,
  };

  const html = `
    <div style="background:${brand.backgroundColor};padding:32px 16px;font-family:Arial,sans-serif;color:${brand.textColor}">
      <div style="max-width:600px;margin:0 auto;border:1px solid ${brand.cardBorderColor};border-radius:18px;overflow:hidden;background:${brand.cardBackgroundColor}">
        <div style="height:5px;background:${brand.accentColor}"></div>
        <div style="padding:34px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${brand.emphasisColor}">GrowVault · Welcome ${input.stepIndex}/3</div>
          <h1 style="font-size:30px;line-height:1.15;margin:16px 0;color:${brand.textColor}">${variants.title}</h1>
          <p style="font-size:15px;line-height:1.75;color:${brand.mutedTextColor}">${variants.intro}</p>
          <a href="${variants.href}" style="display:inline-block;margin-top:22px;padding:14px 22px;border-radius:12px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};font-weight:800;text-decoration:none">${variants.cta} →</a>
        </div>
      </div>
      <p style="max-width:600px;margin:18px auto 0;text-align:center;font-size:11px;color:${brand.footerMutedTextColor}">
        <a href="${unsubscribeUrl}" style="color:inherit">Vom Newsletter abmelden</a>
      </p>
    </div>`;
  return {
    ...variants,
    html,
    text: `${variants.title}\n\n${variants.intro}\n\n${variants.href}\n\nAbmelden: ${unsubscribeUrl}`,
  };
};

export async function runWelcomeSeries(input?: { limit?: number; bypassPaused?: boolean }) {
  await prisma.contentArticle.updateMany({
    where: {
      storefront: "GROW",
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  const config = await getGrowthConfig();
  if ((!config.enabled || !config.payload.welcomeEnabled) && !input?.bypassPaused) {
    return { paused: true, processed: 0, sent: 0, failed: 0 };
  }

  const due = await prisma.welcomeSeriesEnrollment.findMany({
    where: {
      storefront: "GROW",
      status: "ACTIVE",
      unsubscribedAt: null,
      nextSendAt: { lte: new Date() },
      nextStep: { in: [2, 3] },
    },
    orderBy: { nextSendAt: "asc" },
    take: Math.max(1, Math.min(100, input?.limit ?? 50)),
  });

  let sent = 0;
  let failed = 0;
  for (const enrollment of due) {
    const step = config.payload.welcomeSteps.find(
      (item) => item.stepIndex === enrollment.nextStep,
    );
    if (!step?.enabled) {
      await prisma.welcomeSeriesEnrollment.update({
        where: { id: enrollment.id },
        data: {
          nextStep: enrollment.nextStep + 1,
          nextSendAt: enrollment.nextStep >= 3 ? null : new Date(),
          completedAt: enrollment.nextStep >= 3 ? new Date() : null,
          status: enrollment.nextStep >= 3 ? "COMPLETED" : "ACTIVE",
        },
      });
      continue;
    }

    const attempt = await prisma.welcomeSeriesAttempt.upsert({
      where: {
        enrollmentId_stepIndex: {
          enrollmentId: enrollment.id,
          stepIndex: enrollment.nextStep,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        stepIndex: enrollment.nextStep,
        scheduledFor: enrollment.nextSendAt ?? new Date(),
      },
      update: {},
    });
    if (attempt.status === "SENT") continue;

    try {
      const email = buildWelcomeEmail({
        email: enrollment.email,
        stepIndex: enrollment.nextStep,
        discountCode: enrollment.discountCode,
        discountExpiresAt: enrollment.discountExpiresAt,
      });
      await sendResendEmail({
        to: enrollment.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      const nextStep = enrollment.nextStep + 1;
      const nextConfig = config.payload.welcomeSteps.find(
        (item) => item.stepIndex === nextStep,
      );
      await prisma.$transaction([
        prisma.welcomeSeriesAttempt.update({
          where: { id: attempt.id },
          data: { status: "SENT", sentAt: new Date(), errorMessage: null },
        }),
        prisma.welcomeSeriesEnrollment.update({
          where: { id: enrollment.id },
          data: {
            nextStep,
            nextSendAt:
              nextStep > 3
                ? null
                : new Date(
                    enrollment.createdAt.getTime() +
                      (nextConfig?.delayHours ?? 120) * 60 * 60 * 1000,
                  ),
            completedAt: nextStep > 3 ? new Date() : null,
            status: nextStep > 3 ? "COMPLETED" : "ACTIVE",
          },
        }),
      ]);
      sent += 1;
    } catch (error) {
      await prisma.welcomeSeriesAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Versand fehlgeschlagen",
        },
      });
      failed += 1;
    }
  }
  return { paused: false, processed: due.length, sent, failed };
}

export async function getGrowthOverview(): Promise<GrowthOverview> {
  await ensureCustomizerPresetsSeeded();
  const config = await getGrowthConfig();
  const [
    activeSubscribers,
    activeWelcome,
    welcomeSent,
    pendingBackInStock,
    crossSells,
    products,
    presets,
    articles,
    publishedArticles,
  ] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    prisma.welcomeSeriesEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.welcomeSeriesAttempt.count({ where: { status: "SENT" } }),
    prisma.backInStockRequest.count({ where: { notifiedAt: null } }),
    prisma.productCrossSell.count(),
    prisma.product.count({ where: { status: "ACTIVE", storefronts: { has: "GROW" } } }),
    prisma.customizerPreset.count({ where: { isActive: true } }),
    prisma.contentArticle.count({ where: { storefront: "GROW" } }),
    prisma.contentArticle.count({
      where: { storefront: "GROW", status: "PUBLISHED" },
    }),
  ]);
  const recentArticles = await prisma.contentArticle.findMany({
    where: { storefront: "GROW" },
    orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
    take: 20,
  });
  const backInStock = await prisma.backInStockRequest.groupBy({
    by: ["productId", "productTitle"] as const,
    where: { notifiedAt: null },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: 10,
  });

  return {
    config,
    metrics: {
      activeSubscribers,
      activeWelcome,
      welcomeSent,
      pendingBackInStock,
      crossSells,
      crossSellCoverage: products > 0 ? Math.round((crossSells / products) * 100) : 0,
      presets,
      articles,
      publishedArticles,
    },
    articles: recentArticles,
    backInStock,
  };
}

export async function getGrowthOverviewSafe() {
  try {
    return await getGrowthOverview();
  } catch (error) {
    if (!isGrowthControlPlaneMissingError(error)) throw error;
    return getUnavailableGrowthOverview(getGrowthBootstrapMessage());
  }
}

export async function generateGrowthCrossSells(limit = 100) {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", storefronts: { has: "GROW" } },
    select: {
      id: true,
      mainCategoryId: true,
      categories: { select: { categoryId: true } },
      crossSells: { select: { crossSellId: true } },
    },
    take: Math.max(1, Math.min(500, limit)),
  });
  let updated = 0;
  for (const product of products) {
    if (product.crossSells.length > 0) continue;
    const categoryIds = [
      ...(product.mainCategoryId ? [product.mainCategoryId] : []),
      ...product.categories.map((entry) => entry.categoryId),
    ];
    if (categoryIds.length === 0) continue;
    const candidates = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        status: "ACTIVE",
        storefronts: { has: "GROW" },
        OR: [
          { mainCategoryId: { in: categoryIds } },
          { categories: { some: { categoryId: { in: categoryIds } } } },
        ],
        variants: {
          some: {
            inventory: { quantityOnHand: { gt: 0 } },
          },
        },
      },
      select: { id: true },
      orderBy: [
        { bestsellerScore: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 3,
    });
    if (candidates.length === 0) continue;
    await prisma.productCrossSell.createMany({
      data: candidates.map((candidate, index) => ({
        productId: product.id,
        crossSellId: candidate.id,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
    updated += 1;
  }
  return { processed: products.length, updated };
}
