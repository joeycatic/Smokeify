import { prisma } from "@/lib/prisma";
import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { parseRecommendationRuleInput } from "@/lib/recommendationRules";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async () => {
  const rules = await prisma.recommendationRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return adminJson({ rules });
});

export const POST = withAdminRoute(async ({ request, session }) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseRecommendationRuleInput(body);
  if (!parsed.ok) {
    return adminJson({ error: parsed.error }, { status: 400 });
  }

  const rule = await prisma.recommendationRule.create({
    data: parsed.value,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "recommendation.rule.create",
    targetType: "recommendation_rule",
    targetId: rule.id,
    summary: `Created recommendation rule ${rule.name}`,
    metadata: {
      triggerType: rule.triggerType,
      triggerValue: rule.triggerValue,
      targetType: rule.targetType,
      targetValue: rule.targetValue,
      priority: rule.priority,
    },
  });

  return adminJson({ rule });
});
