import { Prisma, type Storefront } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { finishAdminJobRun, startAdminJobRun } from "@/lib/adminJobRuns";
import { getLandingPageSectionDefinition } from "@/lib/landingPageConfig";
import { isSameOrigin } from "@/lib/requestSecurity";
import { parseStorefront, STOREFRONT_LABELS } from "@/lib/storefronts";

const DEFAULT_STOREFRONT = "MAIN" as const;

const parseProductIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  );
};

async function createSectionRevision(input: {
  sectionId: string;
  storefront: Storefront;
  key: string;
  isManual: boolean;
  productIds: string[];
  actor: { id: string | null; email: string | null };
}) {
  return prisma.landingPageSectionRevision.create({
    data: {
      sectionId: input.sectionId,
      storefront: input.storefront,
      key: input.key,
      isManual: input.isManual,
      productIds: input.productIds,
      createdById: input.actor.id,
      createdByEmail: input.actor.email,
    },
  });
}

async function serializeSection(sectionId: string) {
  const section = await prisma.landingPageSection.findUniqueOrThrow({
    where: { id: sectionId },
    include: {
      publishedRevision: {
        select: {
          id: true,
          productIds: true,
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          isManual: true,
          productIds: true,
          createdAt: true,
          createdByEmail: true,
        },
      },
    },
  });

  return {
    id: section.id,
    key: section.key,
    isManual: section.isManual,
    productIds: section.publishedRevision?.productIds ?? section.productIds,
    draftIsManual: section.draftIsManual,
    draftProductIds: section.draftProductIds,
    scheduledPublishAt: section.scheduledPublishAt?.toISOString() ?? null,
    scheduledRevisionId: section.scheduledRevisionId,
    publishedRevisionId: section.publishedRevisionId,
    lastPublishedAt: section.lastPublishedAt?.toISOString() ?? null,
    updatedAt: section.updatedAt.toISOString(),
    revisions: section.revisions.map((revision) => ({
      id: revision.id,
      isManual: revision.isManual,
      productIds: revision.productIds,
      createdAt: revision.createdAt.toISOString(),
      createdByEmail: revision.createdByEmail,
    })),
  };
}

const isMissingLandingPageSectionTableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021" &&
  String(error.meta?.table ?? "").includes("LandingPageSection");

export async function PUT(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  const definition = getLandingPageSectionDefinition(key);
  if (!definition) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    storefront?: unknown;
    draftIsManual?: unknown;
    productIds?: unknown;
  };
  const storefront =
    parseStorefront(typeof body.storefront === "string" ? body.storefront : null) ??
    DEFAULT_STOREFRONT;
  const storefrontLabel = STOREFRONT_LABELS[storefront];
  const draftIsManual = body.draftIsManual === true;
  const productIds = parseProductIds(body.productIds);

  if (productIds.length > definition.maxItems) {
    return NextResponse.json(
      { error: `You can select at most ${definition.maxItems} products for this section.` },
      { status: 400 },
    );
  }

  if (draftIsManual && productIds.length === 0) {
    return NextResponse.json(
      { error: "Manual overrides need at least one selected product." },
      { status: 400 },
    );
  }

  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          id: { in: productIds },
          status: "ACTIVE",
          storefronts: { has: storefront },
        },
        select: { id: true },
      })
    : [];

  if (products.length !== productIds.length) {
    return NextResponse.json(
      {
        error: `Only active ${storefrontLabel} storefront products can be featured on the landing page.`,
      },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.landingPageSection.findUnique({
      where: {
        storefront_key: {
          storefront,
          key: definition.key,
        },
      },
    });

    const section = await prisma.landingPageSection.upsert({
      where: {
        storefront_key: {
          storefront,
          key: definition.key,
        },
      },
      create: {
        storefront,
        key: definition.key,
        isManual: false,
        productIds: [],
        draftIsManual,
        draftProductIds: productIds,
      },
      update: {
        draftIsManual,
        draftProductIds: productIds,
      },
    });
    await createSectionRevision({
      sectionId: section.id,
      storefront,
      key: definition.key,
      isManual: section.draftIsManual,
      productIds: section.draftProductIds,
      actor: {
        id: session.user.id,
        email: session.user.email ?? null,
      },
    });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "landing_page.section.update",
      targetType: "landing_page_section",
      targetId: section.id,
      summary: `Updated ${storefrontLabel} landing page section ${definition.title}`,
      metadata: {
        storefront,
        key: definition.key,
        before: existing
          ? {
              isManual: existing.isManual,
              productIds: existing.productIds,
              draftIsManual: existing.draftIsManual,
              draftProductIds: existing.draftProductIds,
              scheduledPublishAt: existing.scheduledPublishAt?.toISOString() ?? null,
            }
          : null,
        after: {
          isManual: section.isManual,
          productIds: section.productIds,
          draftIsManual: section.draftIsManual,
          draftProductIds: section.draftProductIds,
          scheduledPublishAt: section.scheduledPublishAt?.toISOString() ?? null,
        },
      },
    });

    return NextResponse.json({
      section: await serializeSection(section.id),
    });
  } catch (error) {
    if (isMissingLandingPageSectionTableError(error)) {
      return NextResponse.json(
        { error: "Landing page overrides are not available until the latest Prisma migration is applied." },
        { status: 503 },
      );
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await context.params;
  const definition = getLandingPageSectionDefinition(key);
  if (!definition) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    storefront?: unknown;
    action?: unknown;
    scheduledPublishAt?: unknown;
    revisionId?: unknown;
  };
  const storefront =
    parseStorefront(typeof body.storefront === "string" ? body.storefront : null) ??
    DEFAULT_STOREFRONT;
  const storefrontLabel = STOREFRONT_LABELS[storefront];
  const action = typeof body.action === "string" ? body.action : "";

  try {
    const existing = await prisma.landingPageSection.findUnique({
      where: {
        storefront_key: {
          storefront,
          key: definition.key,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Save the draft section before publishing it." },
        { status: 400 },
      );
    }

    if (existing.draftIsManual && existing.draftProductIds.length === 0) {
      return NextResponse.json(
        { error: "Manual draft overrides need at least one selected product." },
        { status: 400 },
      );
    }

    const latestRevision = await prisma.landingPageSectionRevision.findFirst({
      where: { sectionId: existing.id },
      orderBy: { createdAt: "desc" },
    });
    const selectedRevisionId =
      typeof body.revisionId === "string" ? body.revisionId : null;
    const selectedRevision = selectedRevisionId
      ? await prisma.landingPageSectionRevision.findFirst({
          where: {
            id: selectedRevisionId,
            sectionId: existing.id,
          },
        })
      : latestRevision;

    let section;
    if (action === "publish_now") {
      if (!selectedRevision) {
        return NextResponse.json(
          { error: "Save the draft section before publishing it." },
          { status: 400 },
        );
      }
      const jobRun = await startAdminJobRun({
        jobType: "landing_page_publish",
        summary: `${storefrontLabel} ${definition.title}`,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });
      section = await prisma.landingPageSection.update({
        where: { id: existing.id },
        data: {
          isManual: selectedRevision.isManual,
          productIds: selectedRevision.productIds,
          publishedRevisionId: selectedRevision.id,
          scheduledPublishAt: null,
          scheduledRevisionId: null,
          lastPublishedAt: new Date(),
        },
      });
      await finishAdminJobRun({
        id: jobRun.id,
        status: "SUCCEEDED",
        summary: `${storefrontLabel} ${definition.title}`,
      });
    } else if (action === "schedule") {
      if (!selectedRevision) {
        return NextResponse.json(
          { error: "Save the draft section before scheduling it." },
          { status: 400 },
        );
      }
      const scheduleValue =
        typeof body.scheduledPublishAt === "string" ? body.scheduledPublishAt : "";
      const scheduledPublishAt = new Date(scheduleValue);
      if (!scheduleValue || Number.isNaN(scheduledPublishAt.getTime())) {
        return NextResponse.json({ error: "Choose a valid publish time." }, { status: 400 });
      }
      if (scheduledPublishAt <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled publish time must be in the future." },
          { status: 400 },
        );
      }
      const jobRun = await startAdminJobRun({
        jobType: "landing_page_schedule",
        summary: `${storefrontLabel} ${definition.title}`,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });
      section = await prisma.landingPageSection.update({
        where: { id: existing.id },
        data: {
          scheduledPublishAt,
          scheduledRevisionId: selectedRevision.id,
        },
      });
      await finishAdminJobRun({
        id: jobRun.id,
        status: "SUCCEEDED",
        summary: `${storefrontLabel} ${definition.title}`,
        metadata: {
          scheduledPublishAt: scheduledPublishAt.toISOString(),
        },
      });
    } else if (action === "clear_schedule") {
      section = await prisma.landingPageSection.update({
        where: { id: existing.id },
        data: {
          scheduledPublishAt: null,
          scheduledRevisionId: null,
        },
      });
    } else if (action === "rollback_draft") {
      if (!selectedRevision) {
        return NextResponse.json(
          { error: "Choose a revision to restore into the draft." },
          { status: 400 },
        );
      }
      section = await prisma.landingPageSection.update({
        where: { id: existing.id },
        data: {
          draftIsManual: selectedRevision.isManual,
          draftProductIds: selectedRevision.productIds,
        },
      });
      await createSectionRevision({
        sectionId: existing.id,
        storefront,
        key: definition.key,
        isManual: selectedRevision.isManual,
        productIds: selectedRevision.productIds,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });
    } else if (action === "rollback_live") {
      if (!selectedRevision) {
        return NextResponse.json(
          { error: "Choose a revision to restore into the live section." },
          { status: 400 },
        );
      }
      section = await prisma.landingPageSection.update({
        where: { id: existing.id },
        data: {
          isManual: selectedRevision.isManual,
          productIds: selectedRevision.productIds,
          publishedRevisionId: selectedRevision.id,
          lastPublishedAt: new Date(),
        },
      });
    } else {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: `landing_page.section.${action}`,
      targetType: "landing_page_section",
      targetId: section.id,
      summary: `Updated ${storefrontLabel} landing page section ${definition.title}`,
      metadata: {
        storefront,
        key: definition.key,
        action,
        selectedRevisionId: selectedRevision?.id ?? null,
        scheduledPublishAt: section.scheduledPublishAt?.toISOString() ?? null,
        lastPublishedAt: section.lastPublishedAt?.toISOString() ?? null,
        live: {
          isManual: section.isManual,
          productIds: section.productIds,
        },
        draft: {
          draftIsManual: section.draftIsManual,
          draftProductIds: section.draftProductIds,
        },
      },
    });

    return NextResponse.json({
      section: await serializeSection(section.id),
    });
  } catch (error) {
    if (isMissingLandingPageSectionTableError(error)) {
      return NextResponse.json(
        { error: "Landing page overrides are not available until the latest Prisma migration is applied." },
        { status: 503 },
      );
    }
    throw error;
  }
}
