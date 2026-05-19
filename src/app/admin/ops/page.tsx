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
import { canReplayWebhookEvent } from "@/lib/adminWebhookReplay";
import { getCheckoutRecoveryOverview } from "@/lib/checkoutRecoveryService";
import { prisma } from "@/lib/prisma";
import AdminOpsClient from "./AdminOpsClient";

export default async function AdminOpsPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

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
    getCheckoutRecoveryOverview(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
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
          supportedReplay: canReplayWebhookEvent(event.type),
        }))}
        jobRuns={jobRuns}
      />
    </div>
  );
}
