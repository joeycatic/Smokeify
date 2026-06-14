import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import { mapDiscountCode, updateDiscountCodeActive } from "@/lib/discountCodes";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-discount-update:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    active?: boolean;
  };

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Active flag is required." }, { status: 400 });
  }

  const updated = await updateDiscountCodeActive(id, body.active);

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "discount.update",
    targetType: "discount",
    targetId: id,
    summary: `Set discount ${updated.code} active=${updated.active}`,
    metadata: { active: updated.active },
  });

  return NextResponse.json({ discount: mapDiscountCode(updated) });
}
