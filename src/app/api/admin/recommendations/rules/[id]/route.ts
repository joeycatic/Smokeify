import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import { parseRecommendationRuleInput } from "@/lib/recommendationRules";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.recommendationRule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseRecommendationRuleInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const rule = await prisma.recommendationRule.update({
    where: { id },
    data: parsed.value,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "recommendation.rule.update",
    targetType: "recommendation_rule",
    targetId: rule.id,
    summary: `Updated recommendation rule ${rule.name}`,
    metadata: {
      before: {
        name: existing.name,
        triggerType: existing.triggerType,
        triggerValue: existing.triggerValue,
        targetType: existing.targetType,
        targetValue: existing.targetValue,
        priority: existing.priority,
        maxProducts: existing.maxProducts,
        isActive: existing.isActive,
      },
      after: {
        name: rule.name,
        triggerType: rule.triggerType,
        triggerValue: rule.triggerValue,
        targetType: rule.targetType,
        targetValue: rule.targetValue,
        priority: rule.priority,
        maxProducts: rule.maxProducts,
        isActive: rule.isActive,
      },
    },
  });

  return NextResponse.json({ rule });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.recommendationRule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  await prisma.recommendationRule.delete({ where: { id } });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "recommendation.rule.delete",
    targetType: "recommendation_rule",
    targetId: existing.id,
    summary: `Deleted recommendation rule ${existing.name}`,
    metadata: {
      triggerType: existing.triggerType,
      triggerValue: existing.triggerValue,
      targetType: existing.targetType,
      targetValue: existing.targetValue,
      priority: existing.priority,
    },
  });

  return NextResponse.json({ ok: true });
}
