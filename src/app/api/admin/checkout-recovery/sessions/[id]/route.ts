import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  resumeCheckoutRecoverySession,
  sendCheckoutRecoverySessionNow,
  suppressCheckoutRecoverySession,
} from "@/lib/checkoutRecoveryService";

type SessionAction = "suppress" | "resume" | "send_now";

export const PATCH = withAdminRoute(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: SessionAction;
      reason?: string;
    };

    const id = params.id;
    if (!id) {
      return adminJson({ error: "Session id is required." }, { status: 400 });
    }

    if (body.action === "suppress") {
      const updated = await suppressCheckoutRecoverySession({
        sessionId: id,
        reason: typeof body.reason === "string" ? body.reason : "",
      });
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "checkout_recovery.session_suppressed",
        targetType: "checkout_recovery_session",
        targetId: id,
        summary: `Suppressed checkout recovery session ${id}`,
        metadata: { reason: updated.suppressionReason },
      });
      return adminJson({ session: updated });
    }

    if (body.action === "resume") {
      const updated = await resumeCheckoutRecoverySession(id);
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "checkout_recovery.session_resumed",
        targetType: "checkout_recovery_session",
        targetId: id,
        summary: `Resumed checkout recovery session ${id}`,
      });
      return adminJson({ session: updated });
    }

    if (body.action === "send_now") {
      const result = await sendCheckoutRecoverySessionNow({
        sessionId: id,
        actor: { id: session.user.id, email: session.user.email ?? null },
      });
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "checkout_recovery.session_send_now",
        targetType: "checkout_recovery_session",
        targetId: id,
        summary: `Sent checkout recovery step ${result.stepIndex} for session ${id}`,
        metadata: { stepIndex: result.stepIndex },
      });
      return adminJson(result);
    }

    return adminJson({ error: "Unsupported action." }, { status: 400 });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-checkout-recovery-session",
      limit: 40,
      windowMs: 10 * 60 * 1000,
      message: "Too many checkout recovery session actions. Try again shortly.",
    },
  },
);
