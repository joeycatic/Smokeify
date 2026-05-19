import { adminJson } from "@/lib/adminApi";
import { runAutomationJobNow } from "@/lib/automationQueue";
import { parseStorefront, type StorefrontCode } from "@/lib/storefronts";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  CHECKOUT_RECOVERY_SCHEDULE_KEY,
  previewCheckoutRecoveryRun,
  sendCheckoutRecoveryTestEmail,
} from "@/lib/checkoutRecoveryService";

type RunAction = "preview" | "run" | "test_send";

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: RunAction;
      limit?: number;
      recipient?: string;
      storefront?: string;
      stepIndex?: number;
      recoveryUrl?: string | null;
      promoCode?: string | null;
      promoMessage?: string | null;
    };

    const action = body.action ?? "preview";
    if (action === "preview") {
      const preview = await previewCheckoutRecoveryRun({
        limit:
          typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
            ? Math.floor(body.limit)
            : undefined,
      });
      return adminJson(preview);
    }

    if (action === "test_send") {
      const recipient = body.recipient?.trim();
      const storefront = parseStorefront(body.storefront ?? null) ?? "MAIN";
      const stepIndex =
        typeof body.stepIndex === "number" && Number.isFinite(body.stepIndex)
          ? Math.max(1, Math.floor(body.stepIndex))
          : 1;
      if (!recipient) {
        return adminJson({ error: "Recipient is required." }, { status: 400 });
      }
      await sendCheckoutRecoveryTestEmail({
        to: recipient,
        storefront: storefront as StorefrontCode,
        stepIndex,
        recoveryUrl: body.recoveryUrl ?? null,
        promoCode: body.promoCode ?? null,
        promoMessage: body.promoMessage ?? null,
      });
      return adminJson({ ok: true });
    }

    const automation = await runAutomationJobNow({
      handler: "checkout.recovery.run",
      scheduleKey: CHECKOUT_RECOVERY_SCHEDULE_KEY,
      payload: {
        bypassPaused: true,
        limit:
          typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
            ? Math.floor(body.limit)
            : undefined,
      },
      actor: {
        id: session.user.id,
        email: session.user.email ?? null,
      },
      workerId: `admin-checkout-recovery-${session.user.id}`,
    });

    if (!automation.result) {
      return adminJson(
        {
          error: automation.error ?? "Checkout recovery run failed.",
          job: automation.job,
        },
        { status: 502 },
      );
    }

    return adminJson({
      summary: automation.result.data ?? {},
      job: automation.job,
    });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-checkout-recovery-run",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
