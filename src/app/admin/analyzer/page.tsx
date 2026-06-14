import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadPlantAnalysisAdminRuns } from "@/lib/analyzerAdminData";
import AdminAnalyzerClient, {
  type AdminAnalyzerInitialQueue,
} from "./AdminAnalyzerClient";

async function getInitialSmokeifyAnalyzerQueue(): Promise<AdminAnalyzerInitialQueue> {
  const runs = await loadPlantAnalysisAdminRuns({
    limit: 250,
    reviewStatus: null,
    includeResolved: false,
  });

  return {
    source: "smokeify",
    runs,
    summary: {
      total: runs.length,
      unresolved: runs.filter((run) => run.reviewStatus !== "REVIEWED_OK").length,
      disputed: runs.filter((run) => (run.incorrectFeedbackCount ?? 0) > 0).length,
      lowConfidence: runs.filter((run) => run.confidence < 0.65).length,
      critical: runs.filter((run) => run.healthStatus === "CRITICAL").length,
      submitted: runs.filter((run) => run.publicationStatus === "SUBMITTED").length,
      unassigned: runs.filter((run) => !run.assignedReviewerId).length,
      dueToday: runs.filter((run) => {
        if (!run.reviewDueAt || run.reviewStatus === "REVIEWED_OK") return false;
        return new Date(run.reviewDueAt).toDateString() === new Date().toDateString();
      }).length,
      overdue: runs.filter((run) => run.overdue).length,
      publicationEligible: runs.filter((run) => run.publicationEligible).length,
    },
  };
}

export default async function AdminAnalyzerPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();
  const initialQueue = await getInitialSmokeifyAnalyzerQueue();

  return (
    <div className="w-full text-slate-100">
      <AdminAnalyzerClient initialQueue={initialQueue} />
    </div>
  );
}
