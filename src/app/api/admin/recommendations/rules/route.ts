import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import { parseRecommendationRuleInput } from "@/lib/recommendationRules";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.recommendationRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseRecommendationRuleInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
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

  return NextResponse.json({ rule });
}
