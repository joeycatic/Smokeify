import { Prisma } from "@prisma/client";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  generateGrowthCrossSells,
  getGrowthBootstrapMessage,
  getGrowthOverviewSafe,
  isGrowthControlPlaneMissingError,
  runWelcomeSeries,
  updateGrowthConfig,
} from "@/lib/growthService";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CHECKOUT_RECOVERY_CONFIG,
  serializeCheckoutRecoveryConfig,
} from "@/lib/checkoutRecovery";
import { ensureAutomationSchedules } from "@/lib/automationQueue";

export const GET = withAdminRoute(
  async () => adminJson(await getGrowthOverviewSafe()),
  { scope: "analytics.read" },
);

const growthUnavailable = () =>
  adminJson({ error: getGrowthBootstrapMessage() }, { status: 503 });

export const PATCH = withAdminRoute(
  async ({ request, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        enabled?: boolean;
        welcomeEnabled?: boolean;
        recoveryEnabled?: boolean;
        popupDelaySeconds?: number;
        contentCadenceDays?: number;
      };
      const config = await updateGrowthConfig({
        enabled: body.enabled ?? Boolean(body.welcomeEnabled || body.recoveryEnabled),
        payload: {
          welcomeEnabled: body.welcomeEnabled ?? false,
          recoveryEnabled: body.recoveryEnabled ?? false,
          popupDelaySeconds: body.popupDelaySeconds ?? 7,
          contentCadenceDays: body.contentCadenceDays ?? 7,
        },
      });
      await ensureAutomationSchedules();
      await Promise.all([
        prisma.automationSchedule.updateMany({
          where: { key: "growth-welcome-run" },
          data: { status: body.welcomeEnabled ? "ACTIVE" : "PAUSED" },
        }),
        prisma.automationSchedule.updateMany({
          where: { key: "checkout-recovery-run" },
          data: {
            status: body.recoveryEnabled ? "ACTIVE" : "PAUSED",
            payload: serializeCheckoutRecoveryConfig(
              DEFAULT_CHECKOUT_RECOVERY_CONFIG,
            ) as Prisma.InputJsonValue,
          },
        }),
      ]);
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "growth.config.update",
        targetType: "growth_config",
        targetId: config.key,
        summary: "Updated GrowVault growth configuration",
      });
      return adminJson({ ok: true, config });
    } catch (error) {
      if (isGrowthControlPlaneMissingError(error)) return growthUnavailable();
      throw error;
    }
  },
  { scope: "ops.write" },
);

export const POST = withAdminRoute(
  async ({ request, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string;
        article?: Record<string, unknown>;
      };
      if (body.action === "run_welcome") {
        return adminJson(await runWelcomeSeries({ bypassPaused: true }));
      }
      if (body.action === "generate_cross_sells") {
        return adminJson(await generateGrowthCrossSells());
      }
      if (body.action === "save_article") {
        const article = body.article ?? {};
        const id = typeof article.id === "string" ? article.id : null;
        const slug = typeof article.slug === "string" ? article.slug.trim() : "";
        const title = typeof article.title === "string" ? article.title.trim() : "";
        const excerpt = typeof article.excerpt === "string" ? article.excerpt.trim() : "";
        const markdown = typeof article.markdown === "string" ? article.markdown.trim() : "";
        if (!slug || !title || !excerpt || !markdown) {
          return adminJson(
            { error: "Slug, Titel, Kurzbeschreibung und Inhalt sind erforderlich." },
            { status: 400 },
          );
        }
        const status =
          article.status === "PUBLISHED" || article.status === "SCHEDULED"
            ? article.status
            : "DRAFT";
        const scheduledAt =
          typeof article.scheduledAt === "string" && article.scheduledAt
            ? new Date(article.scheduledAt)
            : null;
        const saved = id
          ? await prisma.contentArticle.update({
              where: { id },
              data: {
                slug,
                title,
                excerpt,
                seoTitle: typeof article.seoTitle === "string" ? article.seoTitle : null,
                seoDescription:
                  typeof article.seoDescription === "string" ? article.seoDescription : null,
                keyword: typeof article.keyword === "string" ? article.keyword : null,
                cluster: typeof article.cluster === "string" ? article.cluster : null,
                status,
                body: { markdown } as Prisma.InputJsonValue,
                scheduledAt,
                publishedAt: status === "PUBLISHED" ? new Date() : undefined,
              },
            })
          : await prisma.contentArticle.create({
              data: {
                storefront: "GROW",
                slug,
                title,
                excerpt,
                seoTitle: typeof article.seoTitle === "string" ? article.seoTitle : null,
                seoDescription:
                  typeof article.seoDescription === "string" ? article.seoDescription : null,
                keyword: typeof article.keyword === "string" ? article.keyword : null,
                cluster: typeof article.cluster === "string" ? article.cluster : null,
                status,
                body: { markdown } as Prisma.InputJsonValue,
                scheduledAt,
                publishedAt: status === "PUBLISHED" ? new Date() : null,
              },
            });
        await logAdminAction({
          actor: { id: session.user.id, email: session.user.email ?? null },
          action: "growth.article.save",
          targetType: "content_article",
          targetId: saved.id,
          summary: `Saved GrowVault article ${saved.slug}`,
        });
        return adminJson({ ok: true, article: saved });
      }
      return adminJson({ error: "Unknown growth action." }, { status: 400 });
    } catch (error) {
      if (isGrowthControlPlaneMissingError(error)) return growthUnavailable();
      throw error;
    }
  },
  { scope: "ops.write" },
);
