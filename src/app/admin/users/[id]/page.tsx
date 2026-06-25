import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/adminCatalog";
import { fetchGrowvaultAnalyzerAdminJson } from "@/lib/growvaultAnalyzerAdminBridge";
import AdminUserEditClient from "./AdminUserEditClient";

type AdminUserAnalyzerRun = {
  id: string;
  storefront: "Smokeify" | "Growvault";
  userEmail: string | null;
  provider: string;
  model: string;
  latencyMs: number | null;
  confidence: number;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  safetyFlags: string[];
  createdAt: string;
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: string;
  }>;
  feedbackCount: number;
  incorrectFeedbackCount: number;
};

type GrowvaultAnalyzerBridgeItem = {
  id: string;
  userEmail: string | null;
  provider: string;
  model: string;
  confidence: number;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  safetyFlags: string[];
  createdAt: string;
  issueLabels: string[];
  feedbackCount: number;
  incorrectFeedbackCount: number;
};

async function loadGrowvaultAnalyzerRunsForUser(email: string | null): Promise<{
  runs: AdminUserAnalyzerRun[];
  error: string | null;
}> {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return { runs: [], error: null };
  }

  const searchParams = new URLSearchParams({
    includeResolved: "true",
    limit: "100",
    userEmail: normalizedEmail,
  });
  const bridge = await fetchGrowvaultAnalyzerAdminJson<{
    items?: GrowvaultAnalyzerBridgeItem[];
    error?: string;
  }>("/api/internal/admin/analyzer/runs", searchParams.toString());

  if (!bridge?.ok) {
    return {
      runs: [],
      error:
        bridge?.payload.error ??
        "Growvault analyzer runs could not be loaded through the admin bridge.",
    };
  }

  return {
    error: null,
    runs: (bridge.payload.items ?? []).map((run) => ({
      id: run.id,
      storefront: "Growvault",
      userEmail: run.userEmail,
      provider: run.provider,
      model: run.model,
      latencyMs: null,
      confidence: run.confidence,
      healthStatus: run.healthStatus,
      species: run.species,
      reviewStatus: run.reviewStatus,
      safetyFlags: run.safetyFlags,
      createdAt: run.createdAt,
      issues: run.issueLabels.map((label, index) => ({
        id: `${run.id}:issue:${index}`,
        label,
        confidence: 0,
        severity: run.healthStatus,
      })),
      feedbackCount: run.feedbackCount,
      incorrectFeedbackCount: run.incorrectFeedbackCount,
    })),
  };
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminScope("users.manage");
  if (!session) notFound();

  const { id } = await params;

  const [user, recentOrders, localAnalyzerRuns, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        role: true,
        customerGroup: true,
        notes: true,
        newsletterOptIn: true,
        newsletterOptInAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        amountTotal: true,
        createdAt: true,
      },
    }),
    prisma.plantAnalysisRun.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        provider: true,
        model: true,
        latencyMs: true,
        confidence: true,
        healthStatus: true,
        species: true,
        reviewStatus: true,
        safetyFlags: true,
        createdAt: true,
        user: { select: { email: true } },
        issues: {
          orderBy: { position: "asc" },
          take: 6,
          select: {
            id: true,
            label: true,
            confidence: true,
            severity: true,
          },
        },
        feedback: {
          select: {
            id: true,
            isCorrect: true,
          },
        },
      },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetType: "user", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!user) notFound();

  const growvaultAnalyzer = await loadGrowvaultAnalyzerRunsForUser(user.email);
  const analyzerRuns = [
    ...localAnalyzerRuns.map((run) => ({
      id: run.id,
      storefront: "Smokeify" as const,
      userEmail: run.user?.email ?? user.email,
      provider: run.provider,
      model: run.model,
      latencyMs: run.latencyMs,
      confidence: run.confidence,
      healthStatus: run.healthStatus,
      species: run.species,
      reviewStatus: run.reviewStatus,
      safetyFlags: run.safetyFlags,
      createdAt: run.createdAt.toISOString(),
      issues: run.issues,
      feedbackCount: run.feedback.length,
      incorrectFeedbackCount: run.feedback.filter((entry) => !entry.isCorrect)
        .length,
    })),
    ...growvaultAnalyzer.runs,
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <AdminUserEditClient
      user={{
        ...user,
        newsletterOptInAt: user.newsletterOptInAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }}
      recentOrders={recentOrders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      }))}
      analyzerRuns={analyzerRuns}
      analyzerBridgeError={growvaultAnalyzer.error}
      auditLogs={auditLogs.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail,
        action: l.action,
        summary: l.summary,
        metadata: l.metadata as Record<string, unknown> | null,
        createdAt: l.createdAt.toISOString(),
      }))}
      actorRole={session.user.role}
    />
  );
}
