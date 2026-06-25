import "server-only";

import { buildGrowvaultDiagnosticAlerts, getGrowvaultSharedDiagnosticsFeed } from "@/lib/growvaultSharedStorefront";
import { syncAdminAlerts } from "@/lib/adminAlerts";
import { prisma } from "@/lib/prisma";
import { runAdminPricingAutomation } from "@/lib/adminPricingServer";
import {
  buildAdminReportDeliveryEmail,
  computeNextAdminReportDelivery,
  normalizeAdminReportDeliveryRecipients,
} from "@/lib/adminReportDelivery";
import {
  getAdminReportSnapshot,
  parseAdminReportPaymentState,
  parseAdminReportStorefront,
  parseAdminReportType,
  serializeAdminReportFilters,
} from "@/lib/adminReports";
import { sendResendEmail } from "@/lib/resend";
import { sendSupplierSyncDailyReport } from "@/lib/supplierSyncDailyReport";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import type { AutomationHandler } from "@/lib/automationPolicy";
import { runCheckoutRecoveryCampaign } from "@/lib/checkoutRecoveryService";
import { buildCatalogHygieneAlerts } from "@/lib/adminCatalogHygiene";
import { runWelcomeSeries } from "@/lib/growthService";
import { notifyBackInStockForVariants } from "@/lib/backInStockNotifications";

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
  const { runSupplierSync } = await import("./supplierStockSync.mjs");
  const result = await runSupplierSync({ prisma });
  const restockedVariantIds = Array.isArray(result.changes)
    ? result.changes
        .filter(
          (change: { previous?: number; next?: number }) =>
            Number(change.previous ?? 0) <= 0 && Number(change.next ?? 0) > 0,
        )
        .map((change: { variantId?: string }) => change.variantId)
        .filter((id: unknown): id is string => typeof id === "string")
    : [];
  const backInStock = await notifyBackInStockForVariants(restockedVariantIds);
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
      backInStock,
    },
  } satisfies AutomationHandlerResult;
}

async function runSupplierStockDailyReport() {
  const result = await sendSupplierSyncDailyReport({ prisma });

  return {
    summary: `Supplier stock daily report sent for ${result.totalRuns} sync runs.`,
    data: {
      totalRuns: result.totalRuns,
      successfulRuns: result.successfulRuns,
      failedRuns: result.failedRuns,
      processed: result.processed,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      timedOutRuns: result.timedOutRuns,
      durationMs: result.durationMs,
      windowStart: result.windowStart.toISOString(),
      windowEnd: result.windowEnd.toISOString(),
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
      const recipients = normalizeAdminReportDeliveryRecipients(
        report.deliveryRecipients,
        report.deliveryEmail,
      );

      if (recipients.length === 0 || !report.deliveryFrequency || report.deliveryHour === null) {
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

      const failedRecipients: string[] = [];
      let successfulDeliveries = 0;
      for (const recipient of recipients) {
        try {
          await sendResendEmail({
            to: recipient,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          successfulDeliveries += 1;
        } catch (error) {
          failedRecipients.push(
            error instanceof Error ? `${recipient}: ${error.message}` : `${recipient}: delivery failed`,
          );
        }
      }

      await prisma.adminSavedReport.update({
        where: { id: report.id },
        data: {
          lastDeliveredAt: successfulDeliveries > 0 ? now : report.lastDeliveredAt,
          nextDeliveryAt: computeNextAdminReportDelivery({
            frequency: report.deliveryFrequency,
            hour: report.deliveryHour,
            weekday: report.deliveryWeekday,
            from: now,
          }),
          lastDeliveryError: failedRecipients.length > 0 ? failedRecipients.join("\n") : null,
        },
      });

      if (successfulDeliveries > 0) {
        sent.push(report.id);
      }
      if (failedRecipients.length > 0 && successfulDeliveries === 0) {
        failed.push({
          id: report.id,
          error: failedRecipients.join("\n"),
        });
      }
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

async function runCatalogHygieneScan() {
  const alerts = await buildCatalogHygieneAlerts();
  await syncAdminAlerts(alerts);

  return {
    summary: `Catalog hygiene scan synced ${alerts.length} alerts.`,
    data: {
      alertsSynced: alerts.length,
      alertTypes: alerts.map((alert) => alert.type),
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
      const { runApprovedAdminScriptById } = await import(
        /* turbopackIgnore: true */ "./adminScriptExecution"
      );
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
        actor: input.actor
          ? {
              id: input.actor.id,
              email: input.actor.email ?? null,
            }
          : undefined,
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
    case "checkout.recovery.run": {
      const result = await runCheckoutRecoveryCampaign({
        limit:
          typeof input.payload.limit === "number" && Number.isFinite(input.payload.limit)
            ? Math.floor(input.payload.limit)
            : undefined,
        bypassPaused: input.payload.bypassPaused === true,
        actor: input.actor,
      });
      return {
        summary: result.paused
          ? "Checkout recovery is paused."
          : `Checkout recovery processed ${result.processed} candidate(s).`,
        data: result as unknown as Record<string, unknown>,
      } satisfies AutomationHandlerResult;
    }
    case "growth.welcome.run": {
      const result = await runWelcomeSeries({
        limit:
          typeof input.payload.limit === "number" && Number.isFinite(input.payload.limit)
            ? Math.floor(input.payload.limit)
            : undefined,
        bypassPaused: input.payload.bypassPaused === true,
      });
      return {
        summary: result.paused
          ? "GrowVault welcome series is paused."
          : `GrowVault welcome series processed ${result.processed} enrollment(s).`,
        data: result,
      } satisfies AutomationHandlerResult;
    }
    case "supplier.stock.daily_report":
      return runSupplierStockDailyReport();
    case "supplier.pricing.sync": {
      const { runApprovedAdminScriptById } = await import(
        /* turbopackIgnore: true */ "./adminScriptExecution"
      );
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
    case "catalog.hygiene.scan":
      return runCatalogHygieneScan();
    case "landing_page.publish_scheduled":
      return publishScheduledLandingPageSections(input.actor);
    default:
      throw new Error(`Unsupported automation handler: ${input.handler}`);
  }
}
