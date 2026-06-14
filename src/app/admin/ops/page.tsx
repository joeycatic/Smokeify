import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { listAdminJobRuns } from "@/lib/adminJobRuns";
import {
  getAutomationBootstrapMessage,
  isAutomationControlPlaneMissingError,
  listAutomationJobs,
  listAutomationSchedules,
} from "@/lib/automationQueue";
import { listUnresolvedOrderAttributionRows } from "@/lib/adminAttribution";
import { getAdminEnvironmentHealth } from "@/lib/adminEnvironmentHealth";
import { getCheckoutRecoveryOverview } from "@/lib/checkoutRecoveryService";
import { prisma } from "@/lib/prisma";
import AdminOpsClient from "./AdminOpsClient";

export default async function AdminOpsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("ops.read"))) notFound();
  const resolvedSearchParams = await searchParams;
  const rawRecoveryPage = Array.isArray(resolvedSearchParams?.recoveryPage)
    ? resolvedSearchParams?.recoveryPage[0] ?? "1"
    : resolvedSearchParams?.recoveryPage ?? "1";
  const parsedRecoveryPage = Number.parseInt(rawRecoveryPage, 10);
  const recoveryPage =
    Number.isFinite(parsedRecoveryPage) && parsedRecoveryPage > 0
      ? parsedRecoveryPage
      : 1;

  const [jobRuns, failedWebhookEvents, automationData, environmentHealth, attributionSnapshot, checkoutRecovery] = await Promise.all([
    listAdminJobRuns(),
    prisma.processedWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    (async () => {
      try {
        const [automationJobs, automationSchedules] = await Promise.all([
          listAutomationJobs(),
          listAutomationSchedules(),
        ]);
        return {
          automationJobs,
          automationSchedules,
          automationUnavailableReason: null,
        };
      } catch (error) {
        if (!isAutomationControlPlaneMissingError(error)) throw error;
        return {
          automationJobs: [],
          automationSchedules: [],
          automationUnavailableReason: getAutomationBootstrapMessage(),
        };
      }
    })(),
    getAdminEnvironmentHealth(),
    listUnresolvedOrderAttributionRows(),
    getCheckoutRecoveryOverview({ page: recoveryPage }),
  ]);

  return (
    <div className="w-full text-slate-100">
      <AdminOpsClient
        automationJobs={automationData.automationJobs}
        automationSchedules={automationData.automationSchedules}
        automationUnavailableReason={automationData.automationUnavailableReason}
        checkoutRecovery={checkoutRecovery}
        unresolvedAttributionCount={attributionSnapshot.rows.length}
        environmentHealth={environmentHealth}
        failedWebhookEvents={failedWebhookEvents.map((event) => ({
          id: event.id,
          eventId: event.eventId,
          type: event.type,
          status: event.status,
          createdAt: event.createdAt.toISOString(),
        }))}
        jobRuns={jobRuns}
      />
    </div>
  );
}
