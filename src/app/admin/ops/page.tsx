import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { listAdminJobRuns } from "@/lib/adminJobRuns";
import { canReplayWebhookEvent } from "@/lib/adminWebhookReplay";
import { prisma } from "@/lib/prisma";
import AdminOpsClient from "./AdminOpsClient";

export default async function AdminOpsPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

  const [jobRuns, failedWebhookEvents] = await Promise.all([
    listAdminJobRuns(),
    prisma.processedWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminOpsClient
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
