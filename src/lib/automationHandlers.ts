import "server-only";

import type { Storefront } from "@prisma/client";
import { buildGrowvaultDiagnosticAlerts, getGrowvaultSharedDiagnosticsFeed } from "@/lib/growvaultSharedStorefront";
import { syncAdminAlerts } from "@/lib/adminAlerts";
import { prisma } from "@/lib/prisma";
import { runApprovedAdminScriptById } from "@/lib/adminScriptExecution";
import { runAdminPricingAutomation } from "@/lib/adminPricingServer";
import {
  buildAdminReportDeliveryEmail,
  computeNextAdminReportDelivery,
} from "@/lib/adminReportDelivery";
import {
  getAdminReportSnapshot,
  parseAdminReportPaymentState,
  parseAdminReportStorefront,
  parseAdminReportType,
  serializeAdminReportFilters,
} from "@/lib/adminReports";
import { sendResendEmail } from "@/lib/resend";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import type { AutomationHandler } from "@/lib/automationPolicy";

type AutomationActor = {
  id?: string | null;
  email?: string | null;
};

export type AutomationHandlerResult = {
  summary: string;
  data?: Record<string, unknown>;
};

function getOriginForAutomation() {
  return process.env.NEXTAUTH_URL || process.env.APP_URL || "https://www.smokeify.de";
}

async function runSupplierStockSync() {
  const { runSupplierSync } = await import("@/lib/supplierStockSync.mjs");
  const result = await runSupplierSync({ prisma });
  const lowStockVariants = await prisma.variant.findMany({
    include: {
      inventory: true,
      product: { select: { storefronts: true } },
    },
    where: {
      product: { status: "ACTIVE" },
    },
    take: 250,
  });
  const risky = lowStockVariants.filter((variant) => {
    const onHand = variant.inventory?.quantityOnHand ?? 0;
    return onHand <= variant.lowStockThreshold;
  });

  return {
    summary: `Supplier stock sync processed ${result.processed} rows.`,
    data: {
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      processed: result.processed,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      lowStockCount: risky.length,
      lowStockVariantIds: risky.slice(0, 25).map((variant) => variant.id),
    },
  } satisfies AutomationHandlerResult;
}

async function runGrowvaultDiagnosticsSync() {
  const diagnostics = await getGrowvaultSharedDiagnosticsFeed();
  const alerts = buildGrowvaultDiagnosticAlerts(diagnostics.statuses);
  await syncAdminAlerts(alerts);

  const failedStatuses = diagnostics.statuses.filter((status) => status.status === "fail");
  const warnStatuses = diagnostics.statuses.filter((status) => status.status === "warn");

  return {
    summary: `Growvault diagnostics synced ${alerts.length} alerts.`,
    data: {
      generatedAt: diagnostics.generatedAt,
      alertsSynced: alerts.length,
      failedStatusCount: failedStatuses.length,
      warnStatusCount: warnStatuses.length,
      failingKeys: failedStatuses.map((status) => status.key),
    },
  } satisfies AutomationHandlerResult;
}

async function runAdminReportDelivery() {
  const now = new Date();
  const reports = await prisma.adminSavedReport.findMany({
    where: {
      deliveryEnabled: true,
      nextDeliveryAt: { lte: now },
    },
    orderBy: { nextDeliveryAt: "asc" },
    take: 20,
  });

  const origin = getOriginForAutomation();
  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const report of reports) {
    try {
      if (
        !report.deliveryEmail ||
        !report.deliveryFrequency ||
        report.deliveryHour === null
      ) {
        throw new Error("Report schedule is incomplete.");
      }

      const filters = {
        reportType: parseAdminReportType(report.reportType),
        days: parseAdminTimeRangeDays(String(report.days)),
        sourceStorefront: parseAdminReportStorefront(report.sourceStorefront ?? "ALL"),
        paymentState: parseAdminReportPaymentState(report.paymentState),
      };
      const snapshot = await getAdminReportSnapshot(filters);
      const reportUrl = new URL(
        `/admin/reports?${new URLSearchParams(serializeAdminReportFilters(filters)).toString()}`,
        origin,
      ).toString();
      const email = buildAdminReportDeliveryEmail({
        reportName: report.name,
        reportUrl,
        currency: snapshot.currency,
        revenueCents: snapshot.summary.revenue.current,
        orderCount: snapshot.summary.orders.current,
        averageOrderValueCents: snapshot.summary.averageOrderValue.current,
        customerCount: snapshot.summary.customers.current,
      });

      await sendResendEmail({
        to: report.deliveryEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await prisma.adminSavedReport.update({
        where: { id: report.id },
        data: {
          lastDeliveredAt: now,
          nextDeliveryAt: computeNextAdminReportDelivery({
            frequency: report.deliveryFrequency,
            hour: report.deliveryHour,
            weekday: report.deliveryWeekday,
            from: now,
          }),
        },
      });

      sent.push(report.id);
    } catch (error) {
      failed.push({
        id: report.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    summary: `Admin report delivery processed ${reports.length} schedules.`,
    data: {
      processed: reports.length,
      sent,
      failed,
    },
  } satisfies AutomationHandlerResult;
}

async function publishScheduledLandingPageSections(actor?: AutomationActor | null) {
  const now = new Date();
  const sections = await prisma.landingPageSection.findMany({
    where: {
      scheduledPublishAt: { lte: now },
      scheduledRevisionId: { not: null },
    },
    include: {
      scheduledRevision: true,
    },
    take: 25,
  });

  const publishedKeys: string[] = [];
  for (const section of sections) {
    if (!section.scheduledRevision) continue;

    await prisma.landingPageSection.update({
      where: { id: section.id },
      data: {
        isManual: section.scheduledRevision.isManual,
        productIds: section.scheduledRevision.productIds,
        publishedRevisionId: section.scheduledRevision.id,
        scheduledRevisionId: null,
        scheduledPublishAt: null,
        lastPublishedAt: now,
      },
    });

    publishedKeys.push(`${section.storefront}:${section.key}`);
  }

  if (publishedKeys.length > 0 && actor?.email) {
    await prisma.adminAuditLog.create({
      data: {
        actorId: actor.id ?? null,
        actorEmail: actor.email,
        action: "landing_page.section.publish_scheduled",
        targetType: "landing_page_section",
        targetId: publishedKeys.join(","),
        summary: `Published ${publishedKeys.length} scheduled landing page sections`,
        metadata: {
          publishedKeys,
        },
      },
    });
  }

  return {
    summary: `Published ${publishedKeys.length} scheduled landing page sections.`,
    data: {
      publishedKeys,
      publishedCount: publishedKeys.length,
    },
  } satisfies AutomationHandlerResult;
}

export async function executeAutomationHandler(input: {
  handler: AutomationHandler;
  payload: Record<string, unknown>;
  actor?: AutomationActor | null;
}) {
  switch (input.handler) {
    case "admin.script.run": {
      const scriptId =
        typeof input.payload.scriptId === "string" ? input.payload.scriptId : "";
      if (!scriptId) {
        throw new Error("Admin script handler requires a scriptId.");
      }
      const inputs =
        input.payload.inputs && typeof input.payload.inputs === "object"
          ? (input.payload.inputs as Record<string, string>)
          : {};
      const { definition, normalizedInputs, result } = await runApprovedAdminScriptById({
        scriptId,
        inputs,
      });
      if (!result.ok) {
        throw new Error(
          result.timedOut
            ? `${definition.title} timed out after ${Math.round(definition.timeoutMs / 1000)} seconds.`
            : result.stderr.trim() || `Script exited with code ${result.exitCode ?? "unknown"}.`,
        );
      }
      return {
        summary: `Completed ${definition.title}.`,
        data: {
          scriptId: definition.id,
          normalizedInputs,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        },
      } satisfies AutomationHandlerResult;
    }
    case "supplier.stock.sync":
      return runSupplierStockSync();
    case "supplier.pricing.sync": {
      const { result } = await runApprovedAdminScriptById({
        scriptId: "pricing:seed-bloomtech-profiles",
      });
      if (!result.ok) {
        throw new Error(result.stderr.trim() || "Supplier pricing sync failed.");
      }
      return {
        summary: "Completed supplier pricing sync.",
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      } satisfies AutomationHandlerResult;
    }
    case "pricing.reprice": {
      const result = await runAdminPricingAutomation(
        {
          mode: input.payload.mode === "PREVIEW" ? "PREVIEW" : "APPLY",
          limit:
            typeof input.payload.limit === "number" && Number.isFinite(input.payload.limit)
              ? Math.floor(input.payload.limit)
              : undefined,
          notes:
            typeof input.payload.notes === "string" ? input.payload.notes : null,
          refreshPublicCompetitorData: input.payload.refreshPublicCompetitorData !== false,
          marketReportPath:
            typeof input.payload.marketReportPath === "string"
              ? input.payload.marketReportPath
              : null,
        },
        { actor: input.actor },
      );
      return {
        summary: `Pricing run ${result.summary.runId} completed.`,
        data: result.summary as unknown as Record<string, unknown>,
      } satisfies AutomationHandlerResult;
    }
    case "growvault.diagnostics.sync":
      return runGrowvaultDiagnosticsSync();
    case "admin.report.delivery":
      return runAdminReportDelivery();
    case "landing_page.publish_scheduled":
      return publishScheduledLandingPageSections(input.actor);
    default:
      throw new Error(`Unsupported automation handler: ${input.handler}`);
  }
}
